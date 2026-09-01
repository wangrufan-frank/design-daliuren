import sys
import unittest
from pathlib import Path

import bpy


BLENDER_DIR = Path(__file__).parents[1]
sys.path.insert(0, str(BLENDER_DIR))

from build_graybox import build_master
from uv_and_bake import (
    _add_dynamic_surfaces,
    COVERAGE_FALLBACK_GLOBAL_MAX_AREA,
    COVERAGE_FALLBACK_GLOBAL_MAX_TRIANGLES,
    COVERAGE_FALLBACK_LIMITS,
    COVERAGE_FALLBACK_OBJECTS,
    _native_texel_coverage_failures,
    _validate_native_texel_coverage,
    assign_primary_uvs,
)


class NativeCoverageGuardTests(unittest.TestCase):
    maxDiff = None

    def tearDown(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def test_visible_native_texel_coverage_miss_aborts_the_bake(self):
        build_master()
        assign_primary_uvs(_add_dynamic_surfaces())
        body = bpy.data.objects["base/body"]
        body["surface_treatment"] = "shallow-slot"
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

    def test_coverage_fallback_records_are_pinned_to_current_geometry(self):
        build_master()
        assign_primary_uvs(_add_dynamic_surfaces())
        failures = _native_texel_coverage_failures("M_JadeBody", 4096, atlas_id="M_JadeBody:hero")
        records = {}
        for object_name, triangle_index in failures:
            area = bpy.data.objects[object_name].data.loop_triangles[triangle_index].area
            if area > 2.0e-7:
                records.setdefault(object_name, []).append(area)
        pinned = {
            name: (len(areas), round(max(areas), 10), round(sum(areas), 10))
            for name, areas in sorted(records.items())
        }
        normalized_envelope = {}
        for name in sorted(COVERAGE_FALLBACK_OBJECTS):
            mesh = bpy.data.objects[name].data
            mesh.calc_loop_triangles()
            areas = [triangle.area for triangle in mesh.loop_triangles if triangle.area > 2.0e-7]
            normalized_envelope[name] = (
                len(areas),
                round(max(areas) * 1.0e7),
                round(sum(areas) * 1.0e7),
            )
        # 1e-7 m² bins absorb Blender floating-point noise without hiding a triangle change.
        self.assertEqual(
            normalized_envelope,
            {
                "detail/base/removable-bottom": (60, 1169828, 4698002),
                "detail/base/shell-return/00": (60, 18529, 84229),
                "detail/base/shell-return/01": (60, 18529, 84229),
                "detail/base/shell-return/02": (60, 18529, 84229),
                "detail/base/shell-return/03": (60, 18529, 84229),
                "detail/slip-seat/lesson/first": (60, 16973, 70900),
                "detail/slip-seat/lesson/fourth": (60, 16973, 70900),
                "detail/slip-seat/lesson/second": (60, 16973, 70900),
                "detail/slip-seat/lesson/third": (60, 16973, 70900),
                "detail/slip-seat/transmission/final": (60, 16917, 70627),
                "detail/slip-seat/transmission/initial": (60, 16917, 70627),
                "detail/slip-seat/transmission/method": (60, 16685, 70090),
                "detail/slip-seat/transmission/middle": (60, 16917, 70627),
                "trace/course": (64, 106, 4752),
            },
        )
        expected = {
            "detail/base/removable-bottom": (24, 0.000120925, 0.001267421),
            "detail/base/shell-return/00": (24, 0.00009752, 0.0006009377),
            "detail/base/shell-return/01": (24, 0.00009752, 0.0006009377),
            "detail/base/shell-return/02": (24, 0.00009752, 0.0006009377),
            "detail/base/shell-return/03": (24, 0.00009752, 0.0006009377),
            "detail/slip-seat/lesson/first": (18, 0.00002448, 0.0002),
            "detail/slip-seat/lesson/fourth": (18, 0.00002448, 0.0002),
            "detail/slip-seat/lesson/second": (18, 0.00002448, 0.0002),
            "detail/slip-seat/lesson/third": (18, 0.00002448, 0.0002),
            "detail/slip-seat/transmission/initial": (24, 0.00002328, 0.0002),
            "detail/slip-seat/transmission/middle": (18, 0.00002328, 0.0002),
            "detail/slip-seat/transmission/final": (18, 0.00002328, 0.0002),
            "detail/slip-seat/transmission/method": (24, 0.00003168, 0.0002),
            "trace/course": (6, 0.000012, 0.00005),
        }
        self.assertEqual(COVERAGE_FALLBACK_LIMITS, expected)
        self.assertEqual(COVERAGE_FALLBACK_OBJECTS, set(expected))
        self.assertEqual(COVERAGE_FALLBACK_GLOBAL_MAX_TRIANGLES, 282)
        self.assertEqual(COVERAGE_FALLBACK_GLOBAL_MAX_AREA, 0.0053211718)
        self.assertEqual(set(pinned) - set(expected), set(), pinned)
        self.assertLessEqual(sum(record[0] for record in pinned.values()), COVERAGE_FALLBACK_GLOBAL_MAX_TRIANGLES)
        self.assertLessEqual(sum(record[2] for record in pinned.values()), COVERAGE_FALLBACK_GLOBAL_MAX_AREA)
        for name, (count, max_area, aggregate_area) in pinned.items():
            max_count, max_triangle_area, max_aggregate_area = expected[name]
            self.assertLessEqual(count, max_count, name)
            self.assertLessEqual(max_area, max_triangle_area, name)
            self.assertLessEqual(aggregate_area, max_aggregate_area, name)
        _validate_native_texel_coverage("M_JadeBody", 4096, "M_JadeBody:hero")


if __name__ == "__main__":
    unittest.main(argv=[__file__])
