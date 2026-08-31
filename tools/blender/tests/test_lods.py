import sys
import unittest
import json
import struct
import tempfile
from pathlib import Path

import bpy


BLENDER_DIR = Path(__file__).parents[1]
REPOSITORY_ROOT = Path(__file__).parents[3]
MATERIAL_CONTRACT_PATH = REPOSITORY_ROOT / "assets/daliuren/materials/material-contract.json"
sys.path.insert(0, str(BLENDER_DIR))

from build_lods import build_lod
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

    def test_lods_bind_each_current_source_atlas_to_the_frozen_runtime_textures(self):
        contract = json.loads(MATERIAL_CONTRACT_PATH.read_text(encoding="utf-8"))
        runtime = contract["runtimeTextures"]

        for level, collection in enumerate(self.lods):
            texture_lod = "lod2" if level == 2 else "lod0"
            bound_atlases = set()
            for obj in collection.all_objects:
                if obj.type != "MESH" or obj.get("dynamic_label_id") or _excluded_from_runtime_bake(obj):
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
                        for payload in runtime["families"].values()
                        for atlas_id in payload["atlases"]
                    },
                )

    def test_exported_lod_contains_runtime_and_texture_extras(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "artifact-lod0.glb"
            export_lod(0, output)
            payload = glb_json(output)

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
            3 * sum(len(item["atlases"]) for item in json.loads(MATERIAL_CONTRACT_PATH.read_text(encoding="utf-8"))["runtimeTextures"]["families"].values()),
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


if __name__ == "__main__":
    unittest.main(argv=[__file__])
