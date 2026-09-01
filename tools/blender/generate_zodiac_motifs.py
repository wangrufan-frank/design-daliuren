"""Build the deterministic outer-board artwork from the approved reference."""

from pathlib import Path

from PIL import Image, ImageEnhance


ROOT = Path(__file__).parents[2]
OUTER_BOARD_SOURCE = ROOT / "assets/daliuren/references/daliuren-heaven-plate-blank-v1.png"
OUTER_BOARD_OUTPUT = ROOT / "assets/daliuren/textures/source/outer-board-artwork.png"


def generate():
    # The blank v1 board is a calibrated, approved view of the outer relief.
    # Rectifying only its top board and masking the central dial keeps the image
    # as a material source while the independently modeled dial remains live.
    board = Image.open(OUTER_BOARD_SOURCE).convert("RGB").transform(
        (1024, 1024),
        Image.Transform.QUAD,
        (318, 171, 65, 922, 1108, 1095, 1217, 280),
        resample=Image.Resampling.BICUBIC,
    )
    board = ImageEnhance.Color(board).enhance(1.32)
    alpha = Image.new("L", board.size, 255)
    pixels = alpha.load()
    pearl_centers = ((220, 230), (743, 236), (216, 749), (747, 750))
    for y in range(board.height):
        for x in range(board.width):
            radius = ((x - 512) ** 2 + (y - 512) ** 2) ** 0.5
            value = 0 if radius < 326 else min(255, int((radius - 326) * 42.5))
            pearl_distance = min(
                ((x - px) ** 2 + (y - py) ** 2) ** 0.5
                for px, py in pearl_centers
            )
            if pearl_distance < 40:
                value = 0
            elif pearl_distance < 52:
                value = min(value, int((pearl_distance - 40) * 21.25))
            pixels[x, y] = value
    board.putalpha(alpha)
    OUTER_BOARD_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    board.save(OUTER_BOARD_OUTPUT, optimize=True)


if __name__ == "__main__":
    generate()
