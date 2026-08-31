import hashlib
import json
import math
import struct
import sys
import tempfile
import unittest
import zlib
from array import array
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
from daliuren_contract import BRANCH_INLAY_NODE_IDS, NODE_IDS
from uv_and_bake import (
    DYNAMIC_COURSE_VALUES_BY_FIELD,
    DYNAMIC_LABEL_OWNERS,
    MATERIAL_FAMILIES,
    MICRO_TRIANGLE_AREA_MAX,
    MOVING_NODE_IDS,
    _add_dynamic_surfaces,
    _family_buffers,
    _excluded_from_runtime_bake,
    _has_unbounded_uv_issues,
    _native_texel_coverage_failures,
    _object_texel_coverage_failures,
    _validate_native_texel_coverage,
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


def uv_pixel(rows, x, y):
    return pixel(rows, x, len(rows) - 1 - y)


def buffer_pixel(buffer, dimension, x, y):
    offset = (y * dimension + x) * 3
    return tuple(buffer[offset : offset + 3])


def object_atlas(runtime, obj):
    return runtime["families"][obj["runtime_texture_family"]]["atlases"][obj["runtime_atlas_id"]]


def frozen_atlas_uv_hash(family, atlas_id):
    digest = hashlib.sha256()
    representatives = {}
    for obj in sorted(
        (
            item for item in bpy.data.objects
            if item.type == "MESH"
            and item.get("runtime_texture_family") == family
            and item.get("runtime_atlas_id") == atlas_id
        ),
        key=lambda item: item.name,
    ):
        representatives.setdefault(obj.data.as_pointer(), obj)
    for obj in representatives.values():
        digest.update(obj.name.encode("utf-8") + b"\0")
        layer = obj.data.uv_layers["UVMap"]
        digest.update(struct.pack("<I", len(layer.data)))
        for item in layer.data:
            digest.update(struct.pack("<2d", float(item.uv.x), float(item.uv.y)))
    return digest.hexdigest()


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


def independent_triangle_pixel_centers(points, dimension):
    denominator = (
        (points[1][1] - points[2][1]) * (points[0][0] - points[2][0])
        + (points[2][0] - points[1][0]) * (points[0][1] - points[2][1])
    )
    minimum_x = max(0, int(math.floor(min(point[0] for point in points) * dimension)))
    maximum_x = min(dimension, int(math.ceil(max(point[0] for point in points) * dimension)))
    minimum_y = max(0, int(math.floor(min(point[1] for point in points) * dimension)))
    maximum_y = min(dimension, int(math.ceil(max(point[1] for point in points) * dimension)))
    for y in range(minimum_y, maximum_y):
        v = (y + 0.5) / dimension
        for x in range(minimum_x, maximum_x):
            u = (x + 0.5) / dimension
            first = ((points[1][1] - points[2][1]) * (u - points[2][0]) + (points[2][0] - points[1][0]) * (v - points[2][1])) / denominator
            second = ((points[2][1] - points[0][1]) * (u - points[2][0]) + (points[0][0] - points[2][0]) * (v - points[2][1])) / denominator
            if min(first, second, 1.0 - first - second) >= -1e-9:
                yield x, y


def independent_atlas_owner_and_edge_distance(atlas_id, dimension, edge_band):
    representatives = {}
    for obj in sorted(
        (
            item for item in bpy.data.objects
            if item.type == "MESH" and item.get("runtime_atlas_id") == atlas_id
        ),
        key=lambda item: item.name,
    ):
        representatives.setdefault(obj.data.as_pointer(), obj)
    owners = array("I", [0]) * (dimension * dimension)
    expected_owners = set()
    owner_max_triangle_area = {}
    owner_sources = {}
    owner_centers = defaultdict(list)
    next_owner = 1
    for obj in representatives.values():
        mesh = obj.data
        layer = mesh.uv_layers["UVMap"]
        mesh.calc_loop_triangles()
        parents = list(range(len(mesh.loop_triangles)))

        def find(index):
            while parents[index] != index:
                parents[index] = parents[parents[index]]
                index = parents[index]
            return index

        edge_triangles = {}
        for triangle in mesh.loop_triangles:
            for first, second in ((0, 1), (1, 2), (2, 0)):
                vertices = (triangle.vertices[first], triangle.vertices[second])
                loops = (triangle.loops[first], triangle.loops[second])
                uv_edge = tuple(sorted(
                    (vertex, round(layer.data[loop].uv.x, 10), round(layer.data[loop].uv.y, 10))
                    for vertex, loop in zip(vertices, loops)
                ))
                key = (tuple(sorted(vertices)), uv_edge)
                if key in edge_triangles:
                    root = find(triangle.index)
                    other = find(edge_triangles[key])
                    if root != other:
                        parents[other] = root
                else:
                    edge_triangles[key] = triangle.index
        roots = {}
        for triangle in mesh.loop_triangles:
            root = find(triangle.index)
            owner = roots.setdefault(root, next_owner + len(roots))
            expected_owners.add(owner)
            owner_sources.setdefault(owner, f"{obj.name}:island-{root}")
            owner_max_triangle_area[owner] = max(
                owner_max_triangle_area.get(owner, 0.0), triangle.area
            )
            points = tuple(tuple(layer.data[index].uv) for index in triangle.loops)
            center_x = min(dimension - 1, max(0, int(sum(point[0] for point in points) / 3 * dimension)))
            center_y = min(dimension - 1, max(0, int(sum(point[1] for point in points) / 3 * dimension)))
            owner_centers[owner].append(center_y * dimension + center_x)
            for x, y in independent_triangle_pixel_centers(points, dimension):
                index = y * dimension + x
                if owners[index] not in (0, owner):
                    raise AssertionError(f"Independent owner overlap at {atlas_id} {x},{y}")
                owners[index] = owner
        next_owner += len(roots)

    edge_distance = bytearray([255]) * (dimension * dimension)
    frontier = []
    for y in range(dimension):
        for x in range(dimension):
            index = y * dimension + x
            owner = owners[index]
            if owner and any(
                owners[neighbor] != owner
                for neighbor in (
                    index - 1 if x else index,
                    index + 1 if x + 1 < dimension else index,
                    index - dimension if y else index,
                    index + dimension if y + 1 < dimension else index,
                )
            ):
                edge_distance[index] = 0
                frontier.append(index)
    observed_owners = set(owners)
    observed_owners.discard(0)
    for owner in expected_owners - observed_owners:
        for index in owner_centers[owner]:
            if edge_distance[index] == 255:
                edge_distance[index] = 0
                frontier.append(index)
    for distance in range(1, edge_band + 1):
        following = []
        for source in frontier:
            x = source % dimension
            y = source // dimension
            for target_y in range(max(0, y - 1), min(dimension, y + 2)):
                for target_x in range(max(0, x - 1), min(dimension, x + 2)):
                    target = target_y * dimension + target_x
                    if edge_distance[target] == 255:
                        edge_distance[target] = distance
                        following.append(target)
        frontier = following
    return owners, edge_distance, expected_owners, owner_max_triangle_area, owner_sources


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
    "transmission/initial",
    "transmission/middle",
    "transmission/final",
    "transmission/method",
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

    def test_texel_coverage_does_not_borrow_padding_from_a_neighboring_uv_island(self):
        obj = self._mesh(
            "coverage-owner",
            (
                (0, 0, 0), (1, 0, 0), (0, 1, 0),
                (2, 0, 0), (3, 0, 0), (2, 1, 0),
            ),
            ((0, 1, 2), (3, 4, 5)),
            (
                (0.40, 0.40), (0.48, 0.40), (0.40, 0.48),
                (0.4850, 0.4850), (0.4900, 0.4850), (0.4850, 0.4900),
            ),
        )
        obj.data.calc_loop_triangles()
        self.assertAlmostEqual(obj.data.loop_triangles[0].area, 0.5)
        self.assertAlmostEqual(obj.data.loop_triangles[1].area, 0.5)

        self.assertEqual(
            _object_texel_coverage_failures(obj, 64, dilation=4),
            [("coverage-owner", 1)],
        )

    def test_dynamic_course_value_policy_is_split_by_runtime_field(self):
        expected_fields = {"calendar", "lessons", "transmissions", "generals", "method"}
        self.assertEqual(set(DYNAMIC_COURSE_VALUES_BY_FIELD), expected_fields)
        self.assertTrue(SAMPLE_COURSE_VALUES.issubset({
            value
            for values in DYNAMIC_COURSE_VALUES_BY_FIELD.values()
            for value in values
        }))

    def test_bake_ownership_uses_current_semantic_nodes_only(self):
        self.assertEqual(
            DYNAMIC_LABEL_OWNERS["dynamic/transmission/method"],
            "transmission/method",
        )
        self.assertFalse({
            "transmission/bridge",
            "anchor/course-copy/lessons",
            "anchor/course-copy/transmissions",
            "anchor/course-copy/generals",
        } & (set(MOVING_NODE_IDS) | set(DYNAMIC_LABEL_OWNERS.values())))
        self.assertEqual(len(BRANCH_INLAY_NODE_IDS), 12)

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
        depsgraph = bpy.context.evaluated_depsgraph_get()
        physical_meshes = [
            (obj, BVHTree.FromObject(obj, depsgraph))
            for obj in bpy.data.objects
            if obj.type == "MESH" and not obj.get("dynamic_label_id")
        ]
        for surface in surfaces:
            center = surface.matrix_world @ surface.data.polygons[0].center
            normal = (
                surface.matrix_world.to_3x3() @ surface.data.polygons[0].normal
            ).normalized()
            origin = center + normal * 0.02
            owner = moving_root(surface)
            occluders = []
            for obj, tree in physical_meshes:
                if moving_root(obj) != owner:
                    continue
                inverse = obj.matrix_world.inverted()
                hit, _normal, _index, _distance = tree.ray_cast(
                    inverse @ origin,
                    (inverse.to_3x3() @ -normal).normalized(),
                )
                if hit is None:
                    continue
                hit_world = obj.matrix_world @ hit
                if 0.0 < (origin - hit_world).dot(normal) < 0.01999:
                    occluders.append(obj.name)
            with self.subTest(dynamic_id=surface["dynamic_label_id"]):
                self.assertEqual(occluders, [])

    def test_dynamic_labels_have_point_two_five_millimeter_support_clearance(self):
        build_master()
        surfaces = _add_dynamic_surfaces()
        support_tops = {
            "calendar": 0.0045,
            "lessons": 0.0045,
            "transmissions": 0.005,
            "generals": 0.002,
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
            if obj.type == "MESH" and not obj.get("dynamic_label_id") and not _excluded_from_runtime_bake(obj):
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

    def test_each_explicit_material_atlas_is_non_overlapping(self):
        build_master()
        surfaces = _add_dynamic_surfaces()
        assign_primary_uvs(surfaces)
        groups = defaultdict(list)
        for obj in bpy.data.objects:
            if obj.type == "MESH" and not obj.get("dynamic_label_id") and not _excluded_from_runtime_bake(obj):
                groups[obj["runtime_atlas_id"]].append(obj)
        overlaps = {
            atlas_id: first_cross_mesh_overlap(objects)
            for atlas_id, objects in groups.items()
        }
        self.assertTrue(groups)
        self.assertEqual(overlaps, {atlas_id: None for atlas_id in groups})

    def test_baked_family_atlases_have_no_triangle_failures(self):
        self.maxDiff = None
        build_master()
        surfaces = _add_dynamic_surfaces()
        assign_primary_uvs(surfaces)
        shared_meshes = defaultdict(list)
        for obj in bpy.data.objects:
            if obj.type == "MESH" and not obj.get("dynamic_label_id") and not _excluded_from_runtime_bake(obj):
                shared_meshes[obj.data.as_pointer()].append(obj.name)
        intentional_reuse = [set(names) for names in shared_meshes.values() if len(names) > 1]
        self.assertEqual(intentional_reuse, [])
        groups = defaultdict(list)
        for obj in bpy.data.objects:
            if obj.type == "MESH" and not obj.get("dynamic_label_id") and not _excluded_from_runtime_bake(obj):
                groups[obj["runtime_atlas_id"]].append(obj)
        failures = {
            atlas_id: family_atlas_failures(objects)
            for atlas_id, objects in groups.items()
        }
        self.assertEqual(failures, {
            atlas_id: {"outOfRange": [], "degenerate": [], "overlap": None}
            for atlas_id in groups
        })

    def test_family_atlas_identity_and_area_allocation_are_not_equal_object_cells(self):
        build_master()
        surfaces = _add_dynamic_surfaces()
        assign_primary_uvs(surfaces)

        physical = [
            obj
            for obj in bpy.data.objects
            if obj.type == "MESH" and not obj.get("dynamic_label_id") and not _excluded_from_runtime_bake(obj)
        ]
        self.assertTrue(all(obj.get("runtime_atlas_id") for obj in physical))

        body = bpy.data.objects["base/body"]
        bearing = bpy.data.objects["detail/base/cast-corner/00"]
        body_uv_area = sum(uv_triangle_area(body, triangle) for triangle in body.data.loop_triangles)
        bearing_uv_area = sum(uv_triangle_area(bearing, triangle) for triangle in bearing.data.loop_triangles)
        body_surface = sum(polygon.area for polygon in body.data.polygons)
        bearing_surface = sum(polygon.area for polygon in bearing.data.polygons)

        self.assertGreater(body_surface, bearing_surface * 100.0)
        self.assertGreater(body_uv_area, bearing_uv_area * 3.0)

    def test_every_visible_triangle_has_native_coverage_or_a_bounded_microface_exception(self):
        self.maxDiff = None
        build_master()
        plate = bpy.data.objects["plate/heaven"]
        plate_area_before = sum(polygon.area for polygon in plate.data.polygons)
        plate_bounds_before = world_bounds(plate)
        earth = bpy.data.objects["plate/earth"]
        earth_area_before = sum(polygon.area for polygon in earth.data.polygons)
        earth_bounds_before = world_bounds(earth)
        surfaces = _add_dynamic_surfaces()
        assign_primary_uvs(surfaces)
        self.assertAlmostEqual(
            sum(polygon.area for polygon in plate.data.polygons),
            plate_area_before,
            delta=plate_area_before * 0.0001,
        )
        self.assertLessEqual(
            max(
                abs(actual - expected)
                for actual_corner, expected_corner in zip(world_bounds(plate), plate_bounds_before)
                for actual, expected in zip(actual_corner, expected_corner)
            ),
            1e-7,
        )
        self.assertAlmostEqual(
            sum(polygon.area for polygon in earth.data.polygons),
            earth_area_before,
            delta=earth_area_before * 0.0001,
        )
        self.assertLessEqual(
            max(
                abs(actual - expected)
                for actual_corner, expected_corner in zip(world_bounds(earth), earth_bounds_before)
                for actual, expected in zip(actual_corner, expected_corner)
            ),
            1e-7,
        )
        failures = {}
        microface_areas = []
        total_surface_area = 0.0
        atlas_ids = {
            obj["runtime_atlas_id"]
            for obj in bpy.data.objects
            if obj.type == "MESH" and not obj.get("dynamic_label_id") and not _excluded_from_runtime_bake(obj)
        }
        for atlas_id in atlas_ids:
            family = atlas_id.split(":", 1)[0]
            sample = next(
                obj for obj in bpy.data.objects
                if obj.type == "MESH" and obj.get("runtime_atlas_id") == atlas_id
            )
            dimension = 2048 if sample["runtime_atlas_class"] == "moving" else 4096
            bake_scale = max(
                obj.get("runtime_bake_scale", 1)
                for obj in bpy.data.objects
                if obj.type == "MESH" and obj.get("runtime_atlas_id") == atlas_id
            )
            family_failures = _native_texel_coverage_failures(
                family, dimension, dilation=4, atlas_id=atlas_id
            )
            if family_failures and bake_scale > 1:
                unresolved = set(family_failures)
                for object_name in {name for name, _index in family_failures}:
                    obj = bpy.data.objects[object_name]
                    high_resolution_failures = set(_object_texel_coverage_failures(
                        obj,
                        dimension * bake_scale,
                        dilation=16,
                    ))
                    unresolved.intersection_update(
                        high_resolution_failures
                        | {item for item in unresolved if item[0] != object_name}
                    )
                family_failures = sorted(unresolved)
            visible_failures = []
            for object_name, triangle_index in family_failures:
                obj = bpy.data.objects[object_name]
                obj.data.calc_loop_triangles()
                area = obj.data.loop_triangles[triangle_index].area
                if area <= MICRO_TRIANGLE_AREA_MAX:
                    microface_areas.append(area)
                else:
                    visible_failures.append((object_name, triangle_index, area))
            family_failures = visible_failures
            if family_failures:
                failures[atlas_id] = {
                    "count": len(family_failures),
                    "first": family_failures[0],
                }
        representatives = {}
        for obj in bpy.data.objects:
            if obj.type == "MESH" and not obj.get("dynamic_label_id"):
                representatives.setdefault(obj.data.as_pointer(), obj)
        for obj in representatives.values():
            total_surface_area += sum(polygon.area for polygon in obj.data.polygons)

        self.assertEqual(failures, {})
        self.assertTrue(microface_areas)
        self.assertEqual(MICRO_TRIANGLE_AREA_MAX, 2.0e-7)
        self.assertLessEqual(max(microface_areas), MICRO_TRIANGLE_AREA_MAX)
        self.assertLess(sum(microface_areas) / total_surface_area, 2.0e-5)

    def test_uvs_preserve_triangle_shape_and_tangent_mirror_sign(self):
        build_master()
        surfaces = _add_dynamic_surfaces()
        assign_primary_uvs(surfaces)
        representatives = (
            "base/body",
            "detail/base/removable-bottom",
            "lesson/first",
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
        cls.texture_root = REPOSITORY_ROOT / "assets/daliuren/textures"
        cls.contract_path = CONTRACT_PATH
        cls.root = build_master()
        cls.surfaces = _add_dynamic_surfaces()
        assign_primary_uvs(cls.surfaces)
        cls.frozen_counts = {
            "runtime": sum("node_id" in obj for obj in bpy.data.objects),
            "details": sum("detail_id" in obj for obj in bpy.data.objects),
            "inscriptions": sum("inscription_role" in obj for obj in bpy.data.objects),
        }
        cls.contract = json.loads(cls.contract_path.read_text(encoding="utf-8"))

    @classmethod
    def tearDownClass(cls):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        cls.temporary.cleanup()

    def _low_resolution_source_material_fixture(
        self,
        family,
        atlas_id,
        causal_recess_oxidation=None,
        source_name=None,
    ):
        source = bpy.data.objects[source_name] if source_name else next(
            obj
            for obj in bpy.data.objects
            if obj.type == "MESH"
            and obj.get("runtime_texture_family") == family
            and obj.data.materials
            and obj.data.materials[0] is not None
        )
        mesh = bpy.data.meshes.new(f"fixture/{atlas_id}/mesh")
        mesh.from_pydata(
            ((-0.5, -0.5, 0.0), (0.5, -0.5, 0.0), (0.5, 0.5, 0.0), (-0.5, 0.5, 0.0)),
            (),
            ((0, 1, 2, 3),),
        )
        mesh.update()
        layer = mesh.uv_layers.new(name="UVMap")
        layer.active_render = True
        for loop, coordinate in zip(
            layer.data,
            ((0.125, 0.125), (0.875, 0.125), (0.875, 0.875), (0.125, 0.875)),
        ):
            loop.uv = coordinate
        fixture = bpy.data.objects.new(f"fixture/{atlas_id}", mesh)
        bpy.context.scene.collection.objects.link(fixture)
        mesh.materials.append(source.data.materials[0])
        fixture["runtime_texture_family"] = family
        fixture["runtime_atlas_id"] = atlas_id
        if causal_recess_oxidation is not None:
            attribute = mesh.attributes.new("causal_recess_oxidation", "FLOAT", "FACE")
            attribute.data[0].value = causal_recess_oxidation

        def cleanup():
            bpy.data.objects.remove(fixture, do_unlink=True)
            bpy.data.meshes.remove(mesh)

        self.addCleanup(cleanup)
        return fixture

    def test_every_export_mesh_has_one_valid_non_overlapping_primary_uv_set(self):
        meshes = [obj for obj in bpy.data.objects if obj.type == "MESH" and not _excluded_from_runtime_bake(obj)]
        self.assertGreater(len(meshes), 130)
        for obj in meshes:
            with self.subTest(object=obj.name):
                self.assertEqual(tuple(layer.name for layer in obj.data.uv_layers), ("UVMap",))
                self.assertTrue(obj.data.uv_layers["UVMap"].active_render)
                self.assertFalse(_has_unbounded_uv_issues(obj))

    def test_current_source_low_resolution_bake_is_byte_deterministic_without_repacking(self):
        atlas_id = "task5-test/deterministic-jade"
        fixture = self._low_resolution_source_material_fixture("M_JadeBody", atlas_id)
        uv_before = tuple(tuple(loop.uv) for loop in fixture.data.uv_layers["UVMap"].data)

        first = _family_buffers("M_JadeBody", 32, atlas_id)
        second = _family_buffers("M_JadeBody", 32, atlas_id)

        self.assertEqual(first, second)
        self.assertEqual(
            tuple(tuple(loop.uv) for loop in fixture.data.uv_layers["UVMap"].data),
            uv_before,
        )

    def test_current_source_low_resolution_texture_contract_maps_all_physical_families(self):
        expected_metallic = {
            "M_JadeBody": 0,
            "M_TranslucentJade": 0,
            "M_JadeRecess": 0,
            "M_OldGold": 255,
        }
        base_colors = set()
        for family, metallic in expected_metallic.items():
            atlas_id = f"task4-test/{family}"
            self._low_resolution_source_material_fixture(family, atlas_id)
            buffers = _family_buffers(family, 32, atlas_id)
            with self.subTest(family=family):
                self.assertEqual(set(buffers), {"baseColor", "orm", "normal"})
                self.assertTrue(all(len(buffer) == 32 * 32 * 3 for buffer in buffers.values()))
                self.assertEqual(buffer_pixel(buffers["orm"], 32, 16, 16)[2], metallic)
                base_colors.add(buffer_pixel(buffers["baseColor"], 32, 16, 16))
        self.assertGreaterEqual(len(base_colors), 3)

    def test_frozen_heaven_and_moving_atlases_rebake_with_bounded_native_variance_without_repacking(self):
        output = self.directory / "frozen-rebake"
        atlas_ids = {"M_JadeBody:moving"}
        rebuilt = generate_runtime_textures(output, atlas_ids=atlas_ids)
        runtime = self.contract["runtimeTextures"]
        heaven_record = runtime["families"]["M_JadeBody"]["atlases"]["M_JadeBody:moving"]
        edge_masks = {}
        for lod, padding, filter_footprint in (("lod0", 8, 0), ("lod2", 4, 1)):
            edge_band = padding + filter_footprint
            dimension = heaven_record[lod]["baseColor"]["dimensions"][0]
            owners, distances, expected_owners, owner_max_triangle_area, owner_sources = independent_atlas_owner_and_edge_distance(
                "M_JadeBody:moving", dimension, edge_band
            )
            observed_owners = set(owners)
            observed_owners.discard(0)
            center_misses = expected_owners - observed_owners
            self.assertTrue(expected_owners)
            print(
                f"OWNER_MASK {lod} islands={len(expected_owners)} represented={len(observed_owners)} "
                f"microface_exceptions={sorted(center_misses)} padding={padding} "
                f"downsample_footprint={filter_footprint} edge_band={edge_band}"
            )
            edge_masks[lod] = (dimension, edge_band, owners, distances, expected_owners)
        self.assertEqual(runtime["atlasPolicy"]["uvSourceMaster"], "assets/daliuren/source/daliuren-artifact-master.blend")
        self.assertEqual(runtime["atlasPolicy"]["uvAuthoringVersion"], "blender-4.5.12/task8-native-atlas-v4")
        for atlas_id in atlas_ids:
            family = atlas_id.split(":", 1)[0]
            actual = rebuilt[family]["atlases"][atlas_id]
            committed = runtime["families"][family]["atlases"][atlas_id]
            self.assertEqual(committed["uvLayoutSha256"], frozen_atlas_uv_hash(family, atlas_id))
            self.assertEqual(actual["uvLayoutSha256"], committed["uvLayoutSha256"])
            for lod in ("lod0", "lod2"):
                for role in ("baseColor", "orm", "normal"):
                    with self.subTest(atlas=atlas_id, lod=lod, role=role):
                        if atlas_id == "M_JadeBody:moving":
                            self.assertEqual(actual[lod][role]["sha256"], committed[lod][role]["sha256"])
                            continue
                        _, _, actual_rows = png_rgb(output / actual[lod][role]["file"])
                        _, _, committed_rows = png_rgb(self.texture_root / committed[lod][role]["file"])
                        actual_bytes = b"".join(actual_rows)
                        committed_bytes = b"".join(committed_rows)
                        differing_pixels = [
                            offset // 3
                            for offset in range(0, len(actual_bytes), 3)
                            if actual_bytes[offset : offset + 3] != committed_bytes[offset : offset + 3]
                        ]
                        differing = len(differing_pixels)
                        maximum_delta = max((
                            abs(first - second)
                            for first, second in zip(actual_bytes, committed_bytes)
                        ), default=0)
                        maximum_pixels, allowed_delta = {
                            "baseColor": (1024, 64),
                            "orm": (1024, 255),
                            "normal": (128, 4),
                        }[role]
                        self.assertLessEqual(differing, maximum_pixels)
                        self.assertLessEqual(maximum_delta, allowed_delta)
                        dimension, edge_band, _owners, distances, _expected = edge_masks[lod]
                        uv_indices = [
                            (dimension - 1 - index // dimension) * dimension + index % dimension
                            for index in differing_pixels
                        ]
                        outside_band = [index for index in uv_indices if distances[index] > edge_band]
                        distribution = defaultdict(int)
                        for index in uv_indices:
                            distribution[distances[index]] += 1
                        coordinates = [
                            (index % dimension, index // dimension)
                            for index in differing_pixels[:12]
                        ]
                        print(
                            f"EDGE_DIFF {lod} {role} count={differing} max_delta={maximum_delta} "
                            f"distance_distribution={dict(sorted(distribution.items()))} coords={coordinates}"
                        )
                        self.assertEqual(outside_band, [], coordinates)

        for lod in ("lod0", "lod2"):
            dimension, edge_band, owners, distances, expected_owners = edge_masks[lod]
            interior_samples = {}
            for index, owner in enumerate(owners):
                if owner and distances[index] > edge_band:
                    interior_samples.setdefault(owner, index)
            self.assertTrue(interior_samples)
            print(
                f"INTERIOR_SAMPLES {lod} islands={len(expected_owners)} "
                f"with_interior={len(interior_samples)}"
            )
            actual_atlas = rebuilt["M_JadeBody"]["atlases"]["M_JadeBody:moving"]
            committed_atlas = runtime["families"]["M_JadeBody"]["atlases"]["M_JadeBody:moving"]
            for role in ("baseColor", "orm", "normal"):
                _, _, actual_rows = png_rgb(output / actual_atlas[lod][role]["file"])
                _, _, committed_rows = png_rgb(self.texture_root / committed_atlas[lod][role]["file"])
                for owner, index in interior_samples.items():
                    x = index % dimension
                    y = index // dimension
                    actual_pixel = uv_pixel(actual_rows, x, y)
                    committed_pixel = uv_pixel(committed_rows, x, y)
                    with self.subTest(atlas="M_JadeBody:moving", lod=lod, role=role, owner=owner):
                        self.assertTrue(
                            all(abs(first - second) <= 1 for first, second in zip(actual_pixel, committed_pixel)),
                            (x, y, actual_pixel, committed_pixel),
                        )

        heaven = bpy.data.objects["plate/heaven"]
        heaven.data.calc_loop_triangles()
        triangles = sorted(
            heaven.data.loop_triangles,
            key=lambda triangle: uv_triangle_area(heaven, triangle),
            reverse=True,
        )[:20]
        actual_heaven = rebuilt["M_JadeBody"]["atlases"]["M_JadeBody:moving"]
        committed_heaven = runtime["families"]["M_JadeBody"]["atlases"]["M_JadeBody:moving"]
        dimension = committed_heaven["lod0"]["baseColor"]["dimensions"][0]
        for role in ("baseColor", "orm", "normal"):
            _, _, actual_rows = png_rgb(output / actual_heaven["lod0"][role]["file"])
            _, _, committed_rows = png_rgb(self.texture_root / committed_heaven["lod0"][role]["file"])
            for triangle in triangles:
                x, y = triangle_interior_pixel(heaven, triangle, dimension)
                actual_pixel = uv_pixel(actual_rows, x, y)
                committed_pixel = uv_pixel(committed_rows, x, y)
                with self.subTest(atlas="M_JadeBody:moving", role=role, triangle=triangle.index):
                    self.assertTrue(
                        all(abs(first - second) <= 1 for first, second in zip(actual_pixel, committed_pixel)),
                        (actual_pixel, committed_pixel),
                    )

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

    def test_current_source_runtime_atlases_preserve_semantic_and_material_ownership(self):
        physical = [
            obj
            for obj in bpy.data.objects
            if obj.type == "MESH" and not obj.get("dynamic_label_id")
        ]
        self.assertEqual(
            {obj["node_id"] for obj in bpy.data.objects if obj.get("node_id")},
            set(NODE_IDS),
        )
        self.assertFalse(any(
            obj.name == "transmission/bridge" or obj.name.startswith("anchor/course-copy/")
            for obj in bpy.data.objects
        ))
        self.assertEqual(
            {obj["runtime_atlas_id"] for obj in physical if obj.get("runtime_atlas_id")},
            {
                "M_JadeBody:hero",
                "M_JadeBody:moving",
                "M_JadeRecess:hero",
                "M_TranslucentJade:moving",
                "M_OldGold:hero",
                "M_OldGold:moving",
            },
        )
        branches = [bpy.data.objects[node_id] for node_id in BRANCH_INLAY_NODE_IDS]
        self.assertEqual({obj.data.materials[0]["material_family"] for obj in branches}, {"M_InkText"})
        self.assertTrue(all(not obj.get("runtime_atlas_id") for obj in branches))
        self.assertNotIn("M_EarthVoid", bpy.data.materials)
        self.assertNotIn("M_HeavenVoid", bpy.data.materials)

    def test_texture_contract_and_known_object_uv_regions_match_physical_materials(self):
        bpy.ops.wm.open_mainfile(
            filepath=str(REPOSITORY_ROOT / "assets/daliuren/source/daliuren-artifact-master.blend")
        )
        runtime = self.contract["runtimeTextures"]
        self.assertEqual(runtime["channels"], {
            "baseColor": "sRGB RGB",
            "orm": "Non-Color RGB: AO=R, roughness=G, metallic=B",
            "normal": "Non-Color RGB tangent-space",
        })
        self.assertNotIn("emissive", runtime["channels"])
        self.assertEqual(set(runtime["families"]), set(MATERIAL_FAMILIES))
        self.assertEqual(
            {family for family, payload in runtime["families"].items() if not payload["atlases"]},
            {"M_InkText", "M_CinnabarText"},
        )

        for family, payload in runtime["families"].items():
            for atlas_id, atlas in payload["atlases"].items():
                self.assertEqual(atlas["bakeEngine"], "BLENDER_CYCLES_NATIVE")
                self.assertEqual(atlas["uvLayoutSha256"], frozen_atlas_uv_hash(family, atlas_id))
                self.assertEqual(atlas["marginPixels"], 8)
                self.assertEqual(atlas["microTrianglePolicy"]["maxSurfaceAreaM2"], 2.0e-7)
                lod0_dimension = 2048 if atlas["class"] == "moving" else 4096
                for lod, expected_dimension in (("lod0", lod0_dimension), ("lod2", lod0_dimension // 2)):
                    maps = atlas[lod]
                    self.assertEqual(set(maps), {"baseColor", "orm", "normal"})
                    for role, record in maps.items():
                        path = self.texture_root / record["file"]
                        with self.subTest(family=family, atlas=atlas_id, lod=lod, role=role):
                            self.assertTrue(path.is_file())
                            self.assertEqual(record["dimensions"], [expected_dimension, expected_dimension])
                            self.assertEqual(record["channels"], "RGB")
                            self.assertEqual(record["colorSpace"], "sRGB" if role == "baseColor" else "Non-Color")
                            self.assertEqual(record["sha256"], sha256(path))
                            width, height, _ = png_rgb(path)
                            self.assertEqual((width, height), (expected_dimension, expected_dimension))

        decoded = {}
        for family, payload in runtime["families"].items():
            for atlas_id, atlas in payload["atlases"].items():
                decoded[atlas_id] = {}
                for role in ("baseColor", "orm", "normal"):
                    record = atlas["lod0"][role]
                    _, _, decoded[atlas_id][role] = png_rgb(self.texture_root / record["file"])

        representatives = {
            "M_JadeBody": 0,
            "M_TranslucentJade": 0,
            "M_JadeRecess": 0,
            "M_OldGold": 255,
        }
        for family, expected_metallic in representatives.items():
            obj = next(
                obj for obj in bpy.data.objects
                if obj.type == "MESH" and obj.get("runtime_texture_family") == family
            )
            triangle = largest_uv_triangle(obj)
            atlas = object_atlas(runtime, obj)
            dimension = atlas["lod0"]["baseColor"]["dimensions"][0]
            x, y = triangle_interior_pixel(obj, triangle, dimension)
            atlas_pixels = decoded[obj["runtime_atlas_id"]]
            with self.subTest(family=family, object=obj.name):
                self.assertEqual(uv_pixel(atlas_pixels["orm"], x, y)[2], expected_metallic)

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
        bronze_dimension = object_atlas(runtime, bronze)["lod0"]["orm"]["dimensions"][0]
        polished_xy = triangle_interior_pixel(bronze, polished, bronze_dimension)
        unpolished_xy = triangle_interior_pixel(bronze, unpolished, bronze_dimension)
        bronze_orm = decoded[bronze["runtime_atlas_id"]]["orm"]
        self.assertEqual(
            {
                uv_pixel(bronze_orm, *polished_xy)[1],
                uv_pixel(bronze_orm, *unpolished_xy)[1],
            },
            {round(0.27 * 255)},
        )

        recess = bpy.data.objects["detail/base/removable-bottom"]
        oxidation = recess.data.attributes["causal_recess_oxidation"]
        recess.data.calc_loop_triangles()
        oxidized = max(
            (triangle for triangle in recess.data.loop_triangles if oxidation.data[triangle.polygon_index].value > 0.8),
            key=lambda triangle: uv_triangle_area(recess, triangle),
        )
        recess_dimension = object_atlas(runtime, recess)["lod0"]["baseColor"]["dimensions"][0]
        oxidized_xy = triangle_interior_pixel(recess, oxidized, recess_dimension)
        oxidized_base = uv_pixel(decoded[recess["runtime_atlas_id"]]["baseColor"], *oxidized_xy)
        self.assertNotEqual(oxidized_base, (0, 0, 0))

        jade_detail = bpy.data.objects["detail/base/cast-corner/00"]
        jade_detail.data.calc_loop_triangles()
        jade_samples = sorted(
            jade_detail.data.loop_triangles,
            key=lambda triangle: uv_triangle_area(jade_detail, triangle),
            reverse=True,
        )[:20]
        normal_samples = set()
        normal_dimension = object_atlas(runtime, jade_detail)["lod0"]["normal"]["dimensions"][0]
        for triangle in jade_samples:
            try:
                xy = triangle_interior_pixel(jade_detail, triangle, normal_dimension)
            except AssertionError:
                continue
            normal_samples.add(uv_pixel(decoded[jade_detail["runtime_atlas_id"]]["normal"], *xy))
        self.assertGreaterEqual(len(normal_samples), 2)
        self.assertTrue(any(value != (128, 128, 255) for value in normal_samples))
        for value in normal_samples:
            length = math.sqrt(sum(((channel - 128) / 127.0) ** 2 for channel in value))
            self.assertAlmostEqual(length, 1.0, delta=0.05)

        committed = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))["runtimeTextures"]
        for family in MATERIAL_FAMILIES:
            for atlas_id, atlas in runtime["families"][family]["atlases"].items():
                for lod in ("lod0", "lod2"):
                    for role in ("baseColor", "orm", "normal"):
                        self.assertEqual(
                            atlas[lod][role]["sha256"],
                            committed["families"][family]["atlases"][atlas_id][lod][role]["sha256"],
                        )

    def test_source_causal_face_mutation_changes_its_jade_atlas_only(self):
        changed_atlas = "task5-test/causal-changed"
        control_atlas = "task5-test/causal-control"
        changed = self._low_resolution_source_material_fixture(
            "M_JadeBody",
            changed_atlas,
            causal_recess_oxidation=1.0,
            source_name="base/body",
        )
        self._low_resolution_source_material_fixture(
            "M_JadeBody",
            control_atlas,
            causal_recess_oxidation=1.0,
            source_name="base/body",
        )
        changed_before = _family_buffers("M_JadeBody", 32, changed_atlas)["baseColor"]
        control_before = _family_buffers("M_JadeBody", 32, control_atlas)["baseColor"]

        changed.data.attributes["causal_recess_oxidation"].data[0].value = 0.0
        changed_after = _family_buffers("M_JadeBody", 32, changed_atlas)["baseColor"]
        control_after = _family_buffers("M_JadeBody", 32, control_atlas)["baseColor"]

        self.assertNotEqual(changed_after, changed_before)
        self.assertNotEqual(
            buffer_pixel(changed_after, 32, 16, 16),
            buffer_pixel(changed_before, 32, 16, 16),
        )
        self.assertEqual(control_after, control_before)

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
            for atlas_id, atlas in self.contract["runtimeTextures"]["families"][family]["atlases"].items():
                for role in ("baseColor", "orm", "normal"):
                    lod0_record = atlas["lod0"][role]
                    lod2_record = atlas["lod2"][role]
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
                        with self.subTest(family=family, atlas=atlas_id, role=role, x=x, y=y):
                            self.assertEqual(pixel(target_rows, x, y), expected)

    def test_low_resolution_buffers_are_isolated_by_material_family(self):
        jade = self._low_resolution_source_material_fixture("M_JadeBody", "task5-test/jade")
        recess = self._low_resolution_source_material_fixture("M_JadeRecess", "task5-test/recess")
        jade_buffers = _family_buffers("M_JadeBody", 32, jade["runtime_atlas_id"])
        recess_buffers = _family_buffers("M_JadeRecess", 32, recess["runtime_atlas_id"])

        self.assertNotEqual(jade_buffers["baseColor"], recess_buffers["baseColor"])
        self.assertEqual(jade_buffers["orm"], _family_buffers("M_JadeBody", 32, jade["runtime_atlas_id"])["orm"])


if __name__ == "__main__":
    unittest.main(argv=[__file__, *(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])])
