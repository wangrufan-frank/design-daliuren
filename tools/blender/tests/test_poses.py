import math
import sys
import tempfile
import unittest
from pathlib import Path

import bpy

BLENDER_DIR = Path(__file__).parents[1]
sys.path.insert(0, str(BLENDER_DIR))

from build_graybox import build_graybox, build_pose_previews, main as build_graybox_main
from daliuren_contract import NODE_IDS, POSE_IDS
from poses import apply_pose, snapshot_transforms


LESSON_IDS = ("lesson/first", "lesson/second", "lesson/third", "lesson/fourth")
TRANSMISSION_IDS = (
    "transmission/initial",
    "transmission/middle",
    "transmission/final",
)
GENERAL_IDS = (
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
DYNAMIC_IDS = (
    "calendar/slip",
    *LESSON_IDS,
    *TRANSMISSION_IDS,
    "transmission/method",
    *GENERAL_IDS,
)
EXPECTED_VISIBLE = {
    "closed": set(),
    "calendar": {"calendar/slip"},
    "plate": {"calendar/slip"},
    "lessons": {"calendar/slip", *LESSON_IDS},
    "transmissions": {
        "calendar/slip",
        *LESSON_IDS,
        *TRANSMISSION_IDS,
        "transmission/method",
    },
    "generals": set(DYNAMIC_IDS),
}


def visible_dynamic_ids():
    return {
        node_id
        for node_id in DYNAMIC_IDS
        if not bpy.data.objects[node_id].hide_viewport
        and not bpy.data.objects[node_id].hide_render
    }


class PoseTest(unittest.TestCase):
    def setUp(self):
        build_graybox()

    def test_generals_pose_rotates_only_heaven_plate_and_keeps_stable_z(self):
        apply_pose("closed")
        closed = snapshot_transforms()
        plate_z = bpy.data.objects["plate/heaven"].location.z

        apply_pose("generals", plate_offset=5, general_direction="reverse")
        opened = snapshot_transforms()

        self.assertNotIn("transmission/bridge", bpy.data.objects)
        self.assertAlmostEqual(bpy.data.objects["plate/heaven"].location.z, plate_z)
        self.assertAlmostEqual(
            bpy.data.objects["plate/heaven"].rotation_euler.z,
            math.radians(150),
        )
        for node_id in NODE_IDS:
            with self.subTest(node_id=node_id):
                self.assertEqual(opened[node_id][:3], closed[node_id][:3])
                if node_id != "plate/heaven":
                    self.assertEqual(opened[node_id][3:], closed[node_id][3:])
        for node_id in GENERAL_IDS:
            with self.subTest(general=node_id):
                self.assertEqual(opened[node_id][2], closed[node_id][2])

    def test_each_stage_has_exact_dynamic_visibility(self):
        for pose_id in POSE_IDS:
            apply_pose(pose_id)
            with self.subTest(pose_id=pose_id):
                self.assertEqual(visible_dynamic_ids(), EXPECTED_VISIBLE[pose_id])
                for node_id in DYNAMIC_IDS:
                    obj = bpy.data.objects[node_id]
                    visible = node_id in EXPECTED_VISIBLE[pose_id]
                    self.assertEqual(obj.hide_viewport, not visible)
                    self.assertEqual(obj.hide_render, not visible)

    def test_pose_application_has_no_history_dependency(self):
        apply_pose("generals", 7, "forward")
        first = snapshot_transforms()
        first_visibility = visible_dynamic_ids()
        apply_pose("closed")
        apply_pose("generals", 7, "forward")
        self.assertEqual(snapshot_transforms(), first)
        self.assertEqual(visible_dynamic_ids(), first_visibility)

    def test_invalid_pose_inputs_fail_before_mutating_the_scene(self):
        apply_pose("closed")
        closed = snapshot_transforms()
        closed_visibility = visible_dynamic_ids()
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
                self.assertEqual(visible_dynamic_ids(), closed_visibility)

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
        self.assertEqual({obj["node_id"] for obj in runtime_objects}, set(NODE_IDS))

    def test_pose_preview_collections_preserve_each_stage_visibility(self):
        meshes_by_node = {
            node_id: tuple(
                obj.name
                for obj in (
                    bpy.data.objects[node_id],
                    *bpy.data.objects[node_id].children_recursive,
                )
                if obj.type == "MESH"
            )
            for node_id in DYNAMIC_IDS
        }
        build_pose_previews()

        for pose_id, expected_visible in EXPECTED_VISIBLE.items():
            with self.subTest(pose_id=pose_id):
                for node_id, mesh_names in meshes_by_node.items():
                    expected_hidden = node_id not in expected_visible
                    self.assertTrue(mesh_names, node_id)
                    for mesh_name in mesh_names:
                        preview = bpy.data.objects[f"preview/{pose_id}/{mesh_name}"]
                        self.assertEqual(preview.hide_viewport, expected_hidden)
                        self.assertEqual(preview.hide_render, expected_hidden)

    def test_default_entry_point_builds_current_graybox_and_pose_previews(self):
        original_argv = sys.argv
        try:
            sys.argv = [str(BLENDER_DIR / "build_graybox.py")]
            build_graybox_main()
        finally:
            sys.argv = original_argv

        self.assertEqual(
            {obj["node_id"] for obj in bpy.data.objects if "node_id" in obj},
            set(NODE_IDS),
        )
        self.assertNotIn("transmission/bridge", bpy.data.objects)
        self.assertFalse(any(obj.name.startswith("anchor/course-copy/") for obj in bpy.data.objects))
        self.assertEqual(
            {collection.name for collection in bpy.data.collections if collection.name.startswith("pose-preview/")},
            {f"pose-preview/{pose_id}" for pose_id in POSE_IDS},
        )
        self.assertEqual(visible_dynamic_ids(), EXPECTED_VISIBLE["closed"])

    def test_rebuilding_previews_is_deterministic(self):
        build_pose_previews()
        first_counts = (len(bpy.data.objects), len(bpy.data.meshes), len(bpy.data.collections))

        build_pose_previews()

        self.assertEqual(
            (len(bpy.data.objects), len(bpy.data.meshes), len(bpy.data.collections)),
            first_counts,
        )
        self.assertEqual(visible_dynamic_ids(), EXPECTED_VISIBLE["closed"])

    def test_only_closed_preview_collection_is_enabled_after_save_and_reopen(self):
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
