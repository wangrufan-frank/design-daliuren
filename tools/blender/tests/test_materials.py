import json
import math
import struct
import sys
import tempfile
import unittest
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector


BLENDER_DIR = Path(__file__).parents[1]
REPOSITORY_ROOT = Path(__file__).parents[3]
CONTRACT_PATH = REPOSITORY_ROOT / "assets/daliuren/materials/material-contract.json"
BOARD_PATH = REPOSITORY_ROOT / "docs/asset-reviews/lookdev/material-board.png"
MATERIAL_NAMES = {
    "M_Bronze",
    "M_Patina",
    "M_Celadon",
    "M_OldGold",
    "M_AshText",
}
MASK_NAMES = {
    "mask_contact_wear",
    "mask_recess_oxidation",
    "mask_insert_dirt",
    "mask_celadon_crackle",
}
MASK_ATTRIBUTES = {
    "mask_contact_wear": "causal_contact_wear",
    "mask_recess_oxidation": "causal_recess_oxidation",
    "mask_insert_dirt": "causal_insert_boundary",
    "mask_celadon_crackle": "causal_celadon_crackle",
}
PALETTE = {
    "ink": "#121817",
    "bronze": "#26322F",
    "patina": "#435C53",
    "celadon": "#879B92",
    "ash": "#C2C6BB",
    "oldGold": "#80704C",
}
FORBIDDEN_DYNAMIC_TEXT = {"贵人", "初传", "中传", "末传", "父母", "官鬼"}

sys.path.insert(0, str(BLENDER_DIR))

from build_graybox import build_master
from materials import apply_master_materials, build_master_materials


def linear_channel(value):
    value /= 255.0
    if value <= 0.04045:
        return value / 12.92
    return ((value + 0.055) / 1.055) ** 2.4


def linear_hex(value):
    return tuple(linear_channel(int(value[index : index + 2], 16)) for index in (1, 3, 5))


def principled(material):
    nodes = [
        node
        for node in material.node_tree.nodes
        if node.bl_idname == "ShaderNodeBsdfPrincipled"
    ]
    if len(nodes) != 1:
        raise AssertionError(f"{material.name} has {len(nodes)} Principled nodes")
    return nodes[0]


def material_name(obj):
    if obj.type != "MESH" or len(obj.data.materials) != 1:
        return None
    return obj.data.materials[0].name


def attribute_values(obj, name):
    attribute = obj.data.attributes.get(name)
    if attribute is None:
        return ()
    return tuple(round(item.value, 6) for item in attribute.data)


class MaterialTest(unittest.TestCase):
    def tearDown(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def assertColorClose(self, actual, expected):
        for actual_channel, expected_channel in zip(actual[:3], expected):
            self.assertAlmostEqual(actual_channel, expected_channel, places=6)

    def assertFaceMaskSample(self, object_name, attribute_name, clean_filter, affected_filter):
        obj = bpy.data.objects[object_name]
        attribute = obj.data.attributes.get(attribute_name)
        self.assertIsNotNone(attribute, object_name)
        self.assertEqual(attribute.domain, "FACE", object_name)
        clean_faces = [polygon for polygon in obj.data.polygons if clean_filter(polygon)]
        affected_faces = [polygon for polygon in obj.data.polygons if affected_filter(polygon)]
        self.assertTrue(clean_faces, f"No clean sample on {object_name}")
        self.assertTrue(affected_faces, f"No affected sample on {object_name}")
        clean = max(clean_faces, key=lambda polygon: polygon.area)
        affected = max(affected_faces, key=lambda polygon: polygon.area)
        self.assertEqual(attribute.data[clean.index].value, 0.0, object_name)
        self.assertGreater(attribute.data[affected.index].value, 0.0, object_name)

    def assertCausalFaceMasks(self):
        contact_holders = [
            obj for obj in bpy.data.objects if obj.type == "MESH" and "causal_contact_wear" in obj.data.attributes
        ]
        recess_holders = [
            obj for obj in bpy.data.objects if obj.type == "MESH" and "causal_recess_oxidation" in obj.data.attributes
        ]
        insert_holders = [
            obj for obj in bpy.data.objects if obj.type == "MESH" and "causal_insert_boundary" in obj.data.attributes
        ]

        allowed_contact_details = {
            "mechanism/heaven-detent",
            "mechanism/lesson-dovetails",
            "mechanism/lesson-end-stop",
            "mechanism/lesson-general-socket",
            "mechanism/bridge-stops",
            "mechanism/general-track",
        }
        allowed_recess_details = {
            "structure/base-bottom-seam",
            "structure/base-shell-thickness",
            "mechanism/heaven-bearing",
            "structure/bronze-celadon-contact-seam",
            "mechanism/general-track",
        }
        allowed_contact_objects = {"base/body", "plate/earth", "plate/heaven"}

        for obj in contact_holders:
            with self.subTest(mask="contact", object=obj.name):
                self.assertTrue(
                    obj.name in allowed_contact_objects or obj.get("detail_id") in allowed_contact_details
                )
                attribute = obj.data.attributes["causal_contact_wear"]
                self.assertEqual(attribute.domain, "FACE")
                values = tuple(item.value for item in attribute.data)
                self.assertIn(0.0, values)
                self.assertTrue(any(value > 0.0 for value in values))

        for obj in recess_holders:
            with self.subTest(mask="recess", object=obj.name):
                self.assertIn(obj.get("detail_id"), allowed_recess_details)
                attribute = obj.data.attributes["causal_recess_oxidation"]
                self.assertEqual(attribute.domain, "FACE")
                values = tuple(item.value for item in attribute.data)
                self.assertIn(0.0, values)
                self.assertTrue(any(value > 0.0 for value in values))

        for obj in insert_holders:
            with self.subTest(mask="insert", object=obj.name):
                self.assertEqual(material_name(obj), "M_Celadon")
                attribute = obj.data.attributes["causal_insert_boundary"]
                self.assertEqual(attribute.domain, "FACE")
                values = tuple(item.value for item in attribute.data)
                self.assertIn(0.0, values)
                self.assertTrue(any(value > 0.0 for value in values))

        self.assertNotIn(
            "causal_recess_oxidation",
            bpy.data.objects["detail/bridge/support-body"].data.attributes,
        )
        self.assertNotIn(
            "causal_recess_oxidation",
            bpy.data.objects["detail/heaven/support-rib/00"].data.attributes,
        )
        self.assertNotIn(
            "causal_contact_wear",
            bpy.data.objects["detail/heaven/inlay-bed/00"].data.attributes,
        )

        self.assertFaceMaskSample(
            "base/body",
            "causal_contact_wear",
            lambda polygon: polygon.normal.z > 0.999 and abs(polygon.center.x) < 0.01 and abs(polygon.center.y) < 0.01,
            lambda polygon: abs(polygon.normal.z) < 0.01 and max(abs(polygon.center.x), abs(polygon.center.y)) > 0.24,
        )
        self.assertFaceMaskSample(
            "detail/base/removable-bottom",
            "causal_recess_oxidation",
            lambda polygon: polygon.normal.z > 0.999,
            lambda polygon: polygon.normal.z < -0.999,
        )
        self.assertFaceMaskSample(
            "lesson/first/readout/upper",
            "causal_insert_boundary",
            lambda polygon: polygon.normal.z > 0.999,
            lambda polygon: abs(polygon.normal.z) < 0.01,
        )
        self.assertFaceMaskSample(
            "detail/heaven/center-bearing",
            "causal_recess_oxidation",
            lambda polygon: polygon.normal.z > 0.999,
            lambda polygon: polygon.center.z < 0.0 and abs(polygon.normal.z) < 0.95,
        )

    def test_master_materials_use_linear_palette_and_physical_principled_roles(self):
        materials = build_master_materials()

        self.assertEqual({material.name for material in materials}, MATERIAL_NAMES)
        expected = {
            "M_Bronze": ("#26322F", 1.0, 0.58),
            "M_Patina": ("#435C53", 1.0, 0.72),
            "M_Celadon": ("#879B92", 0.0, 0.34),
            "M_OldGold": ("#80704C", 1.0, 0.38),
            "M_AshText": ("#C2C6BB", 0.0, 0.68),
        }
        for name, (hex_color, metallic, roughness) in expected.items():
            shader = principled(bpy.data.materials[name])
            with self.subTest(material=name):
                self.assertColorClose(shader.inputs["Base Color"].default_value, linear_hex(hex_color))
                self.assertAlmostEqual(shader.inputs["Metallic"].default_value, metallic)
                self.assertAlmostEqual(shader.inputs["Roughness"].default_value, roughness)

        celadon = principled(bpy.data.materials["M_Celadon"])
        self.assertGreater(celadon.inputs["Coat Weight"].default_value, 0.0)
        self.assertLessEqual(celadon.inputs["Coat Weight"].default_value, 0.22)
        self.assertLessEqual(celadon.inputs["Specular IOR Level"].default_value, 0.4)
        self.assertTrue(celadon.inputs["Normal"].is_linked)

        bronze_nodes = bpy.data.materials["M_Bronze"].node_tree.nodes
        bronze_groups = {
            node.node_tree.name
            for node in bronze_nodes
            if node.bl_idname == "ShaderNodeGroup" and node.node_tree
        }
        self.assertIn("mask_contact_wear", bronze_groups)
        self.assertTrue(principled(bpy.data.materials["M_Bronze"]).inputs["Roughness"].is_linked)

    def test_mask_groups_have_distinct_causal_topologies_and_real_attribute_inputs(self):
        build_master_materials()

        self.assertTrue(MASK_NAMES.issubset(bpy.data.node_groups.keys()))
        signatures = {}
        for name in sorted(MASK_NAMES):
            group = bpy.data.node_groups[name]
            attribute_nodes = [
                node for node in group.nodes if node.bl_idname == "ShaderNodeAttribute"
            ]
            attributes = {node.attribute_name for node in attribute_nodes}
            with self.subTest(mask=name):
                self.assertEqual(group.get("mask_semantic"), name.removeprefix("mask_"))
                self.assertIn(MASK_ATTRIBUTES[name], attributes)
                self.assertGreaterEqual(len(group.links), 2)
            signatures[name] = (
                tuple(sorted(node.bl_idname for node in group.nodes)),
                tuple(sorted(attributes)),
                len(group.links),
            )

        self.assertEqual(len(set(signatures.values())), 4)
        self.assertNotIn(
            "ShaderNodeTexNoise",
            {node.bl_idname for node in bpy.data.node_groups["mask_contact_wear"].nodes},
        )
        self.assertIn(
            "ShaderNodeTexNoise",
            {node.bl_idname for node in bpy.data.node_groups["mask_insert_dirt"].nodes},
        )
        self.assertIn(
            "ShaderNodeTexVoronoi",
            {node.bl_idname for node in bpy.data.node_groups["mask_celadon_crackle"].nodes},
        )

    def test_material_builder_rejects_duplicate_construction_without_side_effects(self):
        build_master_materials()
        material_count = len(bpy.data.materials)
        group_count = len(bpy.data.node_groups)

        with self.assertRaisesRegex(RuntimeError, "already exist"):
            build_master_materials()

        self.assertEqual(len(bpy.data.materials), material_count)
        self.assertEqual(len(bpy.data.node_groups), group_count)

    def test_assignments_and_mesh_attributes_follow_physical_causes(self):
        root = build_master()

        self.assertEqual(root["node_id"], "artifact/root")
        meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
        self.assertTrue(meshes)
        self.assertTrue(all(material_name(obj) in MATERIAL_NAMES for obj in meshes))

        self.assertEqual(material_name(bpy.data.objects["base/body"]), "M_Bronze")
        self.assertEqual(material_name(bpy.data.objects["plate/heaven"]), "M_Bronze")
        self.assertEqual(material_name(bpy.data.objects["lesson/first/readout/upper"]), "M_Celadon")
        self.assertEqual(material_name(bpy.data.objects["transmission/initial"]), "M_Celadon")
        self.assertEqual(
            material_name(bpy.data.objects["detail/heaven/contact-seam/00"]),
            "M_Patina",
        )

        for obj in meshes:
            with self.subTest(object=obj.name, material=material_name(obj)):
                if material_name(obj) == "M_OldGold":
                    self.assertEqual(obj.get("inscription_role"), "mechanical-scale")
                if material_name(obj) == "M_AshText":
                    self.assertIn(
                        obj.get("inscription_role"),
                        {
                            "earth-branch",
                            "historical-beidou",
                            "historical-mansion",
                            "historical-month-deity",
                        },
                    )
                if "causal_celadon_crackle" in obj.data.attributes:
                    self.assertEqual(material_name(obj), "M_Celadon")
                if "causal_insert_boundary" in obj.data.attributes:
                    self.assertEqual(material_name(obj), "M_Celadon")

        contact = bpy.data.objects["detail/lesson/first/dovetail"]
        recess = bpy.data.objects["detail/base/removable-bottom"]
        boundary = bpy.data.objects["lesson/first/readout/upper"]
        self.assertTrue(attribute_values(contact, "causal_contact_wear"))
        self.assertTrue(attribute_values(recess, "causal_recess_oxidation"))
        self.assertGreater(len(set(attribute_values(boundary, "causal_insert_boundary"))), 1)
        self.assertGreater(len(set(attribute_values(boundary, "causal_celadon_crackle"))), 1)
        self.assertCausalFaceMasks()

        phases = {}
        for lesson in ("first", "second", "third", "fourth"):
            obj = bpy.data.objects[f"lesson/{lesson}/readout/upper"]
            values = attribute_values(obj, "dirt_phase")
            self.assertTrue(values)
            self.assertEqual(len(set(values)), 1)
            phases[lesson] = values[0]
        self.assertEqual(len(set(phases.values())), 4)
        self.assertNotAlmostEqual(phases["first"], phases["fourth"])
        self.assertNotAlmostEqual(phases["second"], phases["third"])

    def test_materialized_master_reopens_without_changing_frozen_contract(self):
        build_master()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "master.blend"
            bpy.ops.wm.save_as_mainfile(filepath=str(path))
            bpy.ops.wm.open_mainfile(filepath=str(path))

            runtime = [obj for obj in bpy.data.objects if "node_id" in obj]
            details = [obj for obj in bpy.data.objects if "detail_id" in obj]
            inscriptions = [obj for obj in bpy.data.objects if "inscription_role" in obj]
            self.assertEqual(len(runtime), 28)
            self.assertEqual(len(details), 85)
            self.assertEqual(len(inscriptions), 71)
            self.assertEqual({material.name for material in bpy.data.materials}, MATERIAL_NAMES)
            self.assertTrue(MASK_NAMES.issubset(bpy.data.node_groups.keys()))
            self.assertTrue(
                FORBIDDEN_DYNAMIC_TEXT.isdisjoint(
                    {obj.get("inscription_text") for obj in inscriptions}
                )
            )
            self.assertEqual(
                tuple(round(value, 6) for value in bpy.data.objects["plate/heaven"].dimensions),
                (0.38, 0.38, 0.024),
            )
            self.assertCausalFaceMasks()

    def test_contract_and_material_board_are_complete_and_visually_nonempty(self):
        contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))

        self.assertEqual(contract["schemaVersion"], 1)
        self.assertEqual(contract["blenderVersion"], "4.5.12 LTS")
        self.assertEqual(contract["palette"], PALETTE)
        self.assertEqual(set(contract["materials"]), MATERIAL_NAMES)
        self.assertEqual(set(contract["masks"]), MASK_NAMES)
        self.assertEqual(contract["reviewRender"]["resolution"], [1920, 1080])
        self.assertEqual(contract["reviewRender"]["engine"], "CYCLES")
        self.assertEqual(contract["reviewRender"]["keyTemperatureK"], 4300)
        self.assertEqual(contract["reviewRender"]["transparentBackground"], False)
        self.assertEqual(contract["reviewRender"]["celadonCloseup"]["pixelRegion"], [1240, 40, 1840, 520])
        self.assertEqual(contract["reviewRender"]["celadonCloseup"]["minimumProjectedDiameterPx"], 420)
        self.assertEqual(contract["reviewRender"]["sphereOrder"], [
            "M_Bronze",
            "M_Patina",
            "M_Celadon",
            "M_OldGold",
            "M_AshText",
        ])

        data = BOARD_PATH.read_bytes()
        self.assertGreater(len(data), 100_000)
        self.assertEqual(data[:8], b"\x89PNG\r\n\x1a\n")
        width, height = struct.unpack(">II", data[16:24])
        self.assertEqual((width, height), (1920, 1080))

        image = bpy.data.images.load(str(BOARD_PATH), check_existing=False)
        try:
            pixels = image.pixels[:]
            sampled_rgb = []
            stride = max(4, (len(pixels) // 12000) // 4 * 4)
            for index in range(0, len(pixels), stride):
                sampled_rgb.extend(pixels[index : index + 3])
            quantized = {round(value, 2) for value in sampled_rgb}
            self.assertGreater(len(quantized), 35)
            self.assertLess(min(sampled_rgb), 0.08)
            self.assertGreater(max(sampled_rgb), 0.55)
            self.assertGreater(math.fsum(sampled_rgb) / len(sampled_rgb), 0.04)

            closeup_rgb = []
            closeup_gradients = []
            for display_y in range(40, 520, 4):
                image_y = height - 1 - display_y
                for x in range(1240, 1840, 4):
                    index = (image_y * width + x) * 4
                    rgb = tuple(pixels[index : index + 3])
                    closeup_rgb.append(math.fsum(rgb) / 3.0)
                    next_index = (image_y * width + min(x + 4, width - 1)) * 4
                    next_luminance = math.fsum(pixels[next_index : next_index + 3]) / 3.0
                    closeup_gradients.append(abs(next_luminance - closeup_rgb[-1]))
            self.assertGreater(
                sum(value > 0.08 for value in closeup_rgb) / len(closeup_rgb),
                0.35,
            )
            self.assertGreater(
                sum(value > 0.0025 for value in closeup_gradients) / len(closeup_gradients),
                0.015,
            )

            micro_gradients = []
            for display_y in range(120, 350, 2):
                image_y = height - 1 - display_y
                for x in range(1420, 1620, 2):
                    index = (image_y * width + x) * 4
                    right_index = (image_y * width + x + 2) * 4
                    down_index = ((image_y - 2) * width + x) * 4
                    luminance = math.fsum(pixels[index : index + 3]) / 3.0
                    right = math.fsum(pixels[right_index : right_index + 3]) / 3.0
                    down = math.fsum(pixels[down_index : down_index + 3]) / 3.0
                    micro_gradients.extend((abs(right - luminance), abs(down - luminance)))
            micro_gradients.sort()
            p95 = micro_gradients[int(len(micro_gradients) * 0.95)]
            self.assertGreater(p95, 0.008)
            self.assertLess(p95, 0.04)

            micro_laplacian = []
            for display_y in range(120, 350, 2):
                image_y = height - 1 - display_y
                for x in range(1420, 1620, 2):
                    def luminance(sample_x, sample_y):
                        sample_index = (sample_y * width + sample_x) * 4
                        return math.fsum(pixels[sample_index : sample_index + 3]) / 3.0

                    center = luminance(x, image_y)
                    neighbors = (
                        luminance(x - 2, image_y),
                        luminance(x + 2, image_y),
                        luminance(x, image_y - 2),
                        luminance(x, image_y + 2),
                    )
                    micro_laplacian.append(abs(center - math.fsum(neighbors) / 4.0))
            micro_laplacian.sort()
            laplacian_p95 = micro_laplacian[int(len(micro_laplacian) * 0.95)]
            self.assertGreater(laplacian_p95, 0.007)
            self.assertLess(laplacian_p95, 0.03)
        finally:
            bpy.data.images.remove(image)

    def test_material_board_camera_contains_all_five_spheres_without_clipping(self):
        from materials import build_material_board_scene

        build_master_materials()
        scene = build_material_board_scene()
        self.assertEqual(scene.render.engine, "CYCLES")
        key = scene.objects["material-board/key-4300K"]
        self.assertTrue(key.data.use_temperature)
        self.assertEqual(key.data.temperature, 4300.0)
        closeup = scene.objects["review/celadon-closeup"]
        closeup_projected = [
            world_to_camera_view(scene, scene.camera, closeup.matrix_world @ Vector(corner))
            for corner in closeup.bound_box
        ]
        closeup_width = (max(point.x for point in closeup_projected) - min(point.x for point in closeup_projected)) * 1920
        closeup_height = (max(point.y for point in closeup_projected) - min(point.y for point in closeup_projected)) * 1080
        self.assertGreaterEqual(closeup_width, 420)
        self.assertGreaterEqual(closeup_height, 420)
        self.assertGreater(min(point.x for point in closeup_projected), 0.63)
        self.assertLess(max(point.x for point in closeup_projected), 0.97)
        self.assertGreater(min(point.y for point in closeup_projected), 0.50)
        self.assertLess(max(point.y for point in closeup_projected), 0.98)
        spheres = sorted(
            (obj for obj in scene.objects if obj.name.startswith("review/sphere/")),
            key=lambda obj: obj.name,
        )
        self.assertEqual(len(spheres), 5)
        for sphere in spheres:
            projected = [
                world_to_camera_view(scene, scene.camera, sphere.matrix_world @ Vector(corner))
                for corner in sphere.bound_box
            ]
            with self.subTest(sphere=sphere.name):
                self.assertGreater(min(point.x for point in projected), 0.02)
                self.assertLess(max(point.x for point in projected), 0.98)
                self.assertGreater(min(point.y for point in projected), 0.04)
                self.assertLess(max(point.y for point in projected), 0.96)
                world_corners = [sphere.matrix_world @ Vector(corner) for corner in sphere.bound_box]
                self.assertAlmostEqual(min(point.z for point in world_corners), 0.0, places=3)


if __name__ == "__main__":
    unittest.main(argv=[__file__])
