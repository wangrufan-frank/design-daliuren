import sys
import unittest
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).parents[1]))
from render_lookdev_review import analyze_legibility_image, build_lookdev_scene, validate_legibility_metrics


REPOSITORY_ROOT = Path(__file__).parents[3]
MASTER_PATH = REPOSITORY_ROOT / "assets/daliuren/source/daliuren-artifact-master.blend"
LEGIBILITY_PATH = REPOSITORY_ROOT / "docs/asset-reviews/lookdev/legibility.png"


class LookdevReadabilityTest(unittest.TestCase):
    def test_current_legibility_frame_meets_functional_glyph_contrast_guard(self):
        bpy.ops.wm.open_mainfile(filepath=str(MASTER_PATH))
        build_lookdev_scene()
        metrics = analyze_legibility_image(LEGIBILITY_PATH)
        self.assertGreater(metrics["functional_text_contrast_ratio"], 4.0, metrics)
        validate_legibility_metrics(metrics)


if __name__ == "__main__":
    unittest.main(argv=[__file__, *(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])])
