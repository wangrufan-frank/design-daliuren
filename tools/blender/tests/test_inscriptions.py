import copy
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

import bpy
from mathutils import Vector

BLENDER_DIR = Path(__file__).parents[1]
REPOSITORY_ROOT = Path(__file__).parents[3]
FIXTURE = REPOSITORY_ROOT / "assets/daliuren/inscriptions/fixed-inscriptions.json"
FONT = REPOSITORY_ROOT / "assets/daliuren/fonts/NotoSerifCJKsc-Regular.otf"
OFL = REPOSITORY_ROOT / "assets/daliuren/fonts/OFL.txt"
FONT_RELEASE_URL = (
    "https://github.com/notofonts/noto-cjk/releases/download/Serif2.003/"
    "09_NotoSerifCJKsc.zip"
)
ZIP_SHA256 = "4bcdbff95cedfb6a4c0640403f0de8b69480d869331c24c8eff91f7bb834df04"
FONT_SHA256 = "2a2eae2628df83556c54018c41e20fa532c1b862c5256ae8b3f23feb918d12ca"
OFL_SHA256 = "6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2"

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
EXPECTED_TEXTS = {
    "earth-branch": (
        "子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥",
    ),
    "historical-beidou": (
        "天枢", "天璇", "天玑", "天权", "玉衡", "开阳", "摇光",
    ),
    "historical-mansion": (
        "角", "亢", "氐", "房", "心", "尾", "箕", "斗", "牛", "女", "虚", "危", "室", "壁",
        "奎", "娄", "胃", "昴", "毕", "觜", "参", "井", "鬼", "柳", "星", "张", "翼", "轸",
    ),
    "historical-month-deity": (
        "神后", "大吉", "功曹", "太冲", "天罡", "太乙", "胜光", "小吉", "传送", "从魁", "河魁", "登明",
    ),
    "mechanical-scale": (
        "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二",
    ),
}
EXPECTED_ANGULAR_INDICES = {
    "earth-branch": (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11),
    "historical-beidou": (0, 1, 2, 3, 4, 5, 6),
    "historical-mansion": (
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
        14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
    ),
    "historical-month-deity": (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11),
    "mechanical-scale": (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11),
}


def world_z_bounds(obj):
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return min(point.z for point in points), max(point.z for point in points)


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


class InscriptionTest(unittest.TestCase):
    def test_fixed_inscriptions_have_complete_non_dynamic_sets(self):
        items = load_fixed_inscriptions(FIXTURE)

        self.assertIsInstance(items, tuple)
        self.assertEqual(len(items), 71)
        for role, expected_texts in EXPECTED_TEXTS.items():
            role_items = tuple(item for item in items if item.role == role)
            with self.subTest(role=role):
                self.assertEqual(tuple(item.text for item in role_items), expected_texts)
                self.assertEqual(
                    tuple(item.angular_index for item in role_items),
                    EXPECTED_ANGULAR_INDICES[role],
                )
                self.assertEqual(len({item.text for item in role_items}), len(role_items))
                self.assertEqual(
                    len({item.angular_index for item in role_items}), len(role_items)
                )
        forbidden = {"贵人", "初传", "中传", "末传", "父母", "官鬼"}
        self.assertTrue(forbidden.isdisjoint({item.text for item in items}))

    def test_contract_records_explicit_geometry_and_pinned_font_source(self):
        payload = json.loads(FIXTURE.read_text(encoding="utf-8"))

        self.assertEqual(payload["font"]["releaseUrl"], FONT_RELEASE_URL)
        self.assertEqual(payload["font"]["zipSha256"], ZIP_SHA256)
        self.assertEqual(sha256(FONT), FONT_SHA256)
        self.assertEqual(sha256(OFL), OFL_SHA256)
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
                self.assertIsInstance(item["role"], str)
                self.assertIn(item["role"], EXPECTED_TEXTS)
                self.assertIsInstance(item["text"], str)
                self.assertTrue(item["text"])
                self.assertIsInstance(item["contrastTier"], str)
                self.assertIn(
                    item["contrastTier"], {"functional-high", "historical-low"}
                )
                self.assertIsInstance(item["angularIndex"], int)
                self.assertGreater(item["radius"], 0)
                self.assertGreater(item["depth"], 0)

    def test_loader_rejects_corrupt_fixed_contracts(self):
        payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
        corruptions = (
            ("unknown role", 0, "role", "dynamic-label"),
            ("non-string text", 0, "text", 42),
            ("unknown contrast", 0, "contrastTier", "raised-relief"),
            ("duplicate angular index", 1, "angularIndex", 0),
            ("duplicate fixed text", 1, "text", "子"),
        )
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fixed-inscriptions.json"
            for label, item_index, key, value in corruptions:
                corrupt = copy.deepcopy(payload)
                corrupt["inscriptions"][item_index][key] = value
                path.write_text(json.dumps(corrupt, ensure_ascii=False), encoding="utf-8")
                with self.subTest(label=label):
                    with self.assertRaises((TypeError, ValueError)):
                        load_fixed_inscriptions(path)

    def test_builder_creates_only_fixed_mesh_text_under_fixed_geometry(self):
        build_graybox()
        fixed_parent = bpy.data.objects["plate/heaven"]

        objects = build_fixed_inscriptions(fixed_parent, FONT)
        items = load_fixed_inscriptions(FIXTURE)

        self.assertEqual(len(objects), len(items))
        self.assertTrue(objects)
        self.assertTrue(all(obj.type == "MESH" for obj in objects))
        self.assertTrue(all(len(obj.data.vertices) > 0 for obj in objects))
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
        loaded_font_paths = {
            Path(bpy.path.abspath(font.filepath)).resolve()
            for font in bpy.data.fonts
            if font.filepath
        }
        self.assertIn(FONT.resolve(), loaded_font_paths)

    def test_historical_cutters_and_functional_inlays_intersect_plate_from_below(self):
        build_graybox()
        plate = bpy.data.objects["plate/heaven"]
        objects = build_fixed_inscriptions(plate, FONT)
        _, surface_z = world_z_bounds(plate)

        historical_objects = [
            obj
            for obj in objects
            if obj["inscription_role"] in HISTORICAL_ROLES
        ]
        functional_objects = [
            obj
            for obj in objects
            if obj["inscription_role"] == "mechanical-scale"
        ]
        for obj in historical_objects + functional_objects:
            minimum_z, maximum_z = world_z_bounds(obj)
            with self.subTest(object=obj.name):
                self.assertLess(minimum_z, surface_z - 0.00001)
                self.assertAlmostEqual(maximum_z, surface_z, places=6)
                expected_treatment = (
                    "engraving-cutter"
                    if obj["inscription_role"] in HISTORICAL_ROLES
                    else "flush-inlay"
                )
                self.assertEqual(obj["surface_treatment"], expected_treatment)
        historical_thicknesses = [
            maximum_z - minimum_z
            for minimum_z, maximum_z in map(world_z_bounds, historical_objects)
        ]
        functional_thicknesses = [
            maximum_z - minimum_z
            for minimum_z, maximum_z in map(world_z_bounds, functional_objects)
        ]
        self.assertLess(max(historical_thicknesses), min(functional_thicknesses))
        self.assertEqual(
            {obj["contrast_tier"] for obj in objects if obj["inscription_role"] in HISTORICAL_ROLES},
            {"historical-low"},
        )
        self.assertEqual(
            {obj["contrast_tier"] for obj in objects if obj["inscription_role"] == "mechanical-scale"},
            {"functional-high"},
        )

    def test_builder_rejects_dynamic_parent_or_dynamic_ancestor_without_side_effects(self):
        prohibited_parents = (
            "calendar/slip",
            "lesson/first",
            "transmission/bridge",
            "general/noble",
        )
        for name in prohibited_parents:
            build_graybox()
            count_before = len(bpy.data.objects)
            with self.subTest(parent=name):
                with self.assertRaises(ValueError):
                    build_fixed_inscriptions(bpy.data.objects[name], FONT)
                self.assertEqual(len(bpy.data.objects), count_before)

        build_graybox()
        helper = bpy.data.objects.new("fixed-looking-helper", None)
        bpy.context.scene.collection.objects.link(helper)
        helper.parent = bpy.data.objects["lesson/first"]
        count_before = len(bpy.data.objects)
        with self.assertRaises(ValueError):
            build_fixed_inscriptions(helper, FONT)
        self.assertEqual(len(bpy.data.objects), count_before)


if __name__ == "__main__":
    unittest.main(argv=[__file__])
