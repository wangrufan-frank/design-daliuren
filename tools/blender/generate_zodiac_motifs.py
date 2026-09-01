"""Build deterministic board artwork and zodiac crops from approved references."""

from pathlib import Path

from PIL import Image, ImageEnhance


ROOT = Path(__file__).parents[2]
SOURCE = ROOT / "assets/daliuren/references/daliuren-white-jade-dunhuang-zodiac-v1.png"
OUTER_BOARD_SOURCE = ROOT / "assets/daliuren/references/daliuren-heaven-plate-blank-v1.png"
OUTPUT = ROOT / "assets/daliuren/textures/source/zodiac"
OUTER_BOARD_OUTPUT = ROOT / "assets/daliuren/textures/source/outer-board-artwork.png"

# Source-space quads follow the raised panels in the front-on approved reference.
MOTIF_QUADS = {
    "snake": ((73, 55), (418, 55), (418, 255), (73, 255)),
    "horse": ((415, 55), (840, 55), (840, 255), (415, 255)),
    "goat": ((835, 55), (1185, 55), (1185, 255), (835, 255)),
    "monkey": ((935, 235), (1180, 235), (1180, 485), (935, 485)),
    "rooster": ((935, 470), (1180, 470), (1180, 725), (935, 725)),
    "dog": ((885, 700), (1180, 700), (1180, 980), (885, 980)),
    "pig": ((675, 940), (1065, 940), (1065, 1180), (675, 1180)),
    "rat": ((400, 940), (705, 940), (705, 1180), (400, 1180)),
    "ox": ((80, 940), (430, 940), (430, 1180), (80, 1180)),
    "tiger": ((50, 690), (350, 690), (350, 980), (50, 980)),
    "rabbit": ((50, 450), (330, 450), (330, 725), (50, 725)),
    "dragon": ((50, 225), (330, 225), (330, 490), (50, 490)),
}


def _output_size(quad):
    width = ((quad[1][0] - quad[0][0]) ** 2 + (quad[1][1] - quad[0][1]) ** 2) ** 0.5
    height = ((quad[3][0] - quad[0][0]) ** 2 + (quad[3][1] - quad[0][1]) ** 2) ** 0.5
    return (320, 192) if width >= height else (192, 320)


def generate():
    source = Image.open(SOURCE).convert("RGB")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for animal, quad in MOTIF_QUADS.items():
        texture = source.transform(
            _output_size(quad),
            Image.Transform.QUAD,
            tuple(component for point in quad for component in point),
            resample=Image.Resampling.BICUBIC,
        )
        texture = ImageEnhance.Color(texture).enhance(2.65)
        texture = ImageEnhance.Contrast(texture).enhance(1.45)
        texture.save(OUTPUT / f"{animal}.png", optimize=True)

    # The blank v1 board is a calibrated, approved view of the outer relief.
    # Rectifying only its top board and masking the central dial keeps the image
    # as a material source while the independently modeled dial remains live.
    board = Image.open(OUTER_BOARD_SOURCE).convert("RGB").transform(
        (1024, 1024),
        Image.Transform.QUAD,
        (318, 171, 1217, 280, 1108, 1095, 65, 922),
        resample=Image.Resampling.BICUBIC,
    )
    board = ImageEnhance.Color(board).enhance(1.32)
    alpha = Image.new("L", board.size, 255)
    pixels = alpha.load()
    for y in range(board.height):
        for x in range(board.width):
            radius = ((x - 512) ** 2 + (y - 512) ** 2) ** 0.5
            pixels[x, y] = 0 if radius < 326 else min(255, int((radius - 326) * 42.5))
    board.putalpha(alpha)
    OUTER_BOARD_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    board.save(OUTER_BOARD_OUTPUT, optimize=True)


if __name__ == "__main__":
    generate()
