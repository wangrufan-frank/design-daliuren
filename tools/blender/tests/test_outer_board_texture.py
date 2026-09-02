import math
import unittest
from pathlib import Path

from PIL import Image


REPOSITORY_ROOT = Path(__file__).parents[3]
ALBEDO_PATH = REPOSITORY_ROOT / "assets/daliuren/textures/source/outer-board-v10-albedo.png"
NORMAL_PATH = REPOSITORY_ROOT / "assets/daliuren/textures/source/outer-board-v10-normal.png"


class OuterBoardTextureTest(unittest.TestCase):
    def test_interaction_disk_is_not_baked_into_the_outer_board(self):
        albedo = Image.open(ALBEDO_PATH).convert("RGB")
        normal = Image.open(NORMAL_PATH).convert("RGB")
        self.assertEqual(albedo.size, (2048, 2048))
        self.assertEqual(normal.size, albedo.size)

        minimum_luminance = 255
        for y in range(0, albedo.height, 12):
            for x in range(0, albedo.width, 12):
                if math.hypot(
                    x / (albedo.width - 1) - 0.478,
                    y / (albedo.height - 1) - 0.473,
                ) >= 0.328:
                    continue
                minimum_luminance = min(minimum_luminance, sum(albedo.getpixel((x, y))) / 3)
        self.assertGreater(minimum_luminance, 107)

        for point, minimum_chroma in (((1730, 1350), 100), ((650, 1800), 25)):
            color = albedo.getpixel(point)
            with self.subTest(point=point):
                self.assertGreater(max(color) - min(color), minimum_chroma)


if __name__ == "__main__":
    unittest.main()
