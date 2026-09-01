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
GENERAL_KEYS = (
    "noble", "snake", "vermilion-bird", "harmony", "hook-array", "azure-dragon",
    "void", "white-tiger", "constant", "black-tortoise", "yin", "queen-of-heaven",
)
MONTH_GENERAL_NAMES = ("胜光", "小吉", "传送", "从魁", "河魁", "登明", "神后", "大吉", "功曹", "太冲", "天罡", "太乙")
MATERIAL_NAMES = {
    "M_JadeBody", "M_TranslucentJade", "M_JadeRecess",
    "M_InkText", "M_CinnabarText", "M_OldGold",
}
PALETTE = {
    "ink": "#15110D",
    "jadeBody": "#F2EEE5",
    "jadeRecess": "#E8E4DB",
    "cinnabar": "#A33A25",
    "oldGold": "#B98A38",
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

    def test_master_materials_use_the_six_physical_jade_families(self):
        materials = build_master_materials()

        self.assertEqual(IMPLEMENTED_PALETTE, PALETTE)
        self.assertEqual({material.name for material in materials}, MATERIAL_NAMES)
        expected = {
            "M_JadeBody": ("#F2EEE5", 0.27),
            "M_TranslucentJade": ("#F2EEE5", 0.24),
            "M_JadeRecess": ("#E8E4DB", 0.34),
            "M_InkText": ("#15110D", 0.48),
            "M_CinnabarText": ("#A33A25", 0.48),
            "M_OldGold": ("#B98A38", 0.38),
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
                self.assertFalse(shader.inputs["Roughness"].is_linked)
        translucent = principled(bpy.data.materials["M_TranslucentJade"])
        self.assertAlmostEqual(translucent.inputs["IOR"].default_value, 1.48)
        self.assertAlmostEqual(translucent.inputs["Transmission Weight"].default_value, 0.12)
        self.assertAlmostEqual(translucent.inputs["Coat Weight"].default_value, 0.16)
        self.assertAlmostEqual(translucent.inputs["Emission Strength"].default_value, 0.36)
        self.assertEqual(bpy.data.materials["M_TranslucentJade"]["modeled_thickness_m"], 0.004)
        recess = principled(bpy.data.materials["M_JadeRecess"])
        self.assertAlmostEqual(recess.inputs["Emission Strength"].default_value, 0.42)

    def test_asset_contract_exposes_only_the_six_runtime_material_families(self):
        contract = json.loads(ASSET_CONTRACT.read_text(encoding="utf-8"))
        families = contract["runtimeAssets"]["materialFamilies"]

        self.assertEqual(set(families), MATERIAL_NAMES)
        self.assertNotIn("M_ReferenceSurface", families)

    def test_material_contract_describes_the_six_jade_families_without_legacy_metals(self):
        contract = json.loads((REPOSITORY_ROOT / "assets/daliuren/materials/material-contract.json").read_text(encoding="utf-8"))

        self.assertEqual(set(contract["materials"]), MATERIAL_NAMES)
        self.assertNotRegex(json.dumps(contract, ensure_ascii=False).lower(), "bronze|patina|celadon")
        self.assertEqual(
            set(contract["masks"]),
            {"mask_contact_wear", "mask_recess_tone", "mask_insert_dirt", "mask_jade_microtexture"},
        )

    def test_jade_inlays_are_translucent_but_general_text_is_independent(self):
        build_master()

        for key in GENERAL_KEYS:
            piece = bpy.data.objects[f"general/{key}"]
            glyph = next(child for child in piece.children if child.get("text_role") == "general-name")
            with self.subTest(general=key):
                self.assertEqual(piece["material_role"], "M_TranslucentJade")
                self.assertEqual(glyph["material_role"], "M_InkText")
                self.assertIsNot(piece.data.materials[0], glyph.data.materials[0])

    def test_month_glyphs_are_cinnabar_and_runtime_switchable(self):
        build_master()
        for name in MONTH_GENERAL_NAMES:
            glyph = bpy.data.objects[f"month-general/{name}"]
            with self.subTest(month=name):
                self.assertEqual(glyph["material_role"], "M_CinnabarText")
                self.assertTrue(glyph["runtime_color_switch"])
                self.assertEqual(glyph["text_role"], "month-general")

    def test_rotating_jade_dial_uses_the_pale_recess_surface_not_blackened_body_shader(self):
        build_master()
        for name in (
            "plate/heaven",
            "detail/heaven/dial-foundation",
            "detail/heaven/linked-ring-1",
            "detail/heaven/linked-ring-2",
            "plate/generals",
            "plate/core",
        ):
            dial = bpy.data.objects[name]
            with self.subTest(dial=name):
                self.assertEqual(dial["material_role"], "M_JadeRecess")
                self.assertEqual(dial.data.materials[0].name, "M_JadeRecess")

    def test_earth_glyphs_and_slot_walls_use_their_fixed_jade_roles(self):
        build_master()
        for branch in BRANCHES:
            self.assertEqual(bpy.data.objects[f"branch/earth/{branch}"]["material_role"], "M_InkText")
            self.assertEqual(bpy.data.objects[f"detail/general-recess/{branch}"]["material_role"], "M_JadeRecess")

    def test_zodiac_reliefs_use_deterministic_motif_images_and_bump_relief(self):
        build_master()

        motifs = [
            obj for obj in bpy.data.objects
            if obj.get("visual_role") == "zodiac-animal-relief"
        ]
        self.assertEqual(len(motifs), 12)
        for motif in motifs:
            material = motif.data.materials[0]
            image_nodes = [node for node in material.node_tree.nodes if node.type == "TEX_IMAGE"]
            with self.subTest(animal=motif["zodiac_animal"]):
                self.assertEqual(motif["material_role"], "M_JadeBody")
                self.assertEqual(len(image_nodes), 1)
                self.assertTrue(image_nodes[0].image.filepath.replace("\\", "/").endswith(
                    f"zodiac/{motif['zodiac_animal']}.png"
                ))
                self.assertTrue(any(node.type == "BUMP" for node in material.node_tree.nodes))

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

    def test_materialized_master_reopens_with_exact_jade_ownership(self):
        build_master()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "master.blend"
            bpy.ops.wm.save_as_mainfile(filepath=str(path))
            bpy.ops.wm.open_mainfile(filepath=str(path))

            self.assertEqual(
                {obj["material_role"] for obj in bpy.data.objects if obj.get("text_role") == "general-name"},
                {"M_InkText"},
            )


if __name__ == "__main__":
    unittest.main(argv=[__file__])
