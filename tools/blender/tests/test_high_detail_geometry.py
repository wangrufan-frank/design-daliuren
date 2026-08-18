import sys
import unittest
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).parents[1]))

from build_graybox import build_graybox
from daliuren_contract import BASE_INTERIOR_COLLISION_BOXES, NODE_IDS
from high_detail_geometry import upgrade_to_high_detail
from poses import apply_pose


REQUIRED_BEVELED_ROOTS = (
    "base/body",
    "plate/earth",
    "plate/heaven",
    "transmission/initial",
    "transmission/middle",
    "transmission/final",
    "general/noble",
    "general/snake",
    "general/vermilion-bird",
    "general/harmony",
    "general/hook-array",
    "general/azure-dragon",
    "general/void",
    "general/white-tiger",
    "general/constant",
    "general/black-tortoise",
    "general/yin",
    "general/queen-of-heaven",
)
EXPECTED_DETAIL_COUNTS = {
    "structure/base-shell-thickness": 4,
    "structure/base-bottom-seam": 1,
    "structure/base-corner-transition": 4,
    "structure/heaven-bronze-rim": 1,
    "structure/heaven-support-rib": 4,
    "mechanism/heaven-bearing": 1,
    "mechanism/heaven-detent": 12,
    "structure/heaven-inlay-bed": 12,
    "mechanism/lesson-dovetails": 4,
    "mechanism/lesson-end-stop": 4,
    "mechanism/lesson-readout-bed": 4,
    "mechanism/lesson-general-socket": 4,
    "structure/bridge-support": 1,
    "mechanism/transmission-tenon": 3,
    "mechanism/bridge-stops": 1,
    "mechanism/general-track": 1,
    "mechanism/general-seal-interface": 12,
    "structure/bronze-celadon-contact-seam": 12,
}
MOTION_KEYS = (
    "closed_location",
    "open_location",
    "motion_axis",
    "travel_m",
    "closed_rotation_euler",
    "open_location_forward",
    "open_location_reverse",
)


def rounded(values):
    return tuple(round(float(value), 7) for value in values)


def runtime_contract_snapshot():
    result = {}
    for obj in bpy.data.objects:
        node_id = obj.get("node_id")
        if not node_id:
            continue
        motion = {}
        for key in MOTION_KEYS:
            if key not in obj:
                continue
            value = obj[key]
            motion[key] = rounded(value) if hasattr(value, "__len__") else float(value)
        result[node_id] = {
            "parent": obj.parent.get("node_id") if obj.parent else None,
            "location": rounded(obj.location),
            "rotation": rounded(obj.rotation_euler),
            "scale": rounded(obj.scale),
            "dimensions": rounded(obj.dimensions),
            "motion": motion,
        }
    return result


def details(detail_id):
    return [obj for obj in bpy.data.objects if obj.get("detail_id") == detail_id]


def local_axis_bounds(obj, axis):
    values = [obj.location[axis] + corner[axis] for corner in obj.bound_box]
    return min(values), max(values)


def world_bounds(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        tuple(min(corner[axis] for corner in corners) for axis in range(3)),
        tuple(max(corner[axis] for corner in corners) for axis in range(3)),
    )


def boxes_overlap(first, second):
    first_min, first_max = first
    second_min, second_max = second
    return all(
        first_min[axis] < second_max[axis]
        and first_max[axis] > second_min[axis]
        for axis in range(3)
    )


def descendant_meshes(root):
    meshes = []
    pending = list(root.children)
    while pending:
        current = pending.pop()
        if current.type == "MESH":
            meshes.append(current)
        pending.extend(current.children)
    return meshes


class HighDetailGeometryTest(unittest.TestCase):
    def setUp(self):
        self.root = build_graybox()

    def test_upgrade_preserves_every_frozen_runtime_value(self):
        before = runtime_contract_snapshot()

        returned = upgrade_to_high_detail(self.root)

        self.assertIs(returned, self.root)
        self.assertEqual(set(before), set(NODE_IDS))
        self.assertEqual(runtime_contract_snapshot(), before)

    def test_visible_runtime_meshes_have_evaluated_bevel_geometry(self):
        upgrade_to_high_detail(self.root)
        dependency_graph = bpy.context.evaluated_depsgraph_get()

        for node_id in REQUIRED_BEVELED_ROOTS:
            obj = bpy.data.objects[node_id]
            modifiers = [modifier for modifier in obj.modifiers if modifier.type == "BEVEL"]
            with self.subTest(node_id=node_id):
                self.assertTrue(modifiers)
                self.assertGreaterEqual(max(modifier.width for modifier in modifiers), 0.0004)
                evaluated_mesh = obj.evaluated_get(dependency_graph).to_mesh()
                try:
                    self.assertGreater(len(evaluated_mesh.vertices), len(obj.data.vertices))
                finally:
                    obj.evaluated_get(dependency_graph).to_mesh_clear()

    def test_required_structural_and_mechanism_parts_are_owned_real_meshes(self):
        upgrade_to_high_detail(self.root)

        actual_counts = {
            detail_id: len(details(detail_id)) for detail_id in EXPECTED_DETAIL_COUNTS
        }
        self.assertEqual(actual_counts, EXPECTED_DETAIL_COUNTS)
        for detail_id, expected_count in EXPECTED_DETAIL_COUNTS.items():
            group = details(detail_id)
            self.assertEqual(len(group), expected_count)
            for obj in group:
                with self.subTest(detail_id=detail_id, object=obj.name):
                    self.assertEqual(obj.type, "MESH")
                    self.assertGreater(len(obj.data.vertices), 0)
                    self.assertGreater(len(obj.data.polygons), 0)
                    self.assertGreater(min(obj.dimensions), 0.00035)
                    self.assertNotIn("node_id", obj)
                    self.assertIsNotNone(obj.parent)
                    self.assertIn("node_id", obj.parent)
                    self.assertEqual(obj.parent["node_id"], obj["owner_node_id"])

    def test_counted_mechanisms_have_independent_mesh_objects_and_correct_owners(self):
        upgrade_to_high_detail(self.root)

        expected_owners = {
            "mechanism/heaven-detent": {"plate/heaven"},
            "mechanism/lesson-dovetails": {
                "lesson/first", "lesson/second", "lesson/third", "lesson/fourth"
            },
            "mechanism/lesson-end-stop": {
                "lesson/first", "lesson/second", "lesson/third", "lesson/fourth"
            },
            "mechanism/lesson-readout-bed": {
                "lesson/first", "lesson/second", "lesson/third", "lesson/fourth"
            },
            "mechanism/transmission-tenon": {"transmission/bridge"},
            "mechanism/general-seal-interface": {
                node_id for node_id in NODE_IDS if node_id.startswith("general/")
            },
        }
        for detail_id, owners in expected_owners.items():
            group = details(detail_id)
            with self.subTest(detail_id=detail_id):
                self.assertEqual({obj["owner_node_id"] for obj in group}, owners)
                self.assertEqual(len({obj.as_pointer() for obj in group}), len(group))

    def test_lesson_rails_and_stops_break_the_body_silhouette_so_they_are_visible(self):
        upgrade_to_high_detail(self.root)

        for lesson in ("first", "second", "third", "fourth"):
            body = bpy.data.objects[f"lesson/{lesson}/body"]
            rail = next(
                obj
                for obj in details("mechanism/lesson-dovetails")
                if obj["owner_node_id"] == f"lesson/{lesson}"
            )
            stop = next(
                obj
                for obj in details("mechanism/lesson-end-stop")
                if obj["owner_node_id"] == f"lesson/{lesson}"
            )
            with self.subTest(lesson=lesson, detail="rail"):
                self.assertGreater(
                    local_axis_bounds(rail, 1)[1],
                    local_axis_bounds(body, 1)[1] - 0.002,
                )
                self.assertGreater(
                    local_axis_bounds(rail, 2)[1],
                    local_axis_bounds(body, 2)[1],
                )
            with self.subTest(lesson=lesson, detail="stop"):
                self.assertGreater(
                    stop.location.z + stop.dimensions.z / 2,
                    body.location.z + body.dimensions.z / 2,
                )

    def test_high_detail_closed_envelope_and_deployed_keep_outs_remain_clear(self):
        upgrade_to_high_detail(self.root)
        apply_pose("closed")
        for obj in bpy.data.objects:
            if obj.type != "MESH":
                continue
            minimum, maximum = world_bounds(obj)
            with self.subTest(pose="closed", object=obj.name):
                self.assertGreaterEqual(minimum[0], -0.2605)
                self.assertLessEqual(maximum[0], 0.2605)
                self.assertGreaterEqual(minimum[1], -0.2605)
                self.assertLessEqual(maximum[1], 0.2605)

        apply_pose("generals", plate_offset=5, general_direction="reverse")
        moving_roots = (
            "calendar/slip",
            "lesson/first",
            "lesson/second",
            "lesson/third",
            "lesson/fourth",
            "transmission/bridge",
            *(node_id for node_id in NODE_IDS if node_id.startswith("general/")),
        )
        for node_id in moving_roots:
            for mesh in descendant_meshes(bpy.data.objects[node_id]):
                for box_name, minimum, maximum in BASE_INTERIOR_COLLISION_BOXES:
                    with self.subTest(
                        pose="generals", node_id=node_id, mesh=mesh.name, box=box_name
                    ):
                        self.assertFalse(
                            boxes_overlap(world_bounds(mesh), (minimum, maximum))
                        )

    def test_second_upgrade_is_rejected_without_duplicate_geometry_or_modifiers(self):
        upgrade_to_high_detail(self.root)
        detail_count = sum("detail_id" in obj for obj in bpy.data.objects)
        modifier_counts = {
            node_id: len(bpy.data.objects[node_id].modifiers)
            for node_id in REQUIRED_BEVELED_ROOTS
        }

        with self.assertRaisesRegex(RuntimeError, "already upgraded"):
            upgrade_to_high_detail(self.root)

        self.assertEqual(sum("detail_id" in obj for obj in bpy.data.objects), detail_count)
        self.assertEqual(
            {
                node_id: len(bpy.data.objects[node_id].modifiers)
                for node_id in REQUIRED_BEVELED_ROOTS
            },
            modifier_counts,
        )


if __name__ == "__main__":
    unittest.main(argv=[__file__])
