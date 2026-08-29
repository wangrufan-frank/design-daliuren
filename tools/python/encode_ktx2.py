import argparse
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path


ENCODER_PACKAGE = "alktx2"
ENCODER_VERSION = "0.1.7"


def encoder_options(mode):
    common = {
        "quality": 100,
        "srgb": mode == "etc1s",
        "linear": mode == "uastc",
        "mipmaps": True,
        "threads": 1,
    }
    if mode == "uastc":
        return {
            "codec": "uastc",
            **common,
            "effort": 4,
            "zstd_supercompression_level": 18,
            "uastc_rdo_lambda": 4.0,
        }
    if mode == "etc1s":
        return {
            "codec": "etc1s",
            **common,
            "effort": 10,
            "etc1s_compression_level": 6,
        }
    raise ValueError(f"Unsupported KTX2 mode: {mode}")


def require_encoder():
    try:
        installed = version(ENCODER_PACKAGE)
    except PackageNotFoundError as error:
        raise RuntimeError(
            "Missing asset encoder; run npm run asset:install-python-tools"
        ) from error
    if installed != ENCODER_VERSION:
        raise RuntimeError(
            f"{ENCODER_PACKAGE} {ENCODER_VERSION} is required, got {installed}"
        )
    import alktx2

    return alktx2


def encode(source, destination, mode, mime):
    encoder = require_encoder()
    result = encoder.encode_bytes_to_ktx2(
        Path(source).read_bytes(),
        mime=mime,
        **encoder_options(mode),
    )
    Path(destination).write_bytes(result)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", required=True, choices=("uastc", "etc1s"))
    parser.add_argument("--mime", required=True)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    return parser.parse_args()


def main():
    args = parse_args()
    encode(args.source, args.destination, args.mode, args.mime)


if __name__ == "__main__":
    main()
