import json
import sys
import unittest
from pathlib import Path

import bpy

BLENDER_DIR = Path(__file__).parents[1]
REPOSITORY_ROOT = Path(__file__).parents[3]
FIXTURE = REPOSITORY_ROOT / "assets/daliuren/inscriptions/fixed-inscriptions.json"
FONT = REPOSITORY_ROOT / "assets/daliuren/fonts/NotoSerifCJKsc-Regular.otf"
FONT_RELEASE_URL = (
    "https://github.com/notofonts/noto-cjk/releases/download/Serif2.003/"
    "09_NotoSerifCJKsc.zip"
)

sys.path.insert(0, str(BLENDER_DIR))

from build_graybox import build_graybox
from inscriptions import build_fixed_inscriptions, load_fixed_inscriptions


HISTORICAL_ROLES = {
    "historical-beidou",
    "historical-mansion",
    "historical-month-deity",
}
DYNAMIC_PARENT_PREFIXES = (
    "calendar/slip",
    "lesson/",
    "transmission/",
    "general/",
)


class InscriptionTest(unittest.TestCase):
    def test_fixed_inscriptions_have_complete_non_dynamic_sets(self):
        items = load_fixed_inscriptions(FIXTURE)
        earth = [item.text for item in items if item.role == "earth-branch"]
        mansions = [item for item in items if item.role == "historical-mansion"]
        deities = [item for item in items if item.role == "historical-month-deity"]

        self.assertIsInstance(items, tuple)
        self.assertEqual(earth, list("子丑寅卯辰巳午未申酉戌亥"))
        self.assertEqual(len(mansions), 28)
        self.assertEqual(len(deities), 12)
        self.assertEqual(
            {item.role for item in items},
            {
                "earth-branch",
                "historical-beidou",
                "historical-mansion",
                "historical-month-deity",
                "mechanical-scale",
            },
        )
        forbidden = {"贵人", "初传", "中传", "末传", "父母", "官鬼"}
        self.assertTrue(forbidden.isdisjoint({item.text for item in items}))

    def test_contract_records_explicit_geometry_and_pinned_font_source(self):
        payload = json.loads(FIXTURE.read_text(encoding="utf-8"))

        self.assertEqual(payload["font"]["releaseUrl"], FONT_RELEASE_URL)
        self.assertRegex(payload["font"]["zipSha256"], r"^[0-9a-f]{64}$")
        self.assertTrue(FONT.is_file())
        self.assertGreater(FONT.stat().st_size, 10_000_000)
        for item in payload["inscriptions"]:
            with self.subTest(text=item.get("text"), role=item.get("role")):
                self.assertEqual(
                    set(item),
                    {
                        "role",
                        "text",
                        "angularIndex",
                        "radius",
                        "depth",
                        "contrastTier",
                    },
                )
                self.assertIsInstance(item["angularIndex"], int)
                self.assertGreater(item["radius"], 0)
                self.assertGreater(item["depth"], 0)

    def test_builder_creates_only_fixed_mesh_text_under_fixed_geometry(self):
        build_graybox()
        fixed_parent = bpy.data.objects["plate/heaven"]

        objects = build_fixed_inscriptions(fixed_parent, FONT)
        items = load_fixed_inscriptions(FIXTURE)

        self.assertEqual(len(objects), len(items))
        self.assertTrue(objects)
        self.assertTrue(all(obj.type == "MESH" for obj in objects))
        self.assertTrue(all(obj.parent is fixed_parent for obj in objects))
        self.assertTrue(all("node_id" not in obj for obj in objects))
        self.assertEqual(
            [(obj["inscription_role"], obj["contrast_tier"]) for obj in objects],
            [(item.role, item.contrast_tier) for item in items],
        )
        for obj in objects:
            with self.subTest(object=obj.name):
                lineage = []
                parent = obj.parent
                while parent is not None:
                    lineage.append(parent.name)
                    parent = parent.parent
                self.assertFalse(
                    any(
                        name == prefix or name.startswith(prefix)
                        for name in lineage
                        for prefix in DYNAMIC_PARENT_PREFIXES
                    )
                )

    def test_historical_engraving_is_shallower_than_functional_inlay(self):
        build_graybox()
        objects = build_fixed_inscriptions(bpy.data.objects["plate/heaven"], FONT)

        historical_depths = [
            obj["inscription_depth"]
            for obj in objects
            if obj["inscription_role"] in HISTORICAL_ROLES
        ]
        functional_depths = [
            obj["inscription_depth"]
            for obj in objects
            if obj["inscription_role"] == "mechanical-scale"
        ]
        self.assertTrue(historical_depths)
        self.assertTrue(functional_depths)
        self.assertLess(max(historical_depths), min(functional_depths))
        self.assertEqual(
            {obj["contrast_tier"] for obj in objects if obj["inscription_role"] in HISTORICAL_ROLES},
            {"historical-low"},
        )
        self.assertEqual(
            {obj["contrast_tier"] for obj in objects if obj["inscription_role"] == "mechanical-scale"},
            {"functional-high"},
        )


if __name__ == "__main__":
    unittest.main(argv=[__file__])
