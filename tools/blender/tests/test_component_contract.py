import math
import sys
import unittest
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).parents[1]))

from build_graybox import build_graybox
from daliuren_contract import DIMENSIONS, NODE_IDS


BRANCHES = tuple("子丑寅卯辰巳午未申酉戌亥")


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

    def test_four_lessons_are_independent_slips_at_settled_positions(self):
        expected = {
            "fourth": (-0.176, 0.132),
            "third": (-0.176, -0.132),
            "second": (0.176, -0.132),
            "first": (0.176, 0.132),
        }
        for visual_order, (lesson, xy) in enumerate(expected.items()):
            slip = bpy.data.objects[f"lesson/{lesson}"]
            self.assertEqual(slip.type, "MESH")
            self.assertEqual(slip.parent, self.root)
            self.assertEqual(slip["visual_order"], visual_order)
            self.assertVectorAlmostEqual(slip.dimensions, DIMENSIONS["lesson_slip"])
            self.assertVectorAlmostEqual(slip.location[:2], xy)
            self.assertVectorAlmostEqual(slip["settled_location"], slip.location)
            self.assertEqual(len(slip.children), 0)

    def test_transmissions_are_independent_slips_with_method_strip(self):
        for module_order, (module, x) in enumerate(
            (("initial", -0.128), ("middle", 0.0), ("final", 0.128))
        ):
            slip = bpy.data.objects[f"transmission/{module}"]
            self.assertEqual(slip.parent, self.root)
            self.assertEqual(slip.type, "MESH")
            self.assertEqual(slip["module_order"], module_order)
            self.assertVectorAlmostEqual(slip.dimensions, DIMENSIONS["transmission_slip"])
            self.assertVectorAlmostEqual(slip.location[:2], (x, -0.205))
            self.assertVectorAlmostEqual(slip["settled_location"], slip.location)
        method = bpy.data.objects["transmission/method"]
        self.assertEqual(method.parent, self.root)
        self.assertEqual(method.type, "MESH")
        self.assertVectorAlmostEqual(method.dimensions, DIMENSIONS["method_slip"])
        self.assertVectorAlmostEqual(method.location[:2], (0.0, -0.247))

    def test_generals_are_independent_objects_on_one_shared_mesh(self):
        generals = [obj for obj in bpy.data.objects if obj.get("domain") == "general"]
        self.assertEqual(len(generals), 12)
        self.assertEqual({obj["general_key"] for obj in generals}, set(GENERAL_KEYS))
        self.assertEqual(len({obj.name for obj in generals}), 12)
        self.assertEqual(len({obj.data.name for obj in generals}), 1)
        self.assertEqual(len({obj.data.as_pointer() for obj in generals}), 1)
        self.assertEqual(len({id(obj) for obj in generals}), 12)
        for general in generals:
            self.assertEqual(general.parent, self.root)
            self.assertAlmostEqual(math.hypot(general.location.x, general.location.y), 0.218)
            self.assertAlmostEqual(general.dimensions.x, 0.028)
            self.assertAlmostEqual(general.dimensions.y, 0.028)
            self.assertAlmostEqual(general.dimensions.z, 0.004)

    def test_branch_inlays_form_complete_surface_rings(self):
        for surface, radius in (("earth", 0.202), ("heaven", 0.164)):
            parent = bpy.data.objects[f"plate/{surface}"]
            node_ids = [f"branch/{surface}/{branch}" for branch in BRANCHES]
            for node_id in node_ids:
                self.assertIn(node_id, bpy.data.objects)
            ring = [bpy.data.objects[node_id] for node_id in node_ids]
            self.assertEqual(len(ring), 12)
            for index, inlay in enumerate(ring):
                self.assertEqual(inlay.parent, parent)
                self.assertEqual(inlay["branch"], BRANCHES[index])
                self.assertEqual(inlay["ring_index"], index)
                self.assertAlmostEqual(math.hypot(inlay.location.x, inlay.location.y), radius)

    def test_helper_children_do_not_claim_runtime_ids(self):
        for obj in bpy.data.objects:
            if obj.name not in NODE_IDS:
                self.assertNotIn("node_id", obj, obj.name)


if __name__ == "__main__":
    unittest.main(argv=[__file__])
