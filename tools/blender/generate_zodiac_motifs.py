"""Build the deterministic zodiac-relief artwork from the approved v10 reference."""

from pathlib import Path

from PIL import Image, ImageEnhance


ROOT = Path(__file__).parents[2]
ZODIAC_RELIEF_SOURCE = ROOT / "assets/daliuren/references/daliuren-heaven-plate-translucent-jade-generals-v10.png"
ZODIAC_RELIEF_OUTPUT = ROOT / "assets/daliuren/textures/source/zodiac-relief-artwork.png"


def generate():
    # The image supplies colour only to the raised zodiac silhouette meshes.
    # It is never projected onto plate/earth or another full-board carrier.
    board = Image.open(ZODIAC_RELIEF_SOURCE).convert("RGB").transform(
        (1024, 1024),
        Image.Transform.QUAD,
        (318, 171, 65, 922, 1108, 1095, 1217, 280),
        resample=Image.Resampling.BICUBIC,
    )
    board = ImageEnhance.Color(board).enhance(1.32)
    ZODIAC_RELIEF_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    board.save(ZODIAC_RELIEF_OUTPUT, optimize=True)


if __name__ == "__main__":
    generate()
