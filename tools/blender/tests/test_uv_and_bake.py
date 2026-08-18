import hashlib
import json
import math
import struct
import sys
import tempfile
import unittest
import zlib
from pathlib import Path

import bpy
from mathutils import Vector


BLENDER_DIR = Path(__file__).parents[1]
REPOSITORY_ROOT = Path(__file__).parents[3]
CONTRACT_PATH = REPOSITORY_ROOT / "assets/daliuren/materials/material-contract.json"

sys.path.insert(0, str(BLENDER_DIR))

from build_graybox import build_master
from daliuren_contract import NODE_IDS
from uv_and_bake import (
    DYNAMIC_LABEL_OWNERS,
    FORBIDDEN_COURSE_VALUES,
    MATERIAL_FAMILIES,
    _add_dynamic_surfaces,
    detect_uv_issues,
    prepare_runtime_assets,
)


FORBIDDEN_DYNAMIC_TEXT = {
    "贵人",
    "初传",
    "中传",
    "末传",
    "父母",
    "官鬼",
    "庚申",
    "辛酉",
    "戊子",
    "胜光",
}
SAMPLE_COURSE_VALUES = {
    "2026-08-14T23:57:00",
    "2026-08-15",
    "二〇二六年七月初二",
    "丙午",
    "丙申",
    "辛酉",
    "戊子",
    "辛",
    "胜光",
    "反吟",
    "重审",
    "子",
    "丑",
    "寅",
    "卯",
    "辰",
    "巳",
    "午",
    "未",
    "申",
    "酉",
    "戌",
    "亥",
    "贵人",
    "螣蛇",
    "朱雀",
    "六合",
    "勾陈",
    "青龙",
    "天空",
    "白虎",
    "太常",
    "玄武",
    "太阴",
    "天后",
    "初传",
    "中传",
    "末传",
    "父母",
    "子孙",
    "官鬼",
    "妻财",
    "兄弟",
}


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def png_rgb(path):
    data = Path(path).read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise AssertionError(f"Not a PNG: {path}")
    position = 8
    chunks = []
    width = height = bit_depth = color_type = None
    while position < len(data):
        length = struct.unpack(">I", data[position : position + 4])[0]
        kind = data[position + 4 : position + 8]
        payload = data[position + 8 : position + 8 + length]
        position += length + 12
        if kind == b"IHDR":
            width, height, bit_depth, color_type = struct.unpack(">IIBB", payload[:10])
        elif kind == b"IDAT":
            chunks.append(payload)
        elif kind == b"IEND":
            break
    if bit_depth != 8 or color_type != 2:
        raise AssertionError(f"Expected opaque 8-bit RGB PNG, got {bit_depth=} {color_type=}")
    raw = zlib.decompress(b"".join(chunks))
    stride = width * 3
    rows = []
    for row_index in range(height):
        offset = row_index * (stride + 1)
        if raw[offset] != 0:
            raise AssertionError("Fixture decoder only accepts deterministic filter-none rows")
        rows.append(raw[offset + 1 : offset + 1 + stride])
    return width, height, rows


def pixel(rows, x, y):
    offset = x * 3
    return tuple(rows[y][offset : offset + 3])


def object_text(obj):
    values = [obj.name, obj.data.name]
    values.extend(str(value) for value in obj.values())
    if obj.type == "FONT":
        values.append(obj.data.body)
    return " ".join(values)


def world_bounds(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        tuple(min(corner[axis] for corner in corners) for axis in range(3)),
        tuple(max(corner[axis] for corner in corners) for axis in range(3)),
    )


MOVING_ROOTS = {
    "calendar/slip",
    "lesson/first",
    "lesson/second",
    "lesson/third",
    "lesson/fourth",
    "transmission/bridge",
    *(f"general/{key}" for key in (
        "noble",
        "snake",
        "vermilion-bird",
        "harmony",
        "hook-array",
        "azure-dragon",
        "void",
        "white-tiger",
        "constant",
        "black-tortoise",
        "yin",
        "queen-of-heaven",
    )),
}


def moving_root(obj):
    current = obj
    while current is not None:
        if current.get("node_id") in MOVING_ROOTS:
            return current.get("node_id")
        current = current.parent
    return None


class UVDetectionTest(unittest.TestCase):
    def tearDown(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def _mesh(self, name, vertices, faces, uvs):
        mesh = bpy.data.meshes.new(f"{name}/mesh")
        mesh.from_pydata(vertices, (), faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        layer = mesh.uv_layers.new(name="UVMap")
        layer.active_render = True
        for item, coordinate in zip(layer.data, uvs):
            item.uv = coordinate
        return obj

    def test_detector_rejects_real_triangle_overlap_degeneracy_and_out_of_range_uvs(self):
        overlap = self._mesh(
            "overlap",
            ((0, 0, 0), (1, 0, 0), (0, 1, 0), (2, 0, 0), (3, 0, 0), (2, 1, 0)),
            ((0, 1, 2), (3, 4, 5)),
            ((0.1, 0.1), (0.8, 0.1), (0.1, 0.8), (0.2, 0.2), (0.9, 0.2), (0.2, 0.9)),
        )
        degenerate = self._mesh(
            "degenerate",
            ((0, 0, 0), (1, 0, 0), (0, 1, 0)),
            ((0, 1, 2),),
            ((0.1, 0.1), (0.5, 0.1), (0.9, 0.1)),
        )
        out_of_range = self._mesh(
            "out-of-range",
            ((0, 0, 0), (1, 0, 0), (0, 1, 0)),
            ((0, 1, 2),),
            ((-0.01, 0.1), (0.5, 0.1), (0.1, 0.5)),
        )

        self.assertIn("triangle-overlap", detect_uv_issues(overlap))
        self.assertIn("degenerate-triangle", detect_uv_issues(degenerate))
        self.assertIn("out-of-range", detect_uv_issues(out_of_range))

    def test_denylist_covers_every_current_sample_course_value(self):
        self.assertTrue(SAMPLE_COURSE_VALUES.issubset(set(FORBIDDEN_COURSE_VALUES)))


class DynamicSurfaceVisibilityTest(unittest.TestCase):
    def tearDown(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def test_dynamic_label_centers_are_not_hidden_below_other_meshes(self):
        build_master()
        surfaces = _add_dynamic_surfaces()
        bpy.context.view_layer.update()
        physical_meshes = [
            obj
            for obj in bpy.data.objects
            if obj.type == "MESH" and not obj.get("dynamic_label_id")
        ]
        for surface in surfaces:
            center = surface.matrix_world @ surface.data.polygons[0].center
            owner = moving_root(surface)
            occluders = []
            for obj in physical_meshes:
                if moving_root(obj) != owner:
                    continue
                minimum, maximum = world_bounds(obj)
                if (
                    minimum[0] < center.x < maximum[0]
                    and minimum[1] < center.y < maximum[1]
                    and maximum[2] > center.z + 0.00001
                ):
                    occluders.append(obj.name)
            with self.subTest(dynamic_id=surface["dynamic_label_id"]):
                self.assertEqual(occluders, [])


class RuntimeUVAndBakeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory()
        cls.directory = Path(cls.temporary.name)
        cls.texture_root = cls.directory / "textures"
        cls.contract_path = cls.directory / "material-contract.json"
        cls.contract_path.write_text(CONTRACT_PATH.read_text(encoding="utf-8"), encoding="utf-8")
        cls.root = build_master()
        cls.frozen_counts = {
            "runtime": sum("node_id" in obj for obj in bpy.data.objects),
            "details": sum("detail_id" in obj for obj in bpy.data.objects),
            "inscriptions": sum("inscription_role" in obj for obj in bpy.data.objects),
        }
        prepare_runtime_assets(cls.root, cls.texture_root, cls.contract_path)
        cls.contract = json.loads(cls.contract_path.read_text(encoding="utf-8"))

    @classmethod
    def tearDownClass(cls):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        cls.temporary.cleanup()

    def test_every_export_mesh_has_one_valid_non_overlapping_primary_uv_set(self):
        meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
        self.assertGreater(len(meshes), 180)
        for obj in meshes:
            with self.subTest(object=obj.name):
                self.assertEqual(tuple(layer.name for layer in obj.data.uv_layers), ("UVMap",))
                self.assertTrue(obj.data.uv_layers["UVMap"].active_render)
                self.assertEqual(detect_uv_issues(obj), ())

    def test_dynamic_surfaces_have_exact_identity_hierarchy_material_and_stable_uvs(self):
        surfaces = [obj for obj in bpy.data.objects if obj.get("dynamic_label_id")]
        self.assertEqual(len(surfaces), 21)
        self.assertEqual({obj["dynamic_label_id"] for obj in surfaces}, set(DYNAMIC_LABEL_OWNERS))
        self.assertEqual(sum("node_id" in obj for obj in bpy.data.objects), self.frozen_counts["runtime"])
        self.assertEqual({obj["node_id"] for obj in bpy.data.objects if "node_id" in obj}, set(NODE_IDS))
        self.assertEqual(sum("detail_id" in obj for obj in bpy.data.objects), self.frozen_counts["details"])
        self.assertEqual(sum("inscription_role" in obj for obj in bpy.data.objects), self.frozen_counts["inscriptions"])

        expected_uvs = ((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))
        for obj in surfaces:
            dynamic_id = obj["dynamic_label_id"]
            with self.subTest(dynamic_id=dynamic_id):
                owner_id = DYNAMIC_LABEL_OWNERS[dynamic_id]
                self.assertEqual(obj.parent.get("node_id"), owner_id)
                self.assertEqual(obj["owner_node_id"], owner_id)
                self.assertNotIn("node_id", obj)
                self.assertEqual(len(obj.data.vertices), 4)
                self.assertEqual(len(obj.data.polygons), 1)
                self.assertGreater(obj.data.polygons[0].normal.z, 0.999)
                self.assertEqual(len(obj.data.materials), 1)
                self.assertEqual(obj.data.materials[0].name, "M_DynamicLabelPlaceholder")
                actual_uvs = tuple(tuple(round(value, 6) for value in item.uv) for item in obj.data.uv_layers["UVMap"].data)
                self.assertEqual(actual_uvs, expected_uvs)
                text = object_text(obj)
                self.assertFalse(any(value in text for value in SAMPLE_COURSE_VALUES))

        contract_forbidden = set(self.contract["runtimeTextures"]["dynamicLabels"]["forbiddenCourseValues"])
        self.assertTrue(FORBIDDEN_DYNAMIC_TEXT.issubset(contract_forbidden))

    def test_texture_contract_matches_real_opaque_runtime_pngs_and_literal_pixels(self):
        runtime = self.contract["runtimeTextures"]
        self.assertEqual(runtime["channels"], {
            "baseColor": "sRGB RGB",
            "orm": "Non-Color RGB: AO=R, roughness=G, metallic=B",
            "normal": "Non-Color RGB tangent-space",
        })
        self.assertNotIn("emissive", runtime["channels"])
        self.assertEqual(set(runtime["families"]), set(MATERIAL_FAMILIES))

        for family, payload in runtime["families"].items():
            for lod, expected_dimension in (("lod0", 2048), ("lod2", 1024)):
                maps = payload[lod]
                self.assertEqual(set(maps), {"baseColor", "orm", "normal"})
                for role, record in maps.items():
                    path = self.texture_root / record["file"]
                    with self.subTest(family=family, lod=lod, role=role):
                        self.assertTrue(path.is_file())
                        self.assertEqual(record["dimensions"], [expected_dimension, expected_dimension])
                        self.assertEqual(record["channels"], "RGB")
                        self.assertEqual(record["sha256"], sha256(path))
                        width, height, _ = png_rgb(path)
                        self.assertEqual((width, height), (expected_dimension, expected_dimension))
                        self.assertGreater(path.stat().st_size, 10_000)

        literal_base_pixels = {
            "M_Bronze": (34, 46, 43),
            "M_Patina": (64, 89, 80),
            "M_Celadon": (133, 153, 144),
            "M_OldGold": (127, 111, 75),
            "M_AshText": (194, 198, 187),
        }
        for family, expected in literal_base_pixels.items():
            record = runtime["families"][family]["lod0"]["baseColor"]
            _, _, rows = png_rgb(self.texture_root / record["file"])
            with self.subTest(family=family):
                self.assertEqual(pixel(rows, 0, 0), expected)
                self.assertNotEqual(pixel(rows, 64, 0), expected)

        literal_orm_pixels = {
            "M_Bronze": (210, 148, 245),
            "M_Patina": (196, 184, 238),
            "M_Celadon": (232, 87, 0),
            "M_OldGold": (224, 97, 250),
            "M_AshText": (238, 173, 0),
        }
        for family, expected in literal_orm_pixels.items():
            record = runtime["families"][family]["lod0"]["orm"]
            _, _, rows = png_rgb(self.texture_root / record["file"])
            with self.subTest(family=family, role="orm"):
                self.assertEqual(pixel(rows, 0, 0), expected)
                self.assertNotEqual(pixel(rows, 64, 128), expected)

        bronze = runtime["families"]["M_Bronze"]["lod0"]
        _, _, orm_rows = png_rgb(self.texture_root / bronze["orm"]["file"])
        _, _, normal_rows = png_rgb(self.texture_root / bronze["normal"]["file"])
        self.assertEqual(pixel(orm_rows, 0, 0), (210, 148, 245))
        self.assertNotEqual(pixel(orm_rows, 64, 128), (210, 148, 245))
        self.assertEqual(pixel(normal_rows, 0, 0), (128, 128, 255))
        varied_normal = pixel(normal_rows, 64, 64)
        self.assertNotEqual(varied_normal, (128, 128, 255))
        length = math.sqrt(sum(((channel - 128) / 127.0) ** 2 for channel in varied_normal[:2]) + ((varied_normal[2] - 128) / 127.0) ** 2)
        self.assertAlmostEqual(length, 1.0, delta=0.04)

        committed = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))["runtimeTextures"]
        for family in MATERIAL_FAMILIES:
            for lod in ("lod0", "lod2"):
                for role in ("baseColor", "orm", "normal"):
                    self.assertEqual(
                        runtime["families"][family][lod][role]["sha256"],
                        committed["families"][family][lod][role]["sha256"],
                    )

    def test_repeat_rejects_before_mutating_scene_or_outputs(self):
        counts_before = (len(bpy.data.objects), len(bpy.data.materials), len(bpy.data.images))
        hashes_before = {
            path.relative_to(self.texture_root).as_posix(): sha256(path)
            for path in self.texture_root.rglob("*.png")
        }
        contract_before = self.contract_path.read_bytes()

        with self.assertRaisesRegex(RuntimeError, "already prepared"):
            prepare_runtime_assets(self.root, self.texture_root, self.contract_path)

        self.assertEqual((len(bpy.data.objects), len(bpy.data.materials), len(bpy.data.images)), counts_before)
        self.assertEqual(
            {path.relative_to(self.texture_root).as_posix(): sha256(path) for path in self.texture_root.rglob("*.png")},
            hashes_before,
        )
        self.assertEqual(self.contract_path.read_bytes(), contract_before)


if __name__ == "__main__":
    unittest.main(argv=[__file__])
