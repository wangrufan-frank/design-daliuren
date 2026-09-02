import sys
import unittest
import json
import struct
import tempfile
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


BLENDER_DIR = Path(__file__).parents[1]
REPOSITORY_ROOT = Path(__file__).parents[3]
MATERIAL_CONTRACT_PATH = REPOSITORY_ROOT / "assets/daliuren/materials/material-contract.json"
sys.path.insert(0, str(BLENDER_DIR))

from build_lods import SOURCE_MARKER, build_lod
from daliuren_contract import BRANCH_INLAY_NODE_IDS, NODE_IDS
from export_graybox import export_lod
from uv_and_bake import DYNAMIC_LABEL_OWNERS, _excluded_from_runtime_bake


def runtime_ids(collection):
    return {
        obj["node_id"]
        for obj in collection.all_objects
        if obj.get("node_id")
    }


def dynamic_ids(collection):
    return {
        obj["dynamic_label_id"]
        for obj in collection.all_objects
        if obj.get("dynamic_label_id")
    }


def triangle_count(collection):
    dependency_graph = bpy.context.evaluated_depsgraph_get()
    triangles = 0
    seen_meshes = set()
    for obj in collection.all_objects:
        if obj.type != "MESH" or obj.data.as_pointer() in seen_meshes:
            continue
        seen_meshes.add(obj.data.as_pointer())
        evaluated = obj.evaluated_get(dependency_graph)
        mesh = evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles()
            triangles += len(mesh.loop_triangles)
        finally:
            evaluated.to_mesh_clear()
    return triangles


def glb_json(path):
    data = path.read_bytes()
    magic, version, total_length = struct.unpack_from("<4sII", data)
    if magic != b"glTF" or version != 2 or total_length != len(data):
        raise AssertionError("invalid GLB header")
    chunk_length, chunk_type = struct.unpack_from("<II", data, 12)
    if chunk_type != 0x4E4F534A:
        raise AssertionError("missing GLB JSON chunk")
    return json.loads(data[20 : 20 + chunk_length].decode("utf-8"))


def glb_triangle_count(payload):
    triangles = 0
    for mesh in payload["meshes"]:
        for primitive in mesh["primitives"]:
            accessor = payload["accessors"][primitive["indices"]]
            triangles += accessor["count"] // 3
    return triangles


class LodTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.lods = tuple(build_lod(level) for level in range(3))

    def test_lods_preserve_runtime_identity_and_budget(self):
        lod0, lod1, lod2 = self.lods
        expected = set(NODE_IDS)

        self.assertEqual(runtime_ids(lod0), expected)
        self.assertEqual(runtime_ids(lod0), runtime_ids(lod1))
        self.assertEqual(runtime_ids(lod1), runtime_ids(lod2))

        counts = tuple(triangle_count(lod) for lod in self.lods)
        self.assertLessEqual(counts[0], 300_000)
        self.assertLess(counts[1], counts[0])
        self.assertLess(counts[2], counts[1])
        self.assertLessEqual(counts[2], 80_000)

    def test_lods_normalize_parent_inverses_without_changing_source_world_transforms(self):
        source_by_node_id = {
            obj["node_id"]: obj
            for obj in bpy.context.scene.objects
            if obj.get(SOURCE_MARKER) and obj.get("node_id")
        }
        for level, collection in enumerate(self.lods):
            for obj in collection.all_objects:
                node_id = obj.get("node_id")
                if not node_id:
                    continue
                with self.subTest(level=level, node_id=node_id):
                    self.assertEqual(obj.matrix_parent_inverse, Matrix.Identity(4))
                    source = source_by_node_id[node_id]
                    max_delta = max(
                        abs(obj.matrix_world[row][column] - source.matrix_world[row][column])
                        for row in range(4)
                        for column in range(4)
                    )
                    self.assertLessEqual(max_delta, 1e-6)

    def test_lods_preserve_single_ink_branch_material_slots(self):
        for level, collection in enumerate(self.lods):
            branches = {
                obj["node_id"]: obj
                for obj in collection.all_objects
                if obj.get("node_id") in BRANCH_INLAY_NODE_IDS
            }
            with self.subTest(level=level):
                self.assertEqual(set(branches), set(BRANCH_INLAY_NODE_IDS))
                self.assertEqual({obj.data.materials[0]["material_family"] for obj in branches.values()}, {"M_InkText"})
            for node_id, obj in branches.items():
                with self.subTest(level=level, node_id=node_id):
                    self.assertEqual(len(obj.data.materials), 1)

    def test_lods_preserve_all_dynamic_label_surfaces(self):
        expected = set(DYNAMIC_LABEL_OWNERS)

        for level, collection in enumerate(self.lods):
            with self.subTest(level=level):
                self.assertEqual(dynamic_ids(collection), expected)
                self.assertEqual(len(dynamic_ids(collection)), 21)

    def test_lods_preserve_jade_interaction_semantics_without_baking_the_annulus(self):
        semantic_keys = {"node_id", "text_role", "runtime_color_switch", "target_earth"}
        for level, collection in enumerate(self.lods):
            by_name = {obj.name.removeprefix(f"lod{level}/"): obj for obj in collection.all_objects}
            interaction = by_name["interaction/month-general-ring"]
            self.assertEqual(interaction["node_id"], "interaction/month-general-ring")
            self.assertNotIn("runtime_atlas_id", interaction)
            for key in ("noble", "snake", "vermilion-bird", "harmony", "hook-array", "azure-dragon", "void", "white-tiger", "constant", "black-tortoise", "yin", "queen-of-heaven"):
                piece = by_name[f"general/{key}"]
                glyph = next(child for child in piece.children if child.get("text_role") == "general-name")
                self.assertTrue({"node_id", "target_earth"}.issubset(piece.keys()))
                self.assertTrue({"text_role", "runtime_color_switch", "target_earth"}.issubset(glyph.keys()))
            for name in ("胜光", "小吉", "传送", "从魁", "河魁", "登明", "神后", "大吉", "功曹", "太冲", "天罡", "太乙"):
                glyph = by_name[f"month-general/{name}"]
                self.assertTrue({"node_id", "text_role", "runtime_color_switch"}.issubset(glyph.keys()))

    def test_lods_keep_functional_text_above_the_highest_overlapping_carrier(self):
        for level, collection in enumerate(self.lods):
            by_name = {obj.name.removeprefix(f"lod{level}/"): obj for obj in collection.all_objects}
            bands = [
                obj for obj in collection.all_objects
                if obj.get("visual_role") == "linked-heaven-ring"
                or "detail/heaven/linked-ring-" in obj.name
            ]
            self.assertEqual(len(bands), 2)
            band_top = max(
                (band.matrix_world @ Vector(corner)).z
                for band in bands
                for corner in band.bound_box
            )
            earth_names = [
                obj for obj in collection.all_objects
                if obj.get("inscription_role") == "earth-branch"
            ]
            self.assertEqual(len(earth_names), 12)
            for glyph in earth_names:
                glyph_bottom = min(
                    (glyph.matrix_world @ Vector(corner)).z
                    for corner in glyph.bound_box
                )
                with self.subTest(level=level, role="earth", glyph=glyph.name):
                    self.assertGreaterEqual(glyph_bottom, band_top + 0.00009)

            month_names = [
                obj for obj in collection.all_objects
                if obj.get("text_role") == "month-general"
            ]
            self.assertEqual(len(month_names), 12)
            for glyph in month_names:
                glyph_bottom = min(
                    (glyph.matrix_world @ Vector(corner)).z
                    for corner in glyph.bound_box
                )
                with self.subTest(level=level, role="month", glyph=glyph.name):
                    self.assertGreaterEqual(glyph_bottom, band_top + 0.00009)

            general_names = [
                obj for obj in collection.all_objects
                if obj.get("text_role") == "general-name"
            ]
            self.assertEqual(len(general_names), 12)
            general_ring = by_name["plate/generals"]
            general_ring_top = max(
                (general_ring.matrix_world @ Vector(corner)).z
                for corner in general_ring.bound_box
            )
            for glyph in general_names:
                owner = glyph.parent
                self.assertEqual(owner.get("domain"), "general")
                owner_top = max(
                    (owner.matrix_world @ Vector(corner)).z
                    for corner in owner.bound_box
                )
                glyph_bottom = min(
                    (glyph.matrix_world @ Vector(corner)).z
                    for corner in glyph.bound_box
                )
                with self.subTest(level=level, role="general", glyph=glyph.name):
                    self.assertGreaterEqual(
                        glyph_bottom,
                        max(owner_top, general_ring_top) + 0.00009,
                    )

    def test_lods_export_continuous_outer_board_surface_without_voxel_relief(self):
        semantic_keys = {"node_id", "dynamic_label_id", "inscription_role", "text_role"}
        omitted_sources = [
            obj for obj in bpy.context.scene.objects
            if obj.get(SOURCE_MARKER) and (
                obj.get("surface_treatment") in {"rear-slip-seat", "shallow-slot"}
                or obj.get("role") == "fixed-historical-inscription"
            )
        ]
        self.assertTrue(omitted_sources)
        for obj in omitted_sources:
            with self.subTest(source=obj.name):
                self.assertTrue(semantic_keys.isdisjoint(obj.keys()))

        for level, collection in enumerate(self.lods):
            roles = [obj.get("visual_role") for obj in collection.all_objects]
            self.assertEqual(roles.count("zodiac-animal-relief"), 0)
            self.assertEqual(roles.count("zodiac-cloud-relief"), 0)
            self.assertEqual(roles.count("zodiac-panel-frame"), 0)
            self.assertEqual(roles.count("zodiac-panel-recess"), 0)
            self.assertFalse(any(
                obj.get("surface_treatment") in {"rear-slip-seat", "shallow-slot"}
                for obj in collection.all_objects
            ))
            self.assertFalse(any(
                obj.get("role") == "fixed-historical-inscription"
                for obj in collection.all_objects
            ))
            board = [
                obj for obj in collection.all_objects
                if obj.get("node_id") == "plate/earth"
            ]
            self.assertEqual(len(board), 1)
            for obj in board:
                with self.subTest(level=level, object=obj.name):
                    self.assertEqual(obj.get("runtime_projection"), "outer-board-v10")
                    self.assertEqual(len(obj.data.materials), 1)
                    material = obj.data.materials[0]
                    self.assertEqual(material.get("material_family"), "M_JadeBody")
                    self.assertIsNotNone(obj.data.uv_layers.get("BoardUV"))
                    self.assertTrue(material.get("source_texture", "").endswith("outer-board-v10-albedo.png"))
                    image_files = {
                        node.image.filepath.replace("\\", "/").rsplit("/", 1)[-1]
                        for node in material.node_tree.nodes
                        if node.type == "TEX_IMAGE" and node.image
                    }
                    self.assertEqual(
                        image_files,
                        {"outer-board-v10-albedo.png", "outer-board-v10-normal.png"},
                    )

            heaven = next(
                obj for obj in collection.all_objects
                if obj.get("node_id") == "plate/heaven"
            )
            self.assertEqual(heaven.get("runtime_projection"), "uniform-jade")
            self.assertEqual(
                [node for node in heaven.data.materials[0].node_tree.nodes if node.type == "TEX_IMAGE"],
                [],
            )
            by_name = {
                obj.name.removeprefix(f"lod{level}/"): obj
                for obj in collection.all_objects
            }
            for name in (
                "detail/heaven/dial-foundation",
                "detail/heaven/linked-ring-1",
                "detail/heaven/linked-ring-2",
            ):
                carrier = by_name[name]
                with self.subTest(level=level, carrier=name):
                    self.assertEqual(carrier.get("runtime_projection"), "uniform-jade")
                    self.assertEqual(
                        [node for node in carrier.data.materials[0].node_tree.nodes if node.type == "TEX_IMAGE"],
                        [],
                    )

            uniform_jade = [
                obj for obj in collection.all_objects
                if obj.get("runtime_projection") == "uniform-jade"
            ]
            self.assertEqual(
                {obj.get("node_id") for obj in uniform_jade if obj.get("node_id")},
                {"base/body", "plate/heaven", "plate/core"},
            )
            self.assertEqual(
                {obj.get("visual_role") for obj in uniform_jade if obj.get("visual_role")},
                {"corner-pearl", "jade-pivot", "rotating-dial-foundation"},
            )
            self.assertEqual(
                len([obj for obj in uniform_jade if obj.get("visual_role") == "corner-pearl"]),
                4,
            )
            for obj in uniform_jade:
                self.assertEqual(len(obj.data.materials), 1)
                material = obj.data.materials[0]
                self.assertEqual(material.get("material_family"), "M_JadeBody")
                self.assertEqual(
                    [node for node in material.node_tree.nodes if node.type == "TEX_IMAGE"],
                    [],
                )

    def test_lods_bind_each_current_source_atlas_to_the_frozen_runtime_textures(self):
        contract = json.loads(MATERIAL_CONTRACT_PATH.read_text(encoding="utf-8"))
        runtime = contract["runtimeTextures"]

        for level, collection in enumerate(self.lods):
            texture_lod = "lod2" if level == 2 else "lod0"
            bound_atlases = set()
            for obj in collection.all_objects:
                if (
                    obj.type != "MESH"
                    or obj.get("dynamic_label_id")
                    or obj.get("runtime_projection") in {"outer-board-v10", "uniform-jade"}
                    or obj.get("runtime_texture_family") == "M_TranslucentJade"
                    or _excluded_from_runtime_bake(obj)
                ):
                    continue
                atlas_id = obj["runtime_atlas_id"]
                family = obj["runtime_texture_family"]
                atlas = runtime["families"][family]["atlases"][atlas_id]
                expected_files = {
                    atlas[texture_lod][role]["file"]
                    for role in ("baseColor", "orm", "normal")
                }
                self.assertEqual(len(obj.data.materials), 1)
                material = obj.data.materials[0]
                image_files = {
                    node.image.filepath.replace("\\", "/").split("/textures/", 1)[-1]
                    for node in material.node_tree.nodes
                    if node.type == "TEX_IMAGE" and node.image
                }
                self.assertEqual(image_files, expected_files)
                bound_atlases.add(atlas_id)
            with self.subTest(level=level):
                self.assertEqual(
                    bound_atlases,
                    {
                        atlas_id
                        for family, payload in runtime["families"].items()
                        if family != "M_TranslucentJade"
                        for atlas_id in payload["atlases"]
                    },
                )

    def test_exported_lod_contains_runtime_and_texture_extras(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "artifact-lod0.glb"
            before_export = set(bpy.data.objects)
            export_lod(0, output)
            payload = glb_json(output)
            exported = set(bpy.data.objects) - before_export
            exported_core = next(obj for obj in exported if obj.get("node_id") == "plate/core")
            dependency_graph = bpy.context.evaluated_depsgraph_get()
            evaluated = exported_core.evaluated_get(dependency_graph)
            mesh = evaluated.to_mesh()
            try:
                layer = mesh.uv_layers["UVMap"]
                expected_uv_bounds = (
                    min(item.uv.x for item in layer.data),
                    max(item.uv.x for item in layer.data),
                    min(item.uv.y for item in layer.data),
                    max(item.uv.y for item in layer.data),
                )
            finally:
                evaluated.to_mesh_clear()
            before_import = set(bpy.data.objects)
            bpy.ops.import_scene.gltf(filepath=str(output))
            imported = set(bpy.data.objects) - before_import
            core = next(obj for obj in imported if obj.get("node_id") == "plate/core")
            layer = core.data.uv_layers["UVMap"]
            actual_uv_bounds = (
                min(item.uv.x for item in layer.data),
                max(item.uv.x for item in layer.data),
                min(item.uv.y for item in layer.data),
                max(item.uv.y for item in layer.data),
            )
            for obj in imported:
                bpy.data.objects.remove(obj, do_unlink=True)

        for actual, expected in zip(actual_uv_bounds, expected_uv_bounds):
            self.assertAlmostEqual(actual, expected, places=5)

        runtime = {
            node.get("extras", {}).get("node_id")
            for node in payload["nodes"]
            if node.get("extras", {}).get("node_id")
        }
        dynamic = {
            node.get("extras", {}).get("dynamic_label_id")
            for node in payload["nodes"]
            if node.get("extras", {}).get("dynamic_label_id")
        }
        self.assertEqual(runtime, set(NODE_IDS))
        self.assertEqual(dynamic, set(DYNAMIC_LABEL_OWNERS))
        self.assertEqual(
            len(payload["images"]),
            2 + 3 * sum(
                len(item["atlases"])
                for family, item in json.loads(MATERIAL_CONTRACT_PATH.read_text(encoding="utf-8"))["runtimeTextures"]["families"].items()
                if family != "M_TranslucentJade"
            ),
        )
        self.assertLessEqual(glb_triangle_count(payload), 300_000)

        normal_mapped_materials = {
            index
            for index, material in enumerate(payload["materials"])
            if "normalTexture" in material
        }
        for mesh in payload["meshes"]:
            for primitive in mesh["primitives"]:
                if primitive.get("material") in normal_mapped_materials:
                    self.assertIn("TANGENT", primitive["attributes"])

    def test_exported_lods_preserve_translucent_general_material_extensions(self):
        for level in range(3):
            with tempfile.TemporaryDirectory() as directory:
                output = Path(directory) / f"artifact-lod{level}.glb"
                export_lod(level, output)
                payload = glb_json(output)
            materials = payload["materials"]
            general_nodes = [
                node for node in payload["nodes"]
                if node.get("extras", {}).get("node_id") == "general/noble"
            ]
            self.assertEqual(len(general_nodes), 1)
            primitive = payload["meshes"][general_nodes[0]["mesh"]]["primitives"][0]
            material = materials[primitive["material"]]
            with self.subTest(level=level):
                self.assertEqual(material.get("extras", {}).get("material_family"), "M_TranslucentJade")
                extensions = material.get("extensions", {})
                self.assertAlmostEqual(extensions["KHR_materials_ior"]["ior"], 1.48, places=6)
                self.assertAlmostEqual(extensions["KHR_materials_transmission"]["transmissionFactor"], 0.12, places=6)
                self.assertAlmostEqual(material["extras"]["modeled_thickness_m"], 0.004, places=6)


if __name__ == "__main__":
    unittest.main(argv=[__file__])
