import sys
import unittest
from pathlib import Path

import bpy


sys.path.insert(0, str(Path(__file__).parents[1]))

from build_graybox import build_master
from render_lookdev_review import build_lookdev_scene
from reference_calibration import calibrate_v10_camera, projection_metrics


class ReferenceCalibrationTest(unittest.TestCase):
    def setUp(self):
        build_master()

    def tearDown(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def test_v10_camera_reprojects_board_dial_pearls_and_beidou_tightly(self):
        scene = build_lookdev_scene()
        calibrate_v10_camera(scene)
        metrics = projection_metrics(scene)

        # v10's perspective-rounded square cannot be represented exactly by the
        # source's square bevel bounds. The live dial/pearl/Beidou anchors
        # remain sub-five-pixel; the silhouette has a measured 10 px cap.
        self.assertLessEqual(metrics["board_rms_px"], 10.0)
        self.assertLessEqual(metrics["dial_center_error_px"], 5.0)
        self.assertLessEqual(metrics["pearl_rms_px"], 5.0)
        self.assertLessEqual(metrics["beidou_rms_px"], 5.0)
        self.assertLessEqual(metrics["rms_px"], 7.0)


if __name__ == "__main__":
    unittest.main(argv=[__file__])
