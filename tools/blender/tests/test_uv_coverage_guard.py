import sys
import unittest
from pathlib import Path

import bpy


BLENDER_DIR = Path(__file__).parents[1]
sys.path.insert(0, str(BLENDER_DIR))

from build_graybox import build_master
from uv_and_bake import _add_dynamic_surfaces, _validate_native_texel_coverage, assign_primary_uvs


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


if __name__ == "__main__":
    unittest.main(argv=[__file__])
