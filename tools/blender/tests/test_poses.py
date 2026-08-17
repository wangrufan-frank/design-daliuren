import math
import sys
import tempfile
import unittest
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).parents[1]))

from poses import apply_pose, snapshot_transforms
from build_graybox import build_graybox, build_pose_previews
from daliuren_contract import BASE_INTERIOR_COLLISION_BOXES, NODE_IDS, POSE_IDS


MOVING_ROOT_IDS = (
    "calendar/slip",
    "lesson/first",
    "lesson/second",
    "lesson/third",
    "lesson/fourth",
    "transmission/bridge",
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
    pending = [root]
    while pending:
        current = pending.pop()
        if current.type == "MESH":
            meshes.append(current)
        pending.extend(current.children)
    return meshes


class PoseTest(unittest.TestCase):
    def setUp(self):
        build_graybox()

    def test_confirmed_motion_distances(self):
        apply_pose("closed")
        closed = snapshot_transforms()
        apply_pose("generals", plate_offset=5, general_direction="reverse")
        opened = snapshot_transforms()
        self.assertAlmostEqual(opened["calendar/slip"][2] - closed["calendar/slip"][2], 0.012)
        self.assertAlmostEqual(abs(opened["lesson/first"][0] - closed["lesson/first"][0]), 0.092)
        self.assertAlmostEqual(closed["transmission/bridge"][1] - opened["transmission/bridge"][1], 0.118)
        self.assertAlmostEqual(opened["general/noble"][2] - closed["general/noble"][2], 0.007)
        self.assertAlmostEqual(bpy.data.objects["plate/heaven"].rotation_euler.z, math.radians(150))

    def test_pose_application_has_no_history_dependency(self):
        apply_pose("generals", 7, "forward")
        first = snapshot_transforms()
        apply_pose("closed")
        apply_pose("generals", 7, "forward")
        self.assertEqual(snapshot_transforms(), first)

    def test_general_direction_is_observable_and_deterministic(self):
        apply_pose("generals", 0, "forward")
        forward = snapshot_transforms()
        apply_pose("generals", 0, "reverse")
        reverse = snapshot_transforms()
        self.assertNotEqual(forward["general/noble"][5], reverse["general/noble"][5])
        self.assertAlmostEqual(forward["general/noble"][2], reverse["general/noble"][2])
        apply_pose("generals", 0, "forward")
        self.assertEqual(snapshot_transforms(), forward)

    def test_invalid_pose_inputs_fail_before_mutating_the_scene(self):
        apply_pose("closed")
        closed = snapshot_transforms()
        invalid_calls = (
            ("unknown", 0, "forward"),
            ("closed", -1, "forward"),
            ("closed", 12, "forward"),
            ("closed", 1.5, "forward"),
            ("closed", 0, "sideways"),
        )
        for pose_id, offset, direction in invalid_calls:
            with self.subTest(pose_id=pose_id, offset=offset, direction=direction):
                with self.assertRaises((TypeError, ValueError)):
                    apply_pose(pose_id, offset, direction)
                self.assertEqual(snapshot_transforms(), closed)

    def test_closed_physical_meshes_fit_the_confirmed_xy_envelope(self):
        apply_pose("closed")
        for obj in bpy.context.scene.objects:
            if obj.type != "MESH":
                continue
            minimum, maximum = world_bounds(obj)
            with self.subTest(obj=obj.name):
                self.assertGreaterEqual(minimum[0], -0.2605)
                self.assertLessEqual(maximum[0], 0.2605)
                self.assertGreaterEqual(minimum[1], -0.2605)
                self.assertLessEqual(maximum[1], 0.2605)

    def test_generals_pose_moving_meshes_clear_base_interior_boxes(self):
        apply_pose("generals", 5, "reverse")
        for node_id in MOVING_ROOT_IDS:
            for mesh in descendant_meshes(bpy.data.objects[node_id]):
                moving_bounds = world_bounds(mesh)
                for box_name, box_minimum, box_maximum in BASE_INTERIOR_COLLISION_BOXES:
                    with self.subTest(node_id=node_id, mesh=mesh.name, box=box_name):
                        self.assertFalse(
                            boxes_overlap(moving_bounds, (box_minimum, box_maximum)),
                            f"{mesh.name} intersects {box_name}",
                        )

    def test_pose_previews_share_meshes_without_claiming_runtime_ids(self):
        runtime_mesh_pointers = {
            obj.data.as_pointer() for obj in bpy.data.objects if obj.type == "MESH"
        }
        runtime_mesh_count = len(bpy.data.meshes)
        physical_mesh_count = sum(obj.type == "MESH" for obj in bpy.data.objects)

        build_pose_previews()

        previews = [bpy.data.collections[f"pose-preview/{pose_id}"] for pose_id in POSE_IDS]
        self.assertEqual(len(previews), 6)
        for collection in previews:
            self.assertEqual(len(collection.objects), physical_mesh_count)
            for obj in collection.objects:
                self.assertEqual(obj.type, "MESH")
                self.assertNotIn("node_id", obj)
                self.assertIn(obj.data.as_pointer(), runtime_mesh_pointers)
        self.assertEqual(len(bpy.data.meshes), runtime_mesh_count)
        runtime_objects = [obj for obj in bpy.data.objects if "node_id" in obj]
        self.assertEqual(len(runtime_objects), 28)
        self.assertEqual({obj["node_id"] for obj in runtime_objects}, set(NODE_IDS))

    def test_only_closed_preview_is_enabled_after_save_and_reopen(self):
        build_pose_previews()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "pose-previews.blend"
            bpy.ops.wm.save_as_mainfile(filepath=str(path))
            bpy.ops.wm.open_mainfile(filepath=str(path))
            for pose_id in POSE_IDS:
                collection = bpy.data.collections[f"pose-preview/{pose_id}"]
                enabled = pose_id == "closed"
                with self.subTest(pose_id=pose_id):
                    self.assertEqual(collection.hide_viewport, not enabled)
                    self.assertEqual(collection.hide_render, not enabled)


if __name__ == "__main__":
    unittest.main(argv=[__file__])
