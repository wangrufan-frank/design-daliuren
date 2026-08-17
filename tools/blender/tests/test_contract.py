import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from daliuren_contract import DIMENSIONS, NODE_IDS, POSE_IDS


class ContractTest(unittest.TestCase):
    def test_dimensions_match_confirmed_blueprint(self):
        self.assertEqual(DIMENSIONS["base"], (0.520, 0.520, 0.052))
        self.assertEqual(DIMENSIONS["heaven_plate"], (0.380, 0.024))
        self.assertEqual(DIMENSIONS["lesson"], (0.152, 0.100))
        self.assertEqual(DIMENSIONS["slip_rise"], 0.012)
        self.assertEqual(DIMENSIONS["lesson_travel"], 0.092)
        self.assertEqual(DIMENSIONS["lesson_readout_rise"], 0.008)
        self.assertEqual(DIMENSIONS["bridge_travel"], 0.118)
        self.assertEqual(DIMENSIONS["general_rise"], 0.007)

    def test_runtime_ids_are_unique_ascii_paths(self):
        self.assertEqual(len(NODE_IDS), len(set(NODE_IDS)))
        self.assertTrue(all(node.isascii() and "/" in node for node in NODE_IDS))
        self.assertEqual(POSE_IDS[0], "closed")


if __name__ == "__main__":
    unittest.main(argv=[__file__])
