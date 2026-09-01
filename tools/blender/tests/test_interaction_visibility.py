import json
import struct
import sys
import unittest
from pathlib import Path

import bpy


BLENDER_DIR = Path(__file__).parents[1]
REPOSITORY_ROOT = Path(__file__).parents[3]
ASSET_CONTRACT = REPOSITORY_ROOT / "assets/daliuren/asset-contract.json"
MODEL_ROOT = REPOSITORY_ROOT / "public/models/daliuren"
sys.path.insert(0, str(BLENDER_DIR))

from build_graybox import build_master
def glb_json(path):
    data = path.read_bytes()
    length, chunk_type = struct.unpack_from("<II", data, 12)
    if chunk_type != 0x4E4F534A:
        raise AssertionError("missing GLB JSON chunk")
    return json.loads(data[20 : 20 + length].decode("utf-8"))


class InteractionVisibilityTests(unittest.TestCase):
    def tearDown(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def test_master_interaction_annulus_is_raycast_only_before_render(self):
        build_master()
        interaction = bpy.data.objects["interaction/month-general-ring"]
        material = interaction.data.materials[0]

        self.assertEqual(interaction["runtime_visibility"], "raycast-only")
        self.assertFalse(interaction["color_write"])
        self.assertFalse(interaction["depth_write"])
        self.assertEqual(material.name, "M_InteractionRaycast")
        self.assertEqual(material["runtime_visibility"], "raycast-only")
        self.assertEqual(material.surface_render_method, "DITHERED")
        self.assertEqual(material.node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value, 0.0)
        self.assertTrue(any(node.type == "BSDF_TRANSPARENT" for node in material.node_tree.nodes))

        contract = json.loads(ASSET_CONTRACT.read_text(encoding="utf-8"))
        self.assertEqual(
            contract["runtimeAssets"]["interactionSurfaces"]["interaction/month-general-ring"],
            {
                "material": "M_InteractionRaycast",
                "runtimeVisibility": "raycast-only",
                "colorWrite": False,
                "depthWrite": False,
            },
        )

    def test_exported_lods_keep_a_transparent_raycast_annulus(self):
        for level in range(3):
            payload = glb_json(MODEL_ROOT / f"daliuren-artifact-lod{level}.glb")
            node = next(item for item in payload["nodes"] if item.get("name", "").endswith("/interaction/month-general-ring"))
            material = payload["materials"][payload["meshes"][node["mesh"]]["primitives"][0]["material"]]
            with self.subTest(level=level):
                self.assertEqual(node["extras"]["runtime_visibility"], "raycast-only")
                self.assertFalse(node["extras"]["color_write"])
                self.assertFalse(node["extras"]["depth_write"])
                self.assertEqual(material["name"], "M_InteractionRaycast")
                self.assertEqual(material["alphaMode"], "MASK")
                self.assertEqual(material["alphaCutoff"], 0.5)
                self.assertEqual(material["pbrMetallicRoughness"]["baseColorFactor"][3], 0.0)


if __name__ == "__main__":
    unittest.main(argv=[__file__])
