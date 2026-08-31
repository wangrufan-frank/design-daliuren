import argparse
from pathlib import Path

from PIL import Image


# Source order is upper-left, lower-left, lower-right, upper-right.
REFERENCE_QUAD = (296, 174, 57, 943, 1104, 1097, 1214, 296)


def rectify_reference(
    input_path,
    output_path,
    *,
    size=2048,
    quad=REFERENCE_QUAD,
    resample=Image.Resampling.BICUBIC,
    height_output=None,
):
    input_path = Path(input_path)
    output_path = Path(output_path)
    with Image.open(input_path) as source:
        result = source.convert("RGB").transform(
            (size, size),
            Image.Transform.QUAD,
            quad,
            resample=resample,
        )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(output_path, optimize=True)
    if height_output is not None:
        height_output = Path(height_output)
        height_output.parent.mkdir(parents=True, exist_ok=True)
        result.convert("L").save(height_output, optimize=True)
    return output_path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--size", type=int, default=2048)
    parser.add_argument("--height-output", type=Path)
    args = parser.parse_args()
    rectify_reference(
        args.input,
        args.output,
        size=args.size,
        height_output=args.height_output,
    )


if __name__ == "__main__":
    main()
