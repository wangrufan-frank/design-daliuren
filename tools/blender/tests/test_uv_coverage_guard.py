import sys
import unittest
from pathlib import Path

import bpy


BLENDER_DIR = Path(__file__).parents[1]
sys.path.insert(0, str(BLENDER_DIR))

from build_graybox import build_master
from uv_and_bake import (
    _add_dynamic_surfaces,
    COVERAGE_FALLBACK_OBJECTS,
    COVERAGE_FALLBACK_SURFACE_TREATMENTS,
    _native_texel_coverage_failures,
    _validate_native_texel_coverage,
    assign_primary_uvs,
)


class NativeCoverageGuardTests(unittest.TestCase):
    def tearDown(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def test_visible_native_texel_coverage_miss_aborts_the_bake(self):
        build_master()
        assign_primary_uvs(_add_dynamic_surfaces())
        body = bpy.data.objects["base/body"]
        body.data.calc_loop_triangles()
        triangle = next(item for item in body.data.loop_triangles if item.area > 2.0e-7)
        for loop_index in triangle.loops:
            body.data.uv_layers["UVMap"].data[loop_index].uv = (0.5, 0.5)

        with self.assertRaisesRegex(RuntimeError, "sub-texel UV triangle cannot be baked natively"):
            _validate_native_texel_coverage("M_JadeBody", 4096, "M_JadeBody:hero")

    def test_calendar_readout_has_no_native_texel_coverage_exception(self):
        build_master()
        assign_primary_uvs(_add_dynamic_surfaces())
        readout = bpy.data.objects["calendar/slip/readout"]
        self.assertEqual(readout.get("material_role"), "M_JadeRecess")
        failures = _native_texel_coverage_failures("M_JadeRecess", 4096, atlas_id="M_JadeRecess:hero")
        readout_failures = [failure for failure in failures if failure[0] == readout.name]
        self.assertEqual(readout_failures, [], failures)
        _validate_native_texel_coverage("M_JadeRecess", 4096, "M_JadeRecess:hero")

    def test_only_named_base_relief_can_use_the_documented_coverage_fallback(self):
        build_master()
        assign_primary_uvs(_add_dynamic_surfaces())
        failures = _native_texel_coverage_failures("M_JadeBody", 4096, atlas_id="M_JadeBody:hero")
        above_threshold = {
            object_name
            for object_name, triangle_index in failures
            if bpy.data.objects[object_name].data.loop_triangles[triangle_index].area > 2.0e-7
        }
        expected = {
            name
            for name in above_threshold
            if name in COVERAGE_FALLBACK_OBJECTS
            or bpy.data.objects[name].get("surface_treatment") in COVERAGE_FALLBACK_SURFACE_TREATMENTS
        }
        self.assertEqual(above_threshold, expected)
        _validate_native_texel_coverage("M_JadeBody", 4096, "M_JadeBody:hero")


if __name__ == "__main__":
    unittest.main(argv=[__file__])
