import sys
import unittest
from pathlib import Path

import bpy


BLENDER_DIR = Path(__file__).parents[1]
REPOSITORY_ROOT = BLENDER_DIR.parents[1]
MASTER_PATH = REPOSITORY_ROOT / "assets/daliuren/source/daliuren-artifact-master.blend"
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


def _normalized_failure_envelope(failures):
    records = {}
    for object_name, triangle_index in failures:
        triangle = bpy.data.objects[object_name].data.loop_triangles[triangle_index]
        if triangle.area > 2.0e-7:
            records.setdefault(object_name, []).append((triangle_index, round(triangle.area * 1.0e7)))
    return {
        name: (len(entries), tuple(sorted(entries)))
        for name, entries in sorted(records.items())
    }


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
        before = _normalized_failure_envelope(
            _native_texel_coverage_failures("M_JadeBody", 4096, atlas_id="M_JadeBody:hero")
        )
        for loop_index in triangle.loops:
            body.data.uv_layers["UVMap"].data[loop_index].uv = (0.5, 0.5)

        after = _normalized_failure_envelope(
            _native_texel_coverage_failures("M_JadeBody", 4096, atlas_id="M_JadeBody:hero")
        )
        with self.assertRaises(AssertionError):
            self.assertEqual(after, before)

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
        bpy.ops.wm.open_mainfile(filepath=str(MASTER_PATH))
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
        normalized_envelope = _normalized_failure_envelope(failures)
        # Area bins are 1e-7 m²; triangle indices preserve same-area replacement identity.
        self.assertEqual(
            normalized_envelope,
            {
                "detail/base/removable-bottom": (24, ((58, 188), (64, 188), (70, 188), (73, 188), (79, 188), (82, 188), (88, 188), (91, 188), (93, 1209), (94, 1209), (96, 1209), (97, 1209), (148, 188), (154, 188), (160, 188), (163, 188), (169, 188), (172, 188), (178, 188), (181, 188), (183, 1209), (184, 1209), (186, 1209), (187, 1209))),
                "detail/base/shell-return/00": (18, ((58, 4), (64, 4), (79, 4), (82, 4), (88, 252), (91, 252), (93, 15), (94, 975), (97, 15), (148, 4), (154, 4), (169, 4), (172, 4), (178, 252), (181, 252), (183, 15), (184, 975), (187, 15))),
                "detail/base/shell-return/01": (12, ((70, 252), (73, 252), (88, 252), (91, 252), (94, 975), (96, 975), (160, 252), (163, 252), (178, 252), (181, 252), (184, 975), (186, 975))),
                "detail/base/shell-return/02": (12, ((79, 252), (82, 252), (88, 4), (91, 4), (94, 15), (97, 975), (169, 252), (172, 252), (178, 4), (181, 4), (184, 15), (187, 975))),
                "detail/base/shell-return/03": (6, ((70, 4), (73, 4), (96, 15), (160, 4), (163, 4), (186, 15))),
                "detail/slip-seat/lesson/first": (12, ((58, 22), (64, 22), (79, 22), (82, 22), (93, 125), (97, 125), (148, 22), (154, 22), (169, 22), (172, 22), (183, 125), (187, 125))),
                "detail/slip-seat/lesson/fourth": (12, ((70, 42), (73, 42), (88, 42), (91, 42), (94, 245), (96, 245), (160, 42), (163, 42), (178, 42), (181, 42), (184, 245), (186, 245))),
                "detail/slip-seat/transmission/initial": (6, ((88, 40), (91, 40), (94, 233), (178, 40), (181, 40), (184, 233))),
                "detail/slip-seat/transmission/middle": (6, ((58, 23), (64, 23), (93, 131), (148, 23), (154, 23), (183, 131))),
                "trace/course": (2, ((22, 59), (54, 58))),
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
