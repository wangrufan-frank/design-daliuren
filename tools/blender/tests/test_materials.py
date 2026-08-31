import json
import sys
import tempfile
import unittest
from pathlib import Path

import bpy


BLENDER_DIR = Path(__file__).parents[1]
REPOSITORY_ROOT = Path(__file__).parents[3]
ASSET_CONTRACT = REPOSITORY_ROOT / "assets/daliuren/asset-contract.json"
BRANCHES = tuple("子丑寅卯辰巳午未申酉戌亥")
MATERIAL_NAMES = {
    "M_Bronze",
    "M_Patina",
    "M_Celadon",
    "M_OldGold",
    "M_AshText",
    "M_EarthVoid",
    "M_HeavenVoid",
}
PALETTE = {
    "ink": "#27231F",
    "bronze": "#E5DED0",
    "patina": "#C8BDAA",
    "celadon": "#F2EEE5",
    "ash": "#2B2926",
    "oldGold": "#B98A38",
    "earthVoid": "#A94B34",
    "heavenVoid": "#315F73",
}

sys.path.insert(0, str(BLENDER_DIR))

from build_graybox import build_master
from materials import PALETTE as IMPLEMENTED_PALETTE
from materials import build_master_materials


def linear_channel(value):
    value /= 255.0
    if value <= 0.04045:
        return value / 12.92
    return ((value + 0.055) / 1.055) ** 2.4


def linear_hex(value):
    return tuple(
        linear_channel(int(value[index:index + 2], 16)) for index in (1, 3, 5)
    )


def principled(material):
    nodes = [
        node
        for node in material.node_tree.nodes
        if node.bl_idname == "ShaderNodeBsdfPrincipled"
    ]
    if len(nodes) != 1:
        raise AssertionError(f"{material.name} has {len(nodes)} Principled nodes")
    return nodes[0]


class MaterialTest(unittest.TestCase):
    def tearDown(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def assertColorClose(self, actual, expected):
        for actual_channel, expected_channel in zip(actual[:3], expected):
            self.assertAlmostEqual(actual_channel, expected_channel, places=6)

    def test_master_materials_use_exact_bright_palette_and_roughness(self):
        materials = build_master_materials()

        self.assertEqual(IMPLEMENTED_PALETTE, PALETTE)
        self.assertEqual({material.name for material in materials}, MATERIAL_NAMES)
        expected = {
            "M_Bronze": ("#E5DED0", 0.38),
            "M_Patina": ("#C8BDAA", 0.58),
            "M_Celadon": ("#F2EEE5", 0.27),
            "M_OldGold": ("#B98A38", 0.48),
            "M_AshText": ("#2B2926", 0.48),
            "M_EarthVoid": ("#A94B34", 0.52),
            "M_HeavenVoid": ("#315F73", 0.52),
        }
        for name, (color, roughness) in expected.items():
            shader = principled(bpy.data.materials[name])
            with self.subTest(material=name):
                self.assertColorClose(
                    shader.inputs["Base Color"].default_value,
                    linear_hex(color),
                )
                self.assertAlmostEqual(
                    shader.inputs["Roughness"].default_value,
                    roughness,
                )
                if name != "M_Celadon":
                    self.assertFalse(shader.inputs["Roughness"].is_linked)

    def test_asset_contract_exposes_both_void_material_families(self):
        contract = json.loads(ASSET_CONTRACT.read_text(encoding="utf-8"))
        families = contract["runtimeAssets"]["materialFamilies"]

        self.assertEqual(set(families), MATERIAL_NAMES)
        self.assertIn("M_EarthVoid", families)
        self.assertIn("M_HeavenVoid", families)

    def test_each_branch_owns_a_unique_normal_fill_material_instance(self):
        build_master()

        branches = [
            bpy.data.objects[f"branch/{surface}/{branch}"]
            for surface in ("earth", "heaven")
            for branch in BRANCHES
        ]
        materials = [obj.data.materials[0] for obj in branches]
        self.assertEqual(len({material.as_pointer() for material in materials}), 24)
        for surface, family in (("earth", "M_AshText"), ("heaven", "M_AshText")):
            for branch in BRANCHES:
                obj = bpy.data.objects[f"branch/{surface}/{branch}"]
                material = obj.data.materials[0]
                with self.subTest(surface=surface, branch=branch):
                    self.assertEqual(obj["material_role"], family)
                    self.assertEqual(material["material_family"], family)
                    self.assertTrue(material.name.startswith(f"{family}/branch/{surface}/"))
                    self.assertAlmostEqual(
                        principled(material).inputs["Roughness"].default_value,
                        0.48,
                    )

    def test_branch_beds_share_non_emissive_ink_bronze_material(self):
        build_master()

        beds = [
            obj
            for obj in bpy.data.objects
            if obj.get("detail_id") == "structure/bronze-inlay-branch-bed"
        ]
        self.assertEqual(len(beds), 24)
        materials = {obj.data.materials[0] for obj in beds}
        self.assertEqual(len(materials), 1)
        material = materials.pop()
        self.assertEqual(material.name, "M_Bronze/branch-bed")
        self.assertEqual(material["material_family"], "M_Bronze")
        shader = principled(material)
        self.assertColorClose(
            shader.inputs["Base Color"].default_value,
            linear_hex(PALETTE["ink"]),
        )
        self.assertAlmostEqual(shader.inputs["Roughness"].default_value, 0.62)
        self.assertEqual(shader.inputs["Specular IOR Level"].default_value, 0.0)
        self.assertFalse(
            any("Emission" in node.bl_idname or "Emission" in node.name for node in material.node_tree.nodes)
        )

    def test_material_graphs_contain_no_emissive_nodes(self):
        build_master()

        emissive = [
            (material.name, node.name)
            for material in bpy.data.materials
            if material.use_nodes
            for node in material.node_tree.nodes
            if "Emission" in node.bl_idname or "Emission" in node.name
        ]
        self.assertEqual(emissive, [])

    def test_materialized_master_reopens_with_unique_branch_ownership(self):
        build_master()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "master.blend"
            bpy.ops.wm.save_as_mainfile(filepath=str(path))
            bpy.ops.wm.open_mainfile(filepath=str(path))

            branches = [
                obj
                for obj in bpy.data.objects
                if isinstance(obj.get("node_id"), str)
                and obj["node_id"].startswith("branch/")
            ]
            self.assertEqual(len(branches), 24)
            self.assertEqual(
                len({obj.data.materials[0].as_pointer() for obj in branches}),
                24,
            )
            self.assertEqual(
                {obj["material_role"] for obj in branches},
                {"M_AshText"},
            )


if __name__ == "__main__":
    unittest.main(argv=[__file__])
