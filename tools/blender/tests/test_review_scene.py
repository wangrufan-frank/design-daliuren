import unittest
from pathlib import Path
import sys

import bpy


sys.path.insert(0, str(Path(__file__).parents[1]))

from build_graybox import build_master
from render_lookdev_review import (
    CAMERA_NAMES,
    REVIEW_OUTPUTS,
    build_lookdev_scene,
    legibility_metrics,
    validate_legibility_metrics,
)


class ReviewSceneTest(unittest.TestCase):
    def setUp(self):
        build_master()

    def tearDown(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def test_review_rig_uses_fixed_wide_4300k_key_and_low_rim(self):
        build_lookdev_scene()

        key = bpy.data.objects["light/key"].data
        fill = bpy.data.objects["light/fill"].data
        rim = bpy.data.objects["light/rim"].data
        self.assertEqual(key.type, "AREA")
        self.assertTrue(key.use_temperature)
        self.assertEqual(key.temperature, 4300.0)
        self.assertGreaterEqual(key.size, 0.70)
        self.assertGreaterEqual(fill.energy / key.energy, 0.35)
        self.assertLessEqual(fill.energy / key.energy, 0.45)
        self.assertLess(rim.energy, fill.energy)
        self.assertLess(rim.energy, key.energy * 0.25)
        for name in ("light/key", "light/fill", "light/rim"):
            light = bpy.data.objects[name]
            self.assertIsNone(light.animation_data)
            self.assertIsNone(light.data.animation_data)

    def test_legibility_camera_matches_default_runtime_equivalent_view(self):
        scene = build_lookdev_scene()

        overall = bpy.data.objects["camera/overall"]
        legibility = bpy.data.objects["camera/legibility"]
        self.assertEqual(set(CAMERA_NAMES), {
            "camera/overall",
            "camera/oblique",
            "camera/material-closeup",
            "camera/rotation-evidence",
            "camera/legibility",
        })
        self.assertEqual(tuple(legibility.location), tuple(overall.location))
        self.assertEqual(tuple(legibility.rotation_euler), tuple(overall.rotation_euler))
        self.assertEqual(legibility.data.lens, overall.data.lens)
        self.assertAlmostEqual(scene.view_settings.exposure, -1.0, places=6)
        self.assertIn("legibility", REVIEW_OUTPUTS)

    def test_sampled_pixel_metrics_enforce_legibility_thresholds(self):
        metrics = legibility_metrics(
            overall_luminances=(0.24,) * 76 + (0.04,) * 24,
            functional_luminances=(0.72, 0.68, 0.75),
            surround_luminances=(0.08, 0.09, 0.10),
        )

        self.assertGreater(metrics["mean_luminance"], 0.18)
        self.assertLess(metrics["dark_pixel_ratio"], 0.28)
        self.assertGreater(metrics["functional_text_contrast_ratio"], 4.0)
        validate_legibility_metrics(metrics)

        failing_cases = (
            {**metrics, "mean_luminance": 0.18},
            {**metrics, "dark_pixel_ratio": 0.28},
            {**metrics, "functional_text_contrast_ratio": 4.0},
        )
        for failing in failing_cases:
            with self.subTest(metrics=failing):
                with self.assertRaises(ValueError):
                    validate_legibility_metrics(failing)

    def test_rebuilding_review_scene_is_deterministic_and_leak_free(self):
        build_lookdev_scene()
        first_counts = (
            len(bpy.data.objects),
            len(bpy.data.meshes),
            len(bpy.data.cameras),
            len(bpy.data.lights),
            len(bpy.data.materials),
        )

        build_lookdev_scene()

        self.assertEqual(
            (
                len(bpy.data.objects),
                len(bpy.data.meshes),
                len(bpy.data.cameras),
                len(bpy.data.lights),
                len(bpy.data.materials),
            ),
            first_counts,
        )


if __name__ == "__main__":
    unittest.main(argv=[__file__])
