import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

import daliuren_contract


DIMENSIONS = daliuren_contract.DIMENSIONS
NODE_IDS = daliuren_contract.NODE_IDS
POSE_IDS = daliuren_contract.POSE_IDS


FORBIDDEN_NODES = {
    "transmission/bridge",
    "anchor/course-copy/lessons",
    "anchor/course-copy/transmissions",
    "anchor/course-copy/generals",
}


class ContractTest(unittest.TestCase):
    def test_dimensions_match_confirmed_blueprint(self):
        self.assertEqual(DIMENSIONS["base"], (0.520, 0.520, 0.028))
        self.assertEqual(DIMENSIONS.get("earth_plate"), (0.500, 0.500, 0.006))
        self.assertEqual(DIMENSIONS["heaven_plate"], (0.332, 0.010))
        self.assertEqual(DIMENSIONS["general_ring"], (0.218, 0.007))
        self.assertEqual(DIMENSIONS["fixed_core"], (0.126, 0.006))
        self.assertEqual(DIMENSIONS.get("calendar_slip"), (0.300, 0.038, 0.009))
        self.assertEqual(DIMENSIONS.get("lesson_slip"), (0.074, 0.034, 0.009))
        self.assertEqual(DIMENSIONS.get("transmission_slip"), (0.070, 0.036, 0.010))
        self.assertEqual(DIMENSIONS.get("method_slip"), (0.098, 0.024, 0.008))
        self.assertEqual(DIMENSIONS.get("general_inlay"), (0.028, 0.004))

    def test_runtime_ids_are_unique_paths(self):
        self.assertEqual(len(NODE_IDS), len(set(NODE_IDS)))
        self.assertTrue(all("/" in node for node in NODE_IDS))
        self.assertEqual(POSE_IDS[0], "closed")

    def test_contract_replaces_mechanical_nodes_with_inlays_and_slips(self):
        self.assertTrue(FORBIDDEN_NODES.isdisjoint(NODE_IDS))
        self.assertIn("transmission/method", NODE_IDS)
        self.assertIn("trace/course", NODE_IDS)
        branches = getattr(daliuren_contract, "BRANCHES", ())
        branch_node_ids = getattr(daliuren_contract, "BRANCH_INLAY_NODE_IDS", ())
        self.assertEqual(branches, tuple("子丑寅卯辰巳午未申酉戌亥"))
        self.assertEqual(len(branch_node_ids), 12)
        for branch in branches:
            self.assertIn(f"branch/earth/{branch}", NODE_IDS)
            self.assertNotIn(f"branch/heaven/{branch}", NODE_IDS)
            self.assertIn(f"general-slot/{branch}", NODE_IDS)
        self.assertEqual(daliuren_contract.VISUAL_EARTH_ORDER, tuple("午未申酉戌亥子丑寅卯辰巳"))
        self.assertEqual(
            daliuren_contract.VISUAL_MONTH_ORDER,
            ("胜光", "小吉", "传送", "从魁", "河魁", "登明", "神后", "大吉", "功曹", "太冲", "天罡", "太乙"),
        )
        self.assertEqual(daliuren_contract.visual_angle(0), daliuren_contract.math.radians(90))
        self.assertEqual(daliuren_contract.visual_angle(1), daliuren_contract.math.radians(60))
        for month in daliuren_contract.VISUAL_MONTH_ORDER:
            self.assertIn(f"month-general/{month}", NODE_IDS)
        self.assertIn("interaction/month-general-ring", NODE_IDS)


if __name__ == "__main__":
    unittest.main(argv=[__file__])
