import math
import sys
import unittest
from pathlib import Path

import bpy


BLENDER_DIR = Path(__file__).parents[1]
sys.path.insert(0, str(BLENDER_DIR))

from uv_and_bake import (
    _downsample_two_by_two,
    _family_buffers,
    _joined_bake_proxy,
    _native_bake_channel,
    _native_island_coverage,
)


def make_material(with_bump=False):
    material = bpy.data.materials.new("M_AshText")
    material.use_nodes = True
    shader = next(
        node
        for node in material.node_tree.nodes
        if node.bl_idname == "ShaderNodeBsdfPrincipled"
    )
    shader.inputs["Base Color"].default_value = (0.42, 0.46, 0.40, 1.0)
    shader.inputs["Metallic"].default_value = 0.0
    shader.inputs["Roughness"].default_value = 0.65
    if with_bump:
        coordinates = material.node_tree.nodes.new("ShaderNodeTexCoord")
        separate = material.node_tree.nodes.new("ShaderNodeSeparateXYZ")
        bump = material.node_tree.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.8
        bump.inputs["Distance"].default_value = 0.2
        material.node_tree.links.new(coordinates.outputs["Generated"], separate.inputs["Vector"])
        material.node_tree.links.new(separate.outputs["X"], bump.inputs["Height"])
        material.node_tree.links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    return material


def mesh_object(name, vertices, faces, uvs, material=None, family=None):
    mesh = bpy.data.meshes.new(f"{name}/mesh")
    mesh.from_pydata(vertices, (), faces)
    mesh.update()
    layer = mesh.uv_layers.new(name="UVMap")
    layer.active_render = True
    for loop, uv in zip(layer.data, uvs):
        loop.uv = uv
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if material is not None:
        mesh.materials.append(material)
    if family is not None:
        obj["runtime_texture_family"] = family
    return obj


def quad(name, center_x, uv_box, material, family="M_AshText", rotate_uv=False):
    low_u, low_v, high_u, high_v = uv_box
    coordinates = (
        (low_u, low_v),
        (high_u, low_v),
        (high_u, high_v),
        (low_u, high_v),
    )
    if rotate_uv:
        coordinates = (coordinates[3], coordinates[0], coordinates[1], coordinates[2])
    return mesh_object(
        name,
        (
            (center_x - 0.5, -0.5, 0.0),
            (center_x + 0.5, -0.5, 0.0),
            (center_x + 0.5, 0.5, 0.0),
            (center_x - 0.5, 0.5, 0.0),
        ),
        ((0, 1, 2, 3),),
        coordinates,
        material,
        family,
    )


def channel_pixel(buffer, dimension, x, y):
    offset = (y * dimension + x) * 3
    return tuple(buffer[offset : offset + 3])


class NativeCyclesBakeTest(unittest.TestCase):
    def setUp(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def tearDown(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def test_concave_fixture_bakes_darker_geometric_ao_than_exposed_control(self):
        material = make_material()
        exposed = quad("fixture/exposed", -2.0, (0.08, 0.2, 0.42, 0.8), material)
        recessed = quad("fixture/recessed", 2.0, (0.58, 0.2, 0.92, 0.8), material)
        wall_material = bpy.data.materials.new("fixture/occluder")
        for index, vertices in enumerate((
            ((1.5, -0.5, 0.0), (1.5, -0.5, 0.8), (2.5, -0.5, 0.8), (2.5, -0.5, 0.0)),
            ((2.5, -0.5, 0.0), (2.5, -0.5, 0.8), (2.5, 0.5, 0.8), (2.5, 0.5, 0.0)),
            ((2.5, 0.5, 0.0), (2.5, 0.5, 0.8), (1.5, 0.5, 0.8), (1.5, 0.5, 0.0)),
        )):
            mesh_object(f"fixture/wall/{index}", vertices, ((0, 1, 2, 3),), ((0, 0),) * 4, wall_material)

        buffers = _family_buffers("M_AshText", 64)
        exposed_ao = channel_pixel(buffers["orm"], 64, 16, 32)[0]
        recessed_ao = channel_pixel(buffers["orm"], 64, 48, 32)[0]

        self.assertLess(recessed_ao, exposed_ao - 20)
        self.assertEqual({exposed.name, recessed.name}, {"fixture/exposed", "fixture/recessed"})

    def test_single_continuous_uv_island_preserves_spatial_geometric_ao(self):
        material = make_material()
        surface = mesh_object(
            "fixture/continuous-surface",
            (
                (-1.0, -0.5, 0.0),
                (0.0, -0.5, 0.0),
                (1.0, -0.5, 0.0),
                (-1.0, 0.5, 0.0),
                (0.0, 0.5, 0.0),
                (1.0, 0.5, 0.0),
            ),
            ((0, 1, 4, 3), (1, 2, 5, 4)),
            (
                (0.1, 0.2),
                (0.5, 0.2),
                (0.5, 0.8),
                (0.1, 0.8),
                (0.5, 0.2),
                (0.9, 0.2),
                (0.9, 0.8),
                (0.5, 0.8),
            ),
            material,
            "M_AshText",
        )
        wall_material = bpy.data.materials.new("fixture/continuous-occluder")
        for index, vertices in enumerate((
            ((0.0, -0.5, 0.0), (0.0, -0.5, 0.8), (1.0, -0.5, 0.8), (1.0, -0.5, 0.0)),
            ((1.0, -0.5, 0.0), (1.0, -0.5, 0.8), (1.0, 0.5, 0.8), (1.0, 0.5, 0.0)),
            ((1.0, 0.5, 0.0), (1.0, 0.5, 0.8), (0.0, 0.5, 0.8), (0.0, 0.5, 0.0)),
        )):
            mesh_object(
                f"fixture/continuous-wall/{index}",
                vertices,
                ((0, 1, 2, 3),),
                ((0, 0),) * 4,
                wall_material,
            )

        coverage, owners = _native_island_coverage((surface,), 64)
        exposed_index = 32 * 64 + 19
        recessed_index = 32 * 64 + 45
        self.assertEqual(coverage[exposed_index], 1)
        self.assertEqual(coverage[recessed_index], 1)
        self.assertEqual(owners[exposed_index], owners[recessed_index])

        orm = _family_buffers("M_AshText", 64)["orm"]
        exposed_ao = channel_pixel(orm, 64, 19, 32)[0]
        recessed_ao = channel_pixel(orm, 64, 45, 32)[0]

        self.assertLess(recessed_ao, exposed_ao - 20, (exposed_ao, recessed_ao))

    def test_joined_proxy_preserves_world_geometry_uv_materials_and_causal_attributes_then_cleans_up(self):
        material = make_material()
        first = quad("fixture/proxy-a", 0.0, (0.1, 0.1, 0.4, 0.4), material)
        second_material = bpy.data.materials.new("fixture/proxy-material-b")
        second = quad("fixture/proxy-b", 0.0, (0.6, 0.6, 0.9, 0.9), second_material)
        second.location.x = 3.0
        for index, obj in enumerate((first, second)):
            attribute = obj.data.attributes.new("causal_contact_wear", "FLOAT", "FACE")
            attribute.data[0].value = index * 0.75
        original_names = {obj.name for obj in bpy.data.objects}
        original_meshes = {mesh.name for mesh in bpy.data.meshes}
        original_collections = {
            obj.name: tuple(collection.name for collection in obj.users_collection)
            for obj in bpy.data.objects
        }

        with _joined_bake_proxy((first, second)) as proxy:
            self.assertEqual(len(proxy.data.polygons), 2)
            self.assertEqual(len(proxy.data.materials), 2)
            self.assertEqual(sorted(polygon.material_index for polygon in proxy.data.polygons), [0, 1])
            self.assertIsNotNone(proxy.data.uv_layers.get("UVMap"))
            values = sorted(item.value for item in proxy.data.attributes["causal_contact_wear"].data)
            self.assertEqual(values, [0.0, 0.75])
            world_x = sorted((proxy.matrix_world @ vertex.co).x for vertex in proxy.data.vertices)
            self.assertLess(world_x[0], -0.49)
            self.assertGreater(world_x[-1], 3.49)
            self.assertTrue(first.hide_render)
            self.assertTrue(second.hide_render)

        self.assertEqual({obj.name for obj in bpy.data.objects}, original_names)
        self.assertEqual({mesh.name for mesh in bpy.data.meshes}, original_meshes)
        self.assertEqual(
            {
                obj.name: tuple(collection.name for collection in obj.users_collection)
                for obj in bpy.data.objects
            },
            original_collections,
        )
        self.assertFalse(first.hide_render)
        self.assertFalse(second.hide_render)

    def test_proxy_native_bake_matches_single_object_without_duplicate_ao_pollution(self):
        material = make_material(with_bump=True)
        source = quad("fixture/proxy-control", 0.0, (0.2, 0.2, 0.8, 0.8), material)
        direct = _native_bake_channel(
            "M_AshText", 64, "AO", 8, background=(255, 255, 255), objects=(source,)
        )

        with _joined_bake_proxy((source,)) as proxy:
            proxied = _native_bake_channel(
                "M_AshText", 64, "AO", 8, background=(255, 255, 255), objects=(proxy,)
            )

        direct_pixel = channel_pixel(direct, 64, 32, 32)
        proxy_pixel = channel_pixel(proxied, 64, 32, 32)
        self.assertLessEqual(
            max(abs(first - second) for first, second in zip(direct_pixel, proxy_pixel)),
            1,
        )

    def test_native_ao_is_byte_deterministic_for_repeated_bakes(self):
        material = make_material()
        quad("fixture/repeat-ao", 0.0, (0.2, 0.2, 0.8, 0.8), material)

        first = _family_buffers("M_AshText", 64)["orm"]
        second = _family_buffers("M_AshText", 64)["orm"]

        self.assertEqual(first, second)

    def test_uv_rotation_rotates_native_tangent_space_normal_components(self):
        material = make_material(with_bump=True)
        quad("fixture/normal-u", -1.0, (0.08, 0.2, 0.42, 0.8), material)
        quad("fixture/normal-v", 1.0, (0.58, 0.2, 0.92, 0.8), material, rotate_uv=True)

        normal = _family_buffers("M_AshText", 64)["normal"]
        first = channel_pixel(normal, 64, 16, 32)
        second = channel_pixel(normal, 64, 48, 32)

        self.assertGreater(abs(first[0] - 128), abs(first[1] - 128) + 2, (first, second))
        self.assertGreater(abs(second[1] - 128), abs(second[0] - 128) + 2, (first, second))
        for encoded in (first, second):
            length = math.sqrt(sum(((value - 128) / 127.0) ** 2 for value in encoded))
            self.assertAlmostEqual(length, 1.0, delta=0.06)

    def test_metallic_surface_basecolor_uses_shader_color_instead_of_black_diffuse_response(self):
        material = make_material()
        shader = next(
            node for node in material.node_tree.nodes
            if node.bl_idname == "ShaderNodeBsdfPrincipled"
        )
        shader.inputs["Base Color"].default_value = (0.22, 0.31, 0.27, 1.0)
        shader.inputs["Metallic"].default_value = 1.0
        quad("fixture/metal", 0.0, (0.2, 0.2, 0.8, 0.8), material)

        base = _family_buffers("M_AshText", 64)["baseColor"]

        self.assertEqual(channel_pixel(base, 64, 32, 32), (129, 151, 142))

    def test_subpixel_triangle_is_rejected_before_native_bake(self):
        material = make_material(with_bump=True)
        center = (0.503, 0.503)
        mesh_object(
            "fixture/subpixel",
            ((-0.5, -0.5, 0.0), (0.5, -0.5, 0.0), (-0.5, 0.5, 0.0)),
            ((0, 1, 2),),
            ((0.500, 0.500), (0.506, 0.500), (0.500, 0.506)),
            material,
            "M_AshText",
        )

        with self.assertRaisesRegex(RuntimeError, "sub-texel"):
            _family_buffers("M_AshText", 64)

    def test_eight_pixel_native_bake_margin_survives_edge_bilinear_sampling(self):
        material = make_material(with_bump=True)
        quad("fixture/padded", 0.0, (0.25, 0.25, 0.75, 0.75), material)

        normal = _family_buffers("M_AshText", 64)["normal"]
        inside = channel_pixel(normal, 64, 17, 32)
        outside = channel_pixel(normal, 64, 13, 32)

        self.assertNotEqual(inside, (128, 128, 255))
        self.assertLess(max(abs(first - second) for first, second in zip(inside, outside)), 8)

    def test_adjacent_high_contrast_islands_keep_owned_padding_at_lod0_and_lod2(self):
        left_material = make_material()
        left_material.name = "fixture/red"
        right_material = make_material()
        right_material.name = "fixture/blue"
        for material, color in (
            (left_material, (1.0, 0.0, 0.0, 1.0)),
            (right_material, (0.0, 0.0, 1.0, 1.0)),
        ):
            shader = next(
                node for node in material.node_tree.nodes
                if node.bl_idname == "ShaderNodeBsdfPrincipled"
            )
            shader.inputs["Base Color"].default_value = color
        left = quad("fixture/red-island", -1.0, (8 / 64, 16 / 64, 16 / 64, 48 / 64), left_material)
        right = quad("fixture/blue-island", 1.0, (32 / 64, 16 / 64, 40 / 64, 48 / 64), right_material)
        coverage, owners = _native_island_coverage((left, right), 64)
        source_x = [x for x in range(64) if coverage[32 * 64 + x] == 1]
        left_edge = max(x for x in source_x if x < 24)
        right_edge = min(x for x in source_x if x > 24)
        self.assertEqual(right_edge - left_edge, 17)

        lod0 = _native_bake_channel(
            "M_AshText",
            64,
            "BASE_COLOR",
            8,
            background=(0, 0, 0),
            srgb=True,
            objects=(left, right),
            coverage=coverage,
            owners=owners,
        )
        red = (255, 0, 0)
        blue = (0, 0, 255)
        self.assertTrue(all(channel_pixel(lod0, 64, x, 32) == red for x in range(16, 24)))
        self.assertTrue(all(channel_pixel(lod0, 64, x, 32) == blue for x in range(24, 32)))

        lod2 = _downsample_two_by_two(lod0, 64)
        self.assertTrue(all(channel_pixel(lod2, 32, x, 16) == red for x in range(8, 12)))
        self.assertTrue(all(channel_pixel(lod2, 32, x, 16) == blue for x in range(12, 16)))


if __name__ == "__main__":
    unittest.main(argv=[__file__, *(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])])
