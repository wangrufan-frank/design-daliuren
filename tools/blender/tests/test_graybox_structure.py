import sys
import unittest
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).parents[1]))

from build_graybox import build_graybox


class GrayboxStructureTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = build_graybox()

    def assertVectorAlmostEqual(self, actual, expected):
        self.assertEqual(len(actual), len(expected))
        for actual_value, expected_value in zip(actual, expected):
            self.assertAlmostEqual(actual_value, expected_value, places=4)

    def test_scene_units_are_metric_millimeters(self):
        units = bpy.context.scene.unit_settings
        self.assertEqual(units.system, "METRIC")
        self.assertEqual(units.length_unit, "MILLIMETERS")
        self.assertEqual(units.scale_length, 1.0)

    def test_base_and_heaven_plate_dimensions(self):
        base = bpy.data.objects["base/body"]
        heaven = bpy.data.objects["plate/heaven"]
        self.assertVectorAlmostEqual(base.dimensions, (0.520, 0.520, 0.052))
        self.assertAlmostEqual(base.location.z - base.dimensions.z / 2, 0.0, places=4)
        self.assertAlmostEqual(heaven.dimensions.x, 0.380, places=4)
        self.assertAlmostEqual(heaven.dimensions.z, 0.024, places=4)

    def test_earth_plate_is_fixed_and_heaven_plate_has_center_pivot(self):
        self.assertTrue(bpy.data.objects["plate/earth"]["fixed"])
        self.assertEqual(tuple(bpy.data.objects["plate/heaven"].location[:2]), (0.0, 0.0))

    def test_runtime_parts_have_stable_ids_and_root_parent(self):
        runtime_names = ("base/body", "plate/earth", "plate/heaven")
        self.assertEqual(self.root.name, "artifact/root")
        self.assertEqual(self.root["node_id"], "artifact/root")
        for name in runtime_names:
            part = bpy.data.objects[name]
            self.assertEqual(part["node_id"], name)
            self.assertIs(part.parent, self.root)

    def test_historical_ring_is_non_runtime_reference(self):
        ring = bpy.data.objects["reference/historical-ring"]
        self.assertEqual(ring["role"], "fixed-historical-inscription")
        self.assertNotIn("node_id", ring)
        self.assertIsNone(ring.parent)

    def test_default_scene_objects_are_removed(self):
        self.assertNotIn("Camera", bpy.data.objects)
        self.assertNotIn("Cube", bpy.data.objects)
        self.assertNotIn("Light", bpy.data.objects)


if __name__ == "__main__":
    unittest.main(argv=[__file__])
