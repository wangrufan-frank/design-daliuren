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
        self.assertEqual(DIMENSIONS["base"], (0.520, 0.520, 0.052))
        self.assertEqual(DIMENSIONS.get("earth_plate"), (0.440, 0.440, 0.014))
        self.assertEqual(DIMENSIONS["heaven_plate"], (0.380, 0.026))
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
        self.assertEqual(len(branch_node_ids), 24)
        for surface in ("earth", "heaven"):
            for branch in branches:
                self.assertIn(f"branch/{surface}/{branch}", NODE_IDS)


if __name__ == "__main__":
    unittest.main(argv=[__file__])
