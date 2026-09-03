import argparse
from pathlib import Path

from PIL import Image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--size", type=int, default=1024)
    args = parser.parse_args()

    with Image.open(args.source) as source:
        image = source.convert("RGB").resize(
            (args.size, args.size),
            Image.Resampling.LANCZOS,
        )
    image.save(args.destination, "JPEG", quality=86, subsampling=0, optimize=True)


if __name__ == "__main__":
    main()
