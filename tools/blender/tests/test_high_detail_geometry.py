import tempfile
import unittest
from pathlib import Path
import sys

import bpy
from mathutils import Vector


sys.path.insert(0, str(Path(__file__).parents[1]))

from build_graybox import build_graybox, build_master
from daliuren_contract import NODE_IDS
from high_detail_geometry import upgrade_to_high_detail


ALLOWED_DETAIL_PREFIXES = (
    "structure/base-",
    "structure/heaven-",
    "structure/plate-",
    "structure/slip-slot-",
    "structure/bronze-inlay-",
    "wear/contact-",
)
EXPECTED_DETAIL_COUNTS = {
    "structure/bronze-inlay-branch-bed": 24,
    "structure/base-shell-thickness": 4,
    "structure/base-bottom-seam": 1,
    "structure/base-corner-transition": 4,
    "structure/heaven-bronze-rim": 1,
}
FORBIDDEN_TOKENS = (
    "dovetail",
    "tenon",
    "bridge",
    "general-track",
    "pillar",
    "socket",
    "cutter/",
)


def rounded(values):
    return tuple(round(float(value), 7) for value in values)


def runtime_contract_snapshot():
    result = {}
    for obj in bpy.data.objects:
        node_id = obj.get("node_id")
        if not node_id:
            continue
        result[node_id] = {
            "parent": obj.parent.get("node_id") if obj.parent else None,
            "location": rounded(obj.location),
            "rotation": rounded(obj.rotation_euler),
            "scale": rounded(obj.scale),
            "dimensions": rounded(obj.dimensions),
        }
    return result


def world_bounds(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        tuple(min(corner[axis] for corner in corners) for axis in range(3)),
        tuple(max(corner[axis] for corner in corners) for axis in range(3)),
    )


def xy_overlap(first, second):
    first_min, first_max = first
    second_min, second_max = second
    return all(
        first_min[axis] < second_max[axis]
        and first_max[axis] > second_min[axis]
        for axis in (0, 1)
    )


class HighDetailGeometryTest(unittest.TestCase):
    def setUp(self):
        self.root = build_graybox()

    def tearDown(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def test_upgrade_preserves_every_runtime_value(self):
        before = runtime_contract_snapshot()

        returned = upgrade_to_high_detail(self.root)

        self.assertIs(returned, self.root)
        self.assertEqual(set(before), set(NODE_IDS))
        self.assertEqual(runtime_contract_snapshot(), before)

    def test_only_permitted_non_mechanical_detail_families_remain(self):
        upgrade_to_high_detail(self.root)

        details = [obj for obj in bpy.data.objects if obj.get("detail_id")]
        self.assertEqual(
            {detail_id: sum(obj.get("detail_id") == detail_id for obj in details)
             for detail_id in EXPECTED_DETAIL_COUNTS},
            EXPECTED_DETAIL_COUNTS,
        )
        self.assertEqual(len(details), sum(EXPECTED_DETAIL_COUNTS.values()))
        for obj in bpy.data.objects:
            searchable = f'{obj.name} {obj.get("detail_id", "")}'.lower()
            with self.subTest(object=obj.name):
                for token in FORBIDDEN_TOKENS:
                    self.assertNotIn(token, searchable)
                if obj.get("detail_id"):
                    self.assertTrue(obj["detail_id"].startswith(ALLOWED_DETAIL_PREFIXES))
                    self.assertEqual(obj.type, "MESH")
                    self.assertGreater(len(obj.data.polygons), 0)
                    self.assertNotIn("node_id", obj)
                    self.assertEqual(obj["owner_node_id"], obj.parent["node_id"])

    def test_exposed_detail_top_bounds_do_not_overlap_at_nearly_equal_z(self):
        upgrade_to_high_detail(self.root)
        exposed = [
            obj
            for obj in bpy.data.objects
            if obj.type == "MESH"
            and (
                obj.get("detail_id")
                or obj.get("surface_treatment") in {
                    "recessed-inlay",
                    "recessed-bed",
                    "recessed-groove",
                }
            )
        ]
        bounds = {obj.name: world_bounds(obj) for obj in exposed}
        conflicts = []
        for index, first in enumerate(exposed):
            for second in exposed[index + 1:]:
                if not xy_overlap(bounds[first.name], bounds[second.name]):
                    continue
                first_top = bounds[first.name][1][2]
                second_top = bounds[second.name][1][2]
                if abs(first_top - second_top) < 0.0001:
                    conflicts.append((first.name, second.name, first_top, second_top))
        self.assertEqual(conflicts, [])

    def test_high_detail_stays_within_fixed_scene_height(self):
        upgrade_to_high_detail(self.root)
        maximum_z = max(
            (obj.matrix_world @ Vector(corner)).z
            for obj in bpy.data.objects
            if obj.type == "MESH"
            for corner in obj.bound_box
        )
        self.assertLessEqual(maximum_z, 0.09205)

    def test_saved_master_reopens_with_recessed_branch_nodes_and_no_cutters(self):
        build_master()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "daliuren-artifact-master.blend"
            bpy.ops.wm.save_as_mainfile(filepath=str(path))
            bpy.ops.wm.open_mainfile(filepath=str(path))

            runtime = [obj for obj in bpy.data.objects if "node_id" in obj]
            branches = [
                obj for obj in runtime if obj["node_id"].startswith("branch/")
            ]
            inscriptions = [
                obj for obj in bpy.data.objects if "inscription_role" in obj
            ]
            self.assertEqual({obj["node_id"] for obj in runtime}, set(NODE_IDS))
            self.assertEqual(len(branches), 24)
            self.assertEqual(len(inscriptions), 71)
            self.assertTrue(
                all(obj["surface_treatment"] == "recessed-inlay" for obj in branches)
            )
            self.assertFalse(any(obj.name.startswith("cutter/") for obj in bpy.data.objects))

    def test_second_upgrade_is_rejected_without_duplicate_geometry(self):
        upgrade_to_high_detail(self.root)
        detail_count = sum("detail_id" in obj for obj in bpy.data.objects)

        with self.assertRaisesRegex(RuntimeError, "already upgraded"):
            upgrade_to_high_detail(self.root)

        self.assertEqual(sum("detail_id" in obj for obj in bpy.data.objects), detail_count)


if __name__ == "__main__":
    unittest.main(argv=[__file__])
