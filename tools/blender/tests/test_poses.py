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
LESSON_KEYS = ("first", "second", "third", "fourth")
GENERAL_KEYS = (
    "noble",
    "snake",
    "vermilion-bird",
    "harmony",
    "hook-array",
    "azure-dragon",
    "void",
    "white-tiger",
    "constant",
    "black-tortoise",
    "yin",
    "queen-of-heaven",
)
GENERAL_SLOT_XY = (
    (0.0, 0.218),
    (0.109, 0.188793),
    (0.188793, 0.109),
    (0.218, 0.0),
    (0.188793, -0.109),
    (0.109, -0.188793),
    (0.0, -0.218),
    (-0.109, -0.188793),
    (-0.188793, -0.109),
    (-0.218, 0.0),
    (-0.188793, 0.109),
    (-0.109, 0.188793),
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


def source_meshes():
    return [
        obj
        for obj in bpy.data.objects
        if obj.type == "MESH"
        and not any(collection.name.startswith("pose-preview/") for collection in obj.users_collection)
    ]


def readout_locations():
    return {
        f"lesson/{lesson}/readout/{readout}": tuple(
            bpy.data.objects[f"lesson/{lesson}/readout/{readout}"].location
        )
        for lesson in LESSON_KEYS
        for readout in ("upper", "lower")
    }


def general_world_transforms():
    return {
        f"general/{key}": tuple(bpy.data.objects[f"general/{key}"].matrix_world.translation)
        + tuple(bpy.data.objects[f"general/{key}"].rotation_euler)
        for key in GENERAL_KEYS
    }


def rounded_vector(values):
    return tuple(round(float(value), 6) for value in values)


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

    def test_lesson_readouts_are_flush_when_closed_and_lift_after_lesson_deploys(self):
        apply_pose("closed")
        closed = readout_locations()
        for name, location in closed.items():
            readout = bpy.data.objects[name]
            with self.subTest(name=name, pose="closed"):
                self.assertAlmostEqual(location[2], 0.001)
                self.assertEqual(
                    rounded_vector(readout["closed_location"]),
                    rounded_vector(location),
                )
                self.assertAlmostEqual(readout["open_location"][2], 0.009)

        for pose_id in ("lessons", "transmissions", "generals"):
            apply_pose(pose_id)
            opened = readout_locations()
            for name, location in opened.items():
                with self.subTest(name=name, pose=pose_id):
                    self.assertAlmostEqual(location[2] - closed[name][2], 0.008)
                    self.assertEqual(
                        rounded_vector(location),
                        rounded_vector(bpy.data.objects[name]["open_location"]),
                    )

    def test_lesson_readout_lift_has_no_history_dependency(self):
        apply_pose("closed")
        closed = readout_locations()
        apply_pose("generals")
        first = readout_locations()
        apply_pose("closed")
        self.assertEqual(readout_locations(), closed)
        apply_pose("generals")
        self.assertEqual(readout_locations(), first)

    def test_general_direction_maps_ids_to_forward_and_reverse_slots(self):
        apply_pose("closed", general_direction="reverse")
        closed_reverse = general_world_transforms()
        apply_pose("closed", general_direction="forward")
        self.assertEqual(general_world_transforms(), closed_reverse)

        apply_pose("generals", general_direction="forward")
        forward = general_world_transforms()
        for index, key in enumerate(GENERAL_KEYS):
            with self.subTest(direction="forward", key=key):
                self.assertAlmostEqual(
                    forward[f"general/{key}"][0], GENERAL_SLOT_XY[index][0], delta=0.000001
                )
                self.assertAlmostEqual(
                    forward[f"general/{key}"][1], GENERAL_SLOT_XY[index][1], delta=0.000001
                )

        apply_pose("generals", general_direction="reverse")
        reverse = general_world_transforms()
        for index, key in enumerate(GENERAL_KEYS):
            target = GENERAL_SLOT_XY[(-index) % 12]
            with self.subTest(direction="reverse", key=key):
                self.assertAlmostEqual(
                    reverse[f"general/{key}"][0], target[0], delta=0.000001
                )
                self.assertAlmostEqual(
                    reverse[f"general/{key}"][1], target[1], delta=0.000001
                )
        self.assertEqual(forward["general/noble"][:2], reverse["general/noble"][:2])
        self.assertNotEqual(forward["general/snake"][:2], reverse["general/snake"][:2])
        self.assertNotEqual(
            forward["general/queen-of-heaven"][:2],
            reverse["general/queen-of-heaven"][:2],
        )

    def test_general_slot_mapping_has_no_history_dependency(self):
        for direction in ("forward", "reverse"):
            apply_pose("generals", general_direction=direction)
            first = general_world_transforms()
            opposite = "reverse" if direction == "forward" else "forward"
            apply_pose("closed", general_direction=opposite)
            apply_pose("generals", general_direction=direction)
            with self.subTest(direction=direction):
                self.assertEqual(general_world_transforms(), first)

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

    def test_closed_preview_is_the_only_visible_physical_geometry(self):
        physical_mesh_count = len(source_meshes())

        build_pose_previews()
        bpy.context.view_layer.update()

        self.assertTrue(all(obj.hide_viewport and obj.hide_render for obj in source_meshes()))
        closed = bpy.data.collections["pose-preview/closed"]
        self.assertTrue(all(not obj.hide_viewport and not obj.hide_render for obj in closed.objects))
        visible_viewport_meshes = [
            obj for obj in bpy.data.objects if obj.type == "MESH" and obj.visible_get()
        ]
        visible_render_meshes = [
            obj
            for obj in bpy.data.objects
            if obj.type == "MESH"
            and not obj.hide_render
            and any(not collection.hide_render for collection in obj.users_collection)
        ]
        self.assertEqual(len(visible_viewport_meshes), physical_mesh_count)
        self.assertEqual(len(visible_render_meshes), physical_mesh_count)

    def test_rebuilding_previews_does_not_leak_or_disable_closed_preview(self):
        build_pose_previews()
        first_counts = (len(bpy.data.objects), len(bpy.data.meshes), len(bpy.data.collections))

        build_pose_previews()

        self.assertEqual(
            (len(bpy.data.objects), len(bpy.data.meshes), len(bpy.data.collections)),
            first_counts,
        )
        closed = bpy.data.collections["pose-preview/closed"]
        self.assertTrue(all(not obj.hide_viewport and not obj.hide_render for obj in closed.objects))
        apply_pose("generals", 5, "reverse")
        self.assertAlmostEqual(
            bpy.data.objects["calendar/slip"].location.z
            - bpy.data.objects["calendar/slip"]["closed_location"][2],
            0.012,
        )
        self.assertTrue(all(obj.hide_viewport and obj.hide_render for obj in source_meshes()))

    def test_only_closed_preview_is_enabled_after_save_and_reopen(self):
        build_pose_previews()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "pose-previews.blend"
            bpy.ops.wm.save_as_mainfile(filepath=str(path))
            bpy.ops.wm.open_mainfile(filepath=str(path))
            self.assertTrue(all(obj.hide_viewport and obj.hide_render for obj in source_meshes()))
            for pose_id in POSE_IDS:
                collection = bpy.data.collections[f"pose-preview/{pose_id}"]
                enabled = pose_id == "closed"
                with self.subTest(pose_id=pose_id):
                    self.assertEqual(collection.hide_viewport, not enabled)
                    self.assertEqual(collection.hide_render, not enabled)
                    if enabled:
                        self.assertTrue(
                            all(
                                not obj.hide_viewport and not obj.hide_render
                                for obj in collection.objects
                            )
                        )


if __name__ == "__main__":
    unittest.main(argv=[__file__])
