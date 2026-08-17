import math
import sys
import unittest
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).parents[1]))

from build_graybox import build_graybox
from daliuren_contract import NODE_IDS


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


class ComponentContractTest(unittest.TestCase):
    def setUp(self):
        self.root = build_graybox()

    def assertVectorAlmostEqual(self, actual, expected):
        self.assertEqual(len(actual), len(expected))
        for actual_value, expected_value in zip(actual, expected):
            self.assertAlmostEqual(actual_value, expected_value, places=4)

    def test_every_runtime_node_exists_once(self):
        runtime_objects = [obj for obj in bpy.data.objects if "node_id" in obj]
        self.assertEqual(len(runtime_objects), len(NODE_IDS))
        self.assertEqual({obj["node_id"] for obj in runtime_objects}, set(NODE_IDS))
        for node_id in NODE_IDS:
            matches = [obj for obj in runtime_objects if obj["node_id"] == node_id]
            self.assertEqual(len(matches), 1, node_id)

    def test_calendar_is_a_rear_pivot_with_separate_readout(self):
        calendar = bpy.data.objects["calendar/slip"]
        self.assertEqual(calendar.type, "EMPTY")
        self.assertGreater(calendar.location.y, 0.0)
        self.assertEqual(calendar.parent, self.root)
        self.assertEqual(
            {child.name for child in calendar.children},
            {"calendar/slip/body", "calendar/slip/readout"},
        )
        readout = bpy.data.objects["calendar/slip/readout"]
        self.assertEqual(readout.type, "MESH")
        self.assertNotIn("node_id", readout)

    def test_four_lesson_roots_have_confirmed_structure_and_visual_order(self):
        expected = ("fourth", "third", "second", "first")
        for visual_order, lesson in enumerate(expected):
            root = bpy.data.objects[f"lesson/{lesson}"]
            self.assertEqual(root.type, "EMPTY")
            self.assertEqual(root["visual_order"], visual_order)
            self.assertAlmostEqual(root["travel_m"], 0.092)
            self.assertEqual(root.parent, self.root)
            body = bpy.data.objects[f"lesson/{lesson}/body"]
            self.assertVectorAlmostEqual(body.dimensions[:2], (0.152, 0.100))
            self.assertEqual(body.parent, root)
            self.assertEqual(
                {child.name for child in root.children},
                {
                    f"lesson/{lesson}/body",
                    f"lesson/{lesson}/readout/upper",
                    f"lesson/{lesson}/readout/lower",
                    f"lesson/{lesson}/socket/general",
                },
            )
            self.assertEqual(bpy.data.objects[f"lesson/{lesson}/socket/general"].type, "EMPTY")
        self.assertLess(bpy.data.objects["lesson/fourth"].location.x, 0.0)
        self.assertLess(bpy.data.objects["lesson/third"].location.x, 0.0)
        self.assertGreater(bpy.data.objects["lesson/second"].location.x, 0.0)
        self.assertGreater(bpy.data.objects["lesson/first"].location.x, 0.0)

    def test_transmission_bridge_is_front_parent_of_fixed_modules(self):
        bridge = bpy.data.objects["transmission/bridge"]
        self.assertEqual(bridge.type, "EMPTY")
        self.assertLess(bridge.location.y, 0.0)
        self.assertEqual(bridge.parent, self.root)
        self.assertVectorAlmostEqual(bridge["motion_axis"], (0.0, -1.0, 0.0))
        self.assertAlmostEqual(bridge["travel_m"], 0.118)
        modules = ("initial", "middle", "final")
        self.assertEqual(
            [bpy.data.objects[f"transmission/{module}"]["module_order"] for module in modules],
            [0, 1, 2],
        )
        for module in modules:
            obj = bpy.data.objects[f"transmission/{module}"]
            self.assertEqual(obj.parent, bridge)
            self.assertEqual(obj.type, "MESH")

    def test_generals_are_independent_objects_on_one_shared_mesh(self):
        generals = [obj for obj in bpy.data.objects if obj.get("domain") == "general"]
        self.assertEqual(len(generals), 12)
        self.assertEqual({obj["general_key"] for obj in generals}, set(GENERAL_KEYS))
        self.assertEqual(len({obj.name for obj in generals}), 12)
        self.assertEqual(len({obj.data.name for obj in generals}), 1)
        self.assertEqual(len({id(obj) for obj in generals}), 12)
        for general in generals:
            self.assertEqual(general.parent, self.root)
            self.assertAlmostEqual(math.hypot(general.location.x, general.location.y), 0.218)

    def test_moving_roots_publish_absolute_motion_metadata(self):
        moving_roots = [
            "calendar/slip",
            "lesson/fourth",
            "lesson/third",
            "lesson/second",
            "lesson/first",
            "transmission/bridge",
            *(f"general/{key}" for key in GENERAL_KEYS),
        ]
        for node_id in moving_roots:
            obj = bpy.data.objects[node_id]
            self.assertVectorAlmostEqual(obj.location, obj["closed_location"])
            self.assertEqual(len(obj["open_location"]), 3)
            self.assertEqual(len(obj["motion_axis"]), 3)
            self.assertGreater(obj["travel_m"], 0.0)

    def test_course_copy_anchors_are_logical_empties_under_artifact_root(self):
        for domain in ("lessons", "transmissions", "generals"):
            anchor = bpy.data.objects[f"anchor/course-copy/{domain}"]
            self.assertEqual(anchor.type, "EMPTY")
            self.assertEqual(anchor.parent, self.root)
            self.assertEqual(len(anchor.children), 0)

    def test_helper_children_do_not_claim_runtime_ids(self):
        for obj in bpy.data.objects:
            if obj.name not in NODE_IDS:
                self.assertNotIn("node_id", obj, obj.name)


if __name__ == "__main__":
    unittest.main(argv=[__file__])
