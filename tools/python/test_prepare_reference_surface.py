import tempfile
import unittest
from pathlib import Path
import sys

from PIL import Image
from PIL import ImageDraw

sys.path.insert(0, str(Path(__file__).parent))

from prepare_reference_surface import rectify_reference


class PrepareReferenceSurfaceTest(unittest.TestCase):
    def test_rectifies_the_declared_quadrilateral_to_a_square_texture(self):
        source = Image.new("RGB", (20, 20), "black")
        draw = ImageDraw.Draw(source)
        draw.rectangle((2, 1, 6, 5), fill=(255, 0, 0))
        draw.rectangle((1, 14, 5, 18), fill=(0, 255, 0))
        draw.rectangle((15, 15, 19, 19), fill=(0, 0, 255))
        draw.rectangle((14, 2, 18, 6), fill=(255, 255, 0))

        with tempfile.TemporaryDirectory() as directory:
            input_path = Path(directory) / "input.png"
            output_path = Path(directory) / "output.png"
            source.save(input_path)

            rectify_reference(
                input_path,
                output_path,
                size=10,
                quad=(4, 3, 3, 16, 17, 17, 16, 4),
                resample=Image.Resampling.NEAREST,
            )

            result = Image.open(output_path)
            self.assertEqual(result.size, (10, 10))
            self.assertEqual(result.getpixel((0, 0)), (255, 0, 0))
            self.assertEqual(result.getpixel((0, 9)), (0, 255, 0))
            self.assertEqual(result.getpixel((9, 9)), (0, 0, 255))
            self.assertEqual(result.getpixel((9, 0)), (255, 255, 0))

    def test_writes_a_separate_grayscale_height_texture_for_relief(self):
        source = Image.new("RGB", (8, 8), (120, 80, 40))
        with tempfile.TemporaryDirectory() as directory:
            input_path = Path(directory) / "input.png"
            output_path = Path(directory) / "surface.png"
            height_path = Path(directory) / "height.png"
            source.save(input_path)

            rectify_reference(
                input_path,
                output_path,
                height_output=height_path,
                size=4,
                quad=(0, 0, 0, 7, 7, 7, 7, 0),
            )

            with Image.open(height_path) as height:
                self.assertEqual(height.mode, "L")
                self.assertEqual(height.size, (4, 4))


if __name__ == "__main__":
    unittest.main()
