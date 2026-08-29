import importlib.util
import sys
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("encode_ktx2.py")
SPEC = importlib.util.spec_from_file_location("encode_ktx2", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class EncodeKtx2Test(unittest.TestCase):
    def test_uastc_data_settings_are_deterministic_and_high_quality(self):
        self.assertEqual(
            MODULE.encoder_options("uastc"),
            {
                "codec": "uastc",
                "quality": 100,
                "effort": 4,
                "srgb": False,
                "linear": True,
                "mipmaps": True,
                "threads": 1,
                "zstd_supercompression_level": 18,
                "uastc_rdo_lambda": 4.0,
            },
        )

    def test_etc1s_color_settings_are_deterministic_and_maximum_quality(self):
        self.assertEqual(
            MODULE.encoder_options("etc1s"),
            {
                "codec": "etc1s",
                "quality": 100,
                "effort": 10,
                "srgb": True,
                "linear": False,
                "mipmaps": True,
                "threads": 1,
                "etc1s_compression_level": 6,
            },
        )

    def test_unknown_mode_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unsupported KTX2 mode"):
            MODULE.encoder_options("rgba")


if __name__ == "__main__":
    unittest.main()
