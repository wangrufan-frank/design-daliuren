import math
import sys
import unittest
from pathlib import Path

import bpy


sys.path.insert(0, str(Path(__file__).parents[1]))

from build_graybox import build_master
from daliuren_contract import DIAL_CENTER_OFFSET_M
from reference_calibration import calibrate_v10_camera, projection_metrics
from render_lookdev_review import build_lookdev_scene


class V10HeroRefinementTest(unittest.TestCase):
    def setUp(self):
        build_master()

    def tearDown(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def test_fixed_hero_camera_rejects_the_previous_visible_structure_misalignment(self):
        scene = build_lookdev_scene()
        calibrate_v10_camera(scene)
        metrics = projection_metrics(scene)

        limits = {
            "board_rms_px": 7.0,
            "dial_center_error_px": 4.0,
            "pearl_rms_px": 4.0,
            "beidou_rms_px": 4.0,
            "rim_rms_px": 10.0,
            "branch_rms_px": 12.0,
            "month_rms_px": 7.0,
            "general_rms_px": 9.0,
            "rms_px": 8.0,
        }
        for metric, limit in limits.items():
            with self.subTest(metric=metric):
                self.assertLessEqual(metrics[metric], limit)

    def test_functional_glyphs_match_the_reference_ring_hierarchy(self):
        branches = [bpy.data.objects[f"branch/earth/{name}"] for name in "子丑寅卯辰巳午未申酉戌亥"]
        months = [obj for obj in bpy.data.objects if obj.get("text_role") == "month-general"]
        generals = [obj for obj in bpy.data.objects if obj.get("text_role") == "general-name"]

        self.assertTrue(all(max(obj.dimensions.x, obj.dimensions.y) <= 0.016 for obj in branches))
        self.assertTrue(all(math.dist(obj.location.xy, DIAL_CENTER_OFFSET_M) <= 0.145 for obj in branches))
        self.assertTrue(all(0.016 <= max(obj.dimensions.x, obj.dimensions.y) <= 0.020 for obj in months))
        self.assertTrue(all(0.012 <= max(obj.dimensions.x, obj.dimensions.y) <= 0.016 for obj in generals))

    def test_visible_ring_craft_has_continuous_grooves_pearl_seats_and_bright_core(self):
        grooves = [obj for obj in bpy.data.objects if obj.get("visual_role") == "ring-groove"]
        pearl_seats = [obj for obj in bpy.data.objects if obj.get("visual_role") == "pearl-seat"]
        stars = [obj for obj in bpy.data.objects if obj.get("visual_role") == "beidou-star"]
        pivot = bpy.data.objects["detail/core/jade-pivot"]

        self.assertGreaterEqual(len(grooves), 5)
        self.assertEqual(len(pearl_seats), 4)
        self.assertTrue(all(max(obj.dimensions.x, obj.dimensions.y) >= 0.0052 for obj in stars))
        self.assertGreaterEqual(max(pivot.dimensions.x, pivot.dimensions.y), 0.015)

    def test_exposed_jade_is_warm_white_while_inlays_keep_confirmed_optics(self):
        body = bpy.data.materials["M_JadeBody"].node_tree.nodes["Principled BSDF"]
        recess = bpy.data.materials["M_JadeRecess"].node_tree.nodes["Principled BSDF"]
        inlay = bpy.data.materials["M_TranslucentJade"].node_tree.nodes["Principled BSDF"]

        for shader in (body, recess):
            red, green, blue, _ = shader.inputs["Base Color"].default_value
            self.assertGreater(red, green)
            self.assertGreater(green, blue)
        self.assertAlmostEqual(inlay.inputs["IOR"].default_value, 1.48)
        self.assertEqual(bpy.data.materials["M_TranslucentJade"]["modeled_thickness_m"], 0.004)


if __name__ == "__main__":
    unittest.main(argv=[__file__])
