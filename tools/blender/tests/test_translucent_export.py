import json
import struct
import unittest
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).parents[3]
MODEL_ROOT = REPOSITORY_ROOT / "public/models/daliuren"


def glb_json(path):
    data = path.read_bytes()
    length, chunk_type = struct.unpack_from("<II", data, 12)
    if chunk_type != 0x4E4F534A:
        raise AssertionError("missing GLB JSON chunk")
    return json.loads(data[20 : 20 + length].decode("utf-8"))


class TranslucentExportTests(unittest.TestCase):
    def test_all_lods_preserve_translucent_general_extensions(self):
        for level in range(3):
            payload = glb_json(MODEL_ROOT / f"daliuren-artifact-lod{level}.glb")
            node = next(item for item in payload["nodes"] if item.get("name") == f"lod{level}/general/noble")
            primitive = payload["meshes"][node["mesh"]]["primitives"][0]
            material = payload["materials"][primitive["material"]]
            extensions = material.get("extensions", {})
            with self.subTest(level=level):
                self.assertEqual(material.get("extras", {}).get("material_family"), "M_TranslucentJade")
                self.assertAlmostEqual(extensions["KHR_materials_ior"]["ior"], 1.48, places=6)
                self.assertAlmostEqual(extensions["KHR_materials_transmission"]["transmissionFactor"], 0.12, places=6)
                self.assertAlmostEqual(material["extras"]["modeled_thickness_m"], 0.004, places=6)


if __name__ == "__main__":
    unittest.main(argv=[__file__])
