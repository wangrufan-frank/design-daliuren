"""Build the calibrated outer-board material from the approved v10 reference."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).parents[2]
OUTER_BOARD_SOURCE = ROOT / "assets/daliuren/references/daliuren-heaven-plate-translucent-jade-generals-v10.png"
OUTER_BOARD_ALBEDO = ROOT / "assets/daliuren/textures/source/outer-board-v10-albedo.png"
OUTER_BOARD_NORMAL = ROOT / "assets/daliuren/textures/source/outer-board-v10-normal.png"
SIZE = 2048


def _ellipse(mask, center, radius):
    x, y = center
    mask.ellipse((x - radius, y - radius, x + radius, y + radius), fill=255)


def generate():
    board = Image.open(OUTER_BOARD_SOURCE).convert("RGB").transform(
        (SIZE, SIZE),
        Image.Transform.QUAD,
        (318, 171, 65, 922, 1108, 1095, 1217, 280),
        resample=Image.Resampling.BICUBIC,
    )
    board = ImageEnhance.Color(board).enhance(1.16)

    # The rotating interaction stack, its four pearls, and all of their labels
    # remain independent geometry. Replace those photographed pixels with a
    # softly varying jade field so the material never creates a second dial.
    mask = Image.new("L", board.size, 0)
    draw = ImageDraw.Draw(mask)
    _ellipse(draw, (0.478 * SIZE, 0.473 * SIZE), int(0.334 * SIZE))
    for position in ((0.219, 0.213), (0.732, 0.214), (0.223, 0.728), (0.743, 0.707)):
        _ellipse(draw, (position[0] * SIZE, position[1] * SIZE), int(0.041 * SIZE))
    mask = mask.filter(ImageFilter.GaussianBlur(radius=12))
    jade_field = board.filter(ImageFilter.GaussianBlur(radius=180))
    board = Image.composite(jade_field, board, mask)

    height = board.convert("L").filter(ImageFilter.GaussianBlur(radius=0.8))
    normal_x = height.filter(ImageFilter.Kernel(
        (3, 3), (-1, 0, 1, -2, 0, 2, -1, 0, 1), scale=12, offset=128
    ))
    normal_y = height.filter(ImageFilter.Kernel(
        (3, 3), (-1, -2, -1, 0, 0, 0, 1, 2, 1), scale=12, offset=128
    ))
    normal = Image.merge("RGB", (normal_x, normal_y, Image.new("L", board.size, 255)))

    OUTER_BOARD_ALBEDO.parent.mkdir(parents=True, exist_ok=True)
    board.save(OUTER_BOARD_ALBEDO, optimize=True)
    normal.save(OUTER_BOARD_NORMAL, optimize=True)


if __name__ == "__main__":
    generate()
