import sys
import unittest
from pathlib import Path

import bpy


sys.path.insert(0, str(Path(__file__).parents[1]))

from build_graybox import build_master
from render_lookdev_review import build_lookdev_scene
from reference_calibration import REFERENCE_ANCHORS, calibrate_v10_camera, projection_metrics


class ReferenceAnchorFitTest(unittest.TestCase):
    def test_reference_anchors_use_the_same_cover_fit_as_the_overlay(self):
        self.assertAlmostEqual(REFERENCE_ANCHORS["board/nw"][1], 201.8367029548989)
        self.assertAlmostEqual(REFERENCE_ANCHORS["board/se"][1], 1102.8444790046656)


class ReferenceCalibrationTest(unittest.TestCase):
    def setUp(self):
        build_master()

    def tearDown(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def test_v10_camera_reprojects_board_dial_pearls_and_beidou_tightly(self):
        scene = build_lookdev_scene()
        calibrate_v10_camera(scene)
        metrics = projection_metrics(scene)

        # These limits reject the visibly doubled board/rings from the previous
        # accepted overlay; they are measured against the user-provided v10
        # anchors and may not be relaxed to make a mismatched render pass.
        self.assertLessEqual(metrics["board_rms_px"], 18.0)
        self.assertLessEqual(metrics["dial_center_error_px"], 5.0)
        self.assertLessEqual(metrics["pearl_rms_px"], 12.0)
        self.assertLessEqual(metrics["beidou_rms_px"], 5.0)
        self.assertLessEqual(metrics["rim_rms_px"], 12.0)
        self.assertLessEqual(metrics["branch_rms_px"], 15.0)
        self.assertLessEqual(metrics["month_rms_px"], 15.0)
        self.assertLessEqual(metrics["general_rms_px"], 15.0)
        self.assertLessEqual(metrics["rms_px"], 15.0)


if __name__ == "__main__":
    unittest.main(argv=[__file__])
