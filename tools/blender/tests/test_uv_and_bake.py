import hashlib
import json
import math
import struct
import sys
import tempfile
import unittest
import zlib
from collections import defaultdict
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


BLENDER_DIR = Path(__file__).parents[1]
REPOSITORY_ROOT = Path(__file__).parents[3]
CONTRACT_PATH = REPOSITORY_ROOT / "assets/daliuren/materials/material-contract.json"

sys.path.insert(0, str(BLENDER_DIR))

from build_graybox import build_master
from daliuren_contract import NODE_IDS
from uv_and_bake import (
    DYNAMIC_COURSE_VALUES_BY_FIELD,
    DYNAMIC_LABEL_OWNERS,
    MATERIAL_FAMILIES,
    _add_dynamic_surfaces,
    assign_primary_uvs,
    detect_uv_issues,
    generate_runtime_textures,
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


def triangle_uv_pixel(obj, triangle, dimension):
    layer = obj.data.uv_layers["UVMap"]
    u = sum(layer.data[index].uv.x for index in triangle.loops) / 3
    v = sum(layer.data[index].uv.y for index in triangle.loops) / 3
    return (
        min(dimension - 1, max(0, int(u * dimension))),
        min(dimension - 1, max(0, int(v * dimension))),
    )


def triangle_interior_pixel(obj, triangle, dimension):
    layer = obj.data.uv_layers["UVMap"]
    uv = [tuple(layer.data[index].uv) for index in triangle.loops]
    denominator = (
        (uv[1][1] - uv[2][1]) * (uv[0][0] - uv[2][0])
        + (uv[2][0] - uv[1][0]) * (uv[0][1] - uv[2][1])
    )
    minimum_x = max(0, int(math.floor(min(value[0] for value in uv) * dimension)))
    maximum_x = min(dimension, int(math.ceil(max(value[0] for value in uv) * dimension)))
    minimum_y = max(0, int(math.floor(min(value[1] for value in uv) * dimension)))
    maximum_y = min(dimension, int(math.ceil(max(value[1] for value in uv) * dimension)))
    best = None
    for y in range(minimum_y, maximum_y):
        v = (y + 0.5) / dimension
        for x in range(minimum_x, maximum_x):
            u = (x + 0.5) / dimension
            first = ((uv[1][1] - uv[2][1]) * (u - uv[2][0]) + (uv[2][0] - uv[1][0]) * (v - uv[2][1])) / denominator
            second = ((uv[2][1] - uv[0][1]) * (u - uv[2][0]) + (uv[0][0] - uv[2][0]) * (v - uv[2][1])) / denominator
            margin = min(first, second, 1.0 - first - second)
            if margin >= -1e-9 and (best is None or margin > best[0]):
                best = (margin, x, y)
    if best is None:
        raise AssertionError(f"Triangle {obj.name}:{triangle.index} covers no pixel center")
    return best[1], best[2]


def largest_uv_triangle(obj, predicate=lambda triangle: True):
    obj.data.calc_loop_triangles()
    candidates = [triangle for triangle in obj.data.loop_triangles if predicate(triangle)]
    return max(candidates, key=lambda triangle: uv_triangle_area(obj, triangle))


def uv_triangle_area(obj, triangle):
    return abs(
        (obj.data.uv_layers["UVMap"].data[triangle.loops[1]].uv.x - obj.data.uv_layers["UVMap"].data[triangle.loops[0]].uv.x)
        * (obj.data.uv_layers["UVMap"].data[triangle.loops[2]].uv.y - obj.data.uv_layers["UVMap"].data[triangle.loops[0]].uv.y)
        - (obj.data.uv_layers["UVMap"].data[triangle.loops[1]].uv.y - obj.data.uv_layers["UVMap"].data[triangle.loops[0]].uv.y)
        * (obj.data.uv_layers["UVMap"].data[triangle.loops[2]].uv.x - obj.data.uv_layers["UVMap"].data[triangle.loops[0]].uv.x)
    ) / 2


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


def uv_triangles(obj):
    mesh = obj.data
    layer = mesh.uv_layers["UVMap"]
    mesh.calc_loop_triangles()
    return [
        tuple(tuple(layer.data[loop_index].uv) for loop_index in triangle.loops)
        for triangle in mesh.loop_triangles
    ]


def triangles_overlap(first, second, epsilon=1e-12):
    for triangle in (first, second):
        for index, point in enumerate(triangle):
            following = triangle[(index + 1) % 3]
            axis = (-(following[1] - point[1]), following[0] - point[0])
            first_projection = [value[0] * axis[0] + value[1] * axis[1] for value in first]
            second_projection = [value[0] * axis[0] + value[1] * axis[1] for value in second]
            if max(first_projection) <= min(second_projection) + epsilon:
                return False
            if max(second_projection) <= min(first_projection) + epsilon:
                return False
    return True


def first_cross_mesh_overlap(objects):
    buckets = defaultdict(list)
    for obj in sorted(objects, key=lambda item: item.name):
        mesh_pointer = obj.data.as_pointer()
        for triangle in uv_triangles(obj):
            minimum_x = max(0, min(63, int(min(point[0] for point in triangle) * 64)))
            maximum_x = max(0, min(63, int(max(point[0] for point in triangle) * 64)))
            minimum_y = max(0, min(63, int(min(point[1] for point in triangle) * 64)))
            maximum_y = max(0, min(63, int(max(point[1] for point in triangle) * 64)))
            keys = [
                (x, y)
                for x in range(minimum_x, maximum_x + 1)
                for y in range(minimum_y, maximum_y + 1)
            ]
            seen = set()
            for key in keys:
                for other_name, other_pointer, other_triangle in buckets[key]:
                    token = (other_name, other_triangle)
                    if token in seen or other_pointer == mesh_pointer:
                        continue
                    seen.add(token)
                    if triangles_overlap(other_triangle, triangle):
                        return other_name, obj.name
            for key in keys:
                buckets[key].append((obj.name, mesh_pointer, triangle))
    return None


def family_atlas_failures(objects):
    representatives = {}
    for obj in sorted(objects, key=lambda item: item.name):
        representatives.setdefault(obj.data.as_pointer(), obj)
    triangles = []
    out_of_range = []
    degenerate = []
    for obj in representatives.values():
        for triangle_index, triangle in enumerate(uv_triangles(obj)):
            identity = (obj.name, triangle_index)
            if any(not math.isfinite(value) or value < 0.0 or value > 1.0 for point in triangle for value in point):
                out_of_range.append(identity)
            area = abs(
                (triangle[1][0] - triangle[0][0]) * (triangle[2][1] - triangle[0][1])
                - (triangle[1][1] - triangle[0][1]) * (triangle[2][0] - triangle[0][0])
            ) / 2
            if area <= 1e-16:
                degenerate.append(identity)
            triangles.append((identity, triangle))

    buckets = defaultdict(list)
    overlap = None
    for identity, triangle in triangles:
        minimum_x = max(0, min(63, int(min(point[0] for point in triangle) * 64)))
        maximum_x = max(0, min(63, int(max(point[0] for point in triangle) * 64)))
        minimum_y = max(0, min(63, int(min(point[1] for point in triangle) * 64)))
        maximum_y = max(0, min(63, int(max(point[1] for point in triangle) * 64)))
        keys = tuple((x, y) for x in range(minimum_x, maximum_x + 1) for y in range(minimum_y, maximum_y + 1))
        candidates = {}
        for key in keys:
            for other_identity, other_triangle in buckets[key]:
                candidates[other_identity] = other_triangle
        for other_identity, other_triangle in candidates.items():
            if triangles_overlap(other_triangle, triangle):
                overlap = (other_identity, identity)
                break
        if overlap:
            break
        for key in keys:
            buckets[key].append((identity, triangle))
    return {
        "outOfRange": out_of_range,
        "degenerate": degenerate,
        "overlap": overlap,
    }


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

    def test_dynamic_course_value_policy_is_split_by_runtime_field(self):
        expected_fields = {"calendar", "lessons", "transmissions", "generals", "method"}
        self.assertEqual(set(DYNAMIC_COURSE_VALUES_BY_FIELD), expected_fields)
        self.assertTrue(SAMPLE_COURSE_VALUES.issubset({
            value
            for values in DYNAMIC_COURSE_VALUES_BY_FIELD.values()
            for value in values
        }))

    def test_texture_generation_rejects_an_empty_scene_without_outputs(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "textures"
            with self.assertRaisesRegex(RuntimeError, "Daliuren master"):
                generate_runtime_textures(output)
            self.assertFalse(output.exists())


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

    def test_dynamic_labels_have_point_two_five_millimeter_support_clearance(self):
        build_master()
        surfaces = _add_dynamic_surfaces()
        support_tops = {
            "calendar": 0.008,
            "lessons": 0.004,
            "transmissions": 0.005,
            "generals": 0.007,
            "method": 0.004,
        }
        for surface in surfaces:
            dynamic_id = surface["dynamic_label_id"]
            if dynamic_id == "dynamic/calendar":
                support = support_tops["calendar"]
            elif dynamic_id.startswith("dynamic/lesson/"):
                support = support_tops["lessons"]
            elif dynamic_id == "dynamic/transmission/method":
                support = support_tops["method"]
            elif dynamic_id.startswith("dynamic/transmission/"):
                support = support_tops["transmissions"]
            else:
                support = support_tops["generals"]
            with self.subTest(dynamic_id=dynamic_id):
                clearance = surface.location.z - support
                self.assertGreaterEqual(clearance, 0.0002)
                self.assertLessEqual(clearance, 0.0003)

    def test_dynamic_label_corners_and_centers_clear_real_support_geometry(self):
        build_master()
        surfaces = _add_dynamic_surfaces()
        depsgraph = bpy.context.evaluated_depsgraph_get()
        physical_by_root = defaultdict(list)
        for obj in bpy.data.objects:
            if obj.type == "MESH" and not obj.get("dynamic_label_id"):
                root = moving_root(obj)
                if root:
                    physical_by_root[root].append((obj, BVHTree.FromObject(obj, depsgraph)))

        for surface in surfaces:
            points = [surface.matrix_world @ vertex.co for vertex in surface.data.vertices]
            points.append(sum(points, Vector()) / len(points))
            for point_index, point in enumerate(points):
                clearances = []
                for obj, tree in physical_by_root[moving_root(surface)]:
                    inverse = obj.matrix_world.inverted()
                    origin = inverse @ (point + Vector((0.0, 0.0, 0.02)))
                    direction = (inverse.to_3x3() @ Vector((0.0, 0.0, -1.0))).normalized()
                    hit, _normal, _index, _distance = tree.ray_cast(origin, direction)
                    if hit is None:
                        continue
                    world_hit = obj.matrix_world @ hit
                    if abs(world_hit.x - point.x) <= 1e-5 and abs(world_hit.y - point.y) <= 1e-5:
                        clearances.append(point.z - world_hit.z)
                with self.subTest(dynamic_id=surface["dynamic_label_id"], point=point_index):
                    self.assertTrue(clearances)
                    clearance = min(clearances, key=abs)
                    self.assertGreaterEqual(clearance, 0.0002)
                    self.assertLessEqual(clearance, 0.0003)

    def test_each_material_family_uses_one_non_overlapping_atlas(self):
        build_master()
        surfaces = _add_dynamic_surfaces()
        assign_primary_uvs(surfaces)
        overlaps = {}
        for family in ("M_Bronze", "M_Patina", "M_Celadon", "M_OldGold", "M_AshText"):
            objects = [
                obj
                for obj in bpy.data.objects
                if obj.type == "MESH" and obj.get("material_role") == family
            ]
            overlaps[family] = first_cross_mesh_overlap(objects)
        self.assertEqual(overlaps, {
            "M_Bronze": None,
            "M_Patina": None,
            "M_Celadon": None,
            "M_OldGold": None,
            "M_AshText": None,
        })

    def test_all_five_family_atlases_have_no_triangle_failures(self):
        build_master()
        surfaces = _add_dynamic_surfaces()
        assign_primary_uvs(surfaces)
        shared_meshes = defaultdict(list)
        for obj in bpy.data.objects:
            if obj.type == "MESH" and not obj.get("dynamic_label_id"):
                shared_meshes[obj.data.as_pointer()].append(obj.name)
        intentional_reuse = [set(names) for names in shared_meshes.values() if len(names) > 1]
        self.assertEqual(intentional_reuse, [{
            "general/noble",
            "general/snake",
            "general/vermilion-bird",
            "general/harmony",
            "general/hook-array",
            "general/azure-dragon",
            "general/void",
            "general/white-tiger",
            "general/constant",
            "general/black-tortoise",
            "general/yin",
            "general/queen-of-heaven",
        }])
        failures = {}
        for family in ("M_Bronze", "M_Patina", "M_Celadon", "M_OldGold", "M_AshText"):
            failures[family] = family_atlas_failures([
                obj
                for obj in bpy.data.objects
                if obj.type == "MESH" and obj.get("material_role") == family
            ])
        self.assertEqual(failures, {
            family: {"outOfRange": [], "degenerate": [], "overlap": None}
            for family in ("M_Bronze", "M_Patina", "M_Celadon", "M_OldGold", "M_AshText")
        })

    def test_uvs_preserve_triangle_shape_and_tangent_mirror_sign(self):
        build_master()
        surfaces = _add_dynamic_surfaces()
        assign_primary_uvs(surfaces)
        representatives = (
            "base/body",
            "detail/base/removable-bottom",
            "lesson/first/readout/upper",
            "inscription/mechanical-scale/62",
            "inscription/earth-branch/00",
        )
        for object_name in representatives:
            obj = bpy.data.objects[object_name]
            mesh = obj.data
            mesh.calc_loop_triangles()
            mesh.calc_tangents(uvmap="UVMap")
            triangle = largest_uv_triangle(obj)
            points = [mesh.vertices[index].co for index in triangle.vertices]
            uv = [mesh.uv_layers["UVMap"].data[index].uv for index in triangle.loops]
            lengths_3d = sorted((points[(index + 1) % 3] - points[index]).length for index in range(3))
            lengths_uv = sorted((uv[(index + 1) % 3] - uv[index]).length for index in range(3))
            normalized_3d = [value / lengths_3d[-1] for value in lengths_3d]
            normalized_uv = [value / lengths_uv[-1] for value in lengths_uv]
            edge1 = points[1] - points[0]
            edge2 = points[2] - points[0]
            delta_uv1 = uv[1] - uv[0]
            delta_uv2 = uv[2] - uv[0]
            determinant = delta_uv1.x * delta_uv2.y - delta_uv1.y * delta_uv2.x
            tangent = (edge1 * delta_uv2.y - edge2 * delta_uv1.y) / determinant
            bitangent = (edge2 * delta_uv1.x - edge1 * delta_uv2.x) / determinant
            normal = edge1.cross(edge2).normalized()
            expected_sign = 1.0 if normal.cross(tangent).dot(bitangent) >= 0.0 else -1.0
            with self.subTest(object=object_name):
                for actual, expected in zip(normalized_uv, normalized_3d):
                    self.assertAlmostEqual(actual, expected, delta=0.08)
                for loop_index in triangle.loops:
                    loop = mesh.loops[loop_index]
                    self.assertTrue(all(math.isfinite(value) for value in loop.tangent))
                    self.assertGreater(loop.tangent.length, 0.999)
                    self.assertAlmostEqual(loop.bitangent_sign, expected_sign, delta=1e-6)


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

        policy = self.contract["runtimeTextures"]["dynamicLabels"]["courseValuePolicy"]
        self.assertEqual(policy["scope"], "dynamic-label-payload-and-bake-inputs-only")
        self.assertEqual(set(policy["fields"]), {"calendar", "lessons", "transmissions", "generals", "method"})
        forbidden_dynamic = {
            value
            for values in policy["fields"].values()
            for value in values
        }
        self.assertTrue(FORBIDDEN_DYNAMIC_TEXT.issubset(forbidden_dynamic))

        fixed_text = {
            obj.get("inscription_text")
            for obj in bpy.data.objects
            if obj.get("inscription_role")
        }
        self.assertTrue({"子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"}.issubset(fixed_text))
        self.assertIn("胜光", fixed_text)

    def test_texture_contract_and_known_object_uv_regions_match_physical_materials(self):
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
                        self.assertEqual(record["colorSpace"], "sRGB" if role == "baseColor" else "Non-Color")
                        self.assertEqual(record["sha256"], sha256(path))
                        width, height, _ = png_rgb(path)
                        self.assertEqual((width, height), (expected_dimension, expected_dimension))

        decoded = {}
        for family in ("M_Bronze", "M_Patina", "M_Celadon", "M_OldGold", "M_AshText"):
            decoded[family] = {}
            for role in ("baseColor", "orm", "normal"):
                record = runtime["families"][family]["lod0"][role]
                _, _, decoded[family][role] = png_rgb(self.texture_root / record["file"])

        representatives = {
            "M_Bronze": ("base/body", (38, 50, 47), 255),
            "M_Patina": ("detail/base/removable-bottom", (67, 92, 83), 255),
            "M_Celadon": ("lesson/first/readout/upper", None, 0),
            "M_OldGold": ("inscription/mechanical-scale/62", (128, 112, 76), 255),
            "M_AshText": ("inscription/earth-branch/00", (194, 198, 187), 0),
        }
        for family, (object_name, expected_base, expected_metallic) in representatives.items():
            obj = bpy.data.objects[object_name]
            triangle = largest_uv_triangle(obj)
            x, y = triangle_interior_pixel(obj, triangle, 2048)
            with self.subTest(family=family, object=object_name):
                if expected_base is not None:
                    self.assertEqual(pixel(decoded[family]["baseColor"], x, y), expected_base)
                self.assertEqual(pixel(decoded[family]["orm"], x, y)[2], expected_metallic)

        bronze = bpy.data.objects["base/body"]
        contact = bronze.data.attributes["causal_contact_wear"]
        bronze.data.calc_loop_triangles()
        polished = max(
            (triangle for triangle in bronze.data.loop_triangles if contact.data[triangle.polygon_index].value > 0.8),
            key=lambda triangle: uv_triangle_area(bronze, triangle),
        )
        unpolished = max(
            (triangle for triangle in bronze.data.loop_triangles if contact.data[triangle.polygon_index].value == 0.0),
            key=lambda triangle: uv_triangle_area(bronze, triangle),
        )
        polished_xy = triangle_interior_pixel(bronze, polished, 2048)
        unpolished_xy = triangle_interior_pixel(bronze, unpolished, 2048)
        self.assertLess(
            pixel(decoded["M_Bronze"]["orm"], *polished_xy)[1],
            pixel(decoded["M_Bronze"]["orm"], *unpolished_xy)[1],
        )

        recess = bpy.data.objects["detail/heaven/center-bearing"]
        oxidation = recess.data.attributes["causal_recess_oxidation"]
        recess.data.calc_loop_triangles()
        oxidized = max(
            (triangle for triangle in recess.data.loop_triangles if oxidation.data[triangle.polygon_index].value > 0.8),
            key=lambda triangle: uv_triangle_area(recess, triangle),
        )
        oxidized_xy = triangle_interior_pixel(recess, oxidized, 2048)
        oxidized_base = pixel(decoded["M_Bronze"]["baseColor"], *oxidized_xy)
        self.assertNotEqual(oxidized_base, (38, 50, 47))
        self.assertGreater(oxidized_base[1], 50)

        celadon = bpy.data.objects["lesson/first/readout/upper"]
        celadon.data.calc_loop_triangles()
        celadon_samples = sorted(
            celadon.data.loop_triangles,
            key=lambda triangle: uv_triangle_area(celadon, triangle),
            reverse=True,
        )[:20]
        normal_samples = {
            pixel(decoded["M_Celadon"]["normal"], *triangle_interior_pixel(celadon, triangle, 2048))
            for triangle in celadon_samples
        }
        self.assertGreaterEqual(len(normal_samples), 3)
        self.assertTrue(any(value != (128, 128, 255) for value in normal_samples))
        for value in normal_samples:
            length = math.sqrt(sum(((channel - 128) / 127.0) ** 2 for channel in value))
            self.assertAlmostEqual(length, 1.0, delta=0.05)

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

    def test_lod2_is_literal_two_by_two_box_filter_of_lod0(self):
        samples = ((37, 91), (401, 233), (877, 701))
        for family in MATERIAL_FAMILIES:
            for role in ("baseColor", "orm", "normal"):
                lod0_record = self.contract["runtimeTextures"]["families"][family]["lod0"][role]
                lod2_record = self.contract["runtimeTextures"]["families"][family]["lod2"][role]
                _, _, source_rows = png_rgb(self.texture_root / lod0_record["file"])
                _, _, target_rows = png_rgb(self.texture_root / lod2_record["file"])
                for x, y in samples:
                    expected = tuple(
                        (
                            pixel(source_rows, x * 2, y * 2)[channel]
                            + pixel(source_rows, x * 2 + 1, y * 2)[channel]
                            + pixel(source_rows, x * 2, y * 2 + 1)[channel]
                            + pixel(source_rows, x * 2 + 1, y * 2 + 1)[channel]
                            + 2
                        )
                        // 4
                        for channel in range(3)
                    )
                    with self.subTest(family=family, role=role, x=x, y=y):
                        self.assertEqual(pixel(target_rows, x, y), expected)

    def test_source_causal_face_mutation_changes_only_its_family_region(self):
        bronze = bpy.data.objects["base/body"]
        attribute = bronze.data.attributes["causal_contact_wear"]
        bronze.data.calc_loop_triangles()
        triangle = max(
            (
                item
                for item in bronze.data.loop_triangles
                if attribute.data[item.polygon_index].value > 0.0
            ),
            key=lambda item: uv_triangle_area(bronze, item),
        )
        sample_x, sample_y = triangle_interior_pixel(bronze, triangle, 2048)
        before_record = self.contract["runtimeTextures"]["families"]["M_Bronze"]["lod0"]["orm"]
        _, _, before_rows = png_rgb(self.texture_root / before_record["file"])

        attribute.data[triangle.polygon_index].value = 0.0
        mutated_root = self.directory / "mutated"
        mutated = generate_runtime_textures(mutated_root)
        _, _, after_rows = png_rgb(mutated_root / mutated["M_Bronze"]["lod0"]["orm"]["file"])

        self.assertNotEqual(
            mutated["M_Bronze"]["lod0"]["orm"]["sha256"],
            before_record["sha256"],
        )
        self.assertGreater(
            pixel(after_rows, sample_x, sample_y)[1],
            pixel(before_rows, sample_x, sample_y)[1],
        )
        for family in ("M_Patina", "M_Celadon", "M_OldGold", "M_AshText"):
            for lod in ("lod0", "lod2"):
                for role in ("baseColor", "orm", "normal"):
                    self.assertEqual(
                        mutated[family][lod][role]["sha256"],
                        self.contract["runtimeTextures"]["families"][family][lod][role]["sha256"],
                    )


if __name__ == "__main__":
    unittest.main(argv=[__file__, *(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])])
