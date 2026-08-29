import sys
import unittest
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).parents[1]))

from build_graybox import build_graybox


class GrayboxStructureTest(unittest.TestCase):
    def setUp(self):
        self.root = build_graybox()

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
        earth = bpy.data.objects["plate/earth"]
        heaven = bpy.data.objects["plate/heaven"]
        self.assertVectorAlmostEqual(base.dimensions, (0.520, 0.520, 0.052))
        self.assertAlmostEqual(base.location.z - base.dimensions.z / 2, 0.0, places=4)
        self.assertVectorAlmostEqual(earth.dimensions, (0.440, 0.440, 0.014))
        self.assertAlmostEqual(heaven.dimensions.x, 0.380, places=4)
        self.assertAlmostEqual(heaven.dimensions.y, 0.380, places=4)
        self.assertGreaterEqual(heaven.dimensions.z, 0.024)
        self.assertAlmostEqual(heaven.dimensions.z, 0.026, places=4)

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

    def test_rebuild_removes_hidden_objects_and_orphan_meshes(self):
        expected_object_count = len(bpy.data.objects)
        expected_mesh_count = len(bpy.data.meshes)
        stale_mesh = bpy.data.meshes.new("stale-mesh")
        stale = bpy.data.objects["base/body"]
        stale.hide_set(True)
        stale.hide_render = True

        self.root = build_graybox()

        self.assertNotIn("base/body.001", bpy.data.objects)
        self.assertNotIn("stale-mesh", bpy.data.meshes)
        self.assertEqual(len(bpy.data.objects), expected_object_count)
        self.assertEqual(len(bpy.data.meshes), expected_mesh_count)

    def test_scene_retains_task_3_foundation_objects(self):
        self.assertTrue(
            {
                "artifact/root",
                "base/body",
                "plate/earth",
                "plate/heaven",
                "reference/historical-ring",
            }.issubset(bpy.data.objects.keys())
        )

    def test_slips_have_real_thickness_and_settle_inside_base(self):
        moving_slips = (
            "lesson/fourth",
            "lesson/third",
            "lesson/second",
            "lesson/first",
            "transmission/initial",
            "transmission/middle",
            "transmission/final",
        )
        half_base = 0.520 / 2
        for node_id in moving_slips:
            slip = bpy.data.objects[node_id]
            self.assertGreaterEqual(slip.dimensions.z, 0.006, node_id)
            self.assertIn("settled_location", slip, node_id)
            settled = slip["settled_location"]
            self.assertLessEqual(abs(settled[0]) + slip.dimensions.x / 2, half_base, node_id)
            self.assertLessEqual(abs(settled[1]) + slip.dimensions.y / 2, half_base, node_id)

    def test_graybox_has_no_mechanical_node_or_detail_names(self):
        forbidden = ("dovetail", "rail", "bridge", "track", "copy")
        for obj in bpy.data.objects:
            searchable = f'{obj.name} {obj.get("detail_id", "")}'.lower()
            for token in forbidden:
                self.assertNotIn(token, searchable, obj.name)

    def test_course_trace_is_a_shallow_dark_mesh_attached_to_earth(self):
        self.assertIn("trace/course", bpy.data.objects)
        trace = bpy.data.objects["trace/course"]
        self.assertEqual(trace.type, "MESH")
        self.assertEqual(trace.parent, bpy.data.objects["plate/earth"])
        self.assertGreater(trace.dimensions.z, 0.0001)
        self.assertLess(trace.dimensions.z, 0.003)
        self.assertEqual(len(trace.data.materials), 1)
        self.assertLess(max(trace.data.materials[0].diffuse_color[:3]), 0.1)


if __name__ == "__main__":
    unittest.main(argv=[__file__])
