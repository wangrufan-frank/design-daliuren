import argparse
from array import array
import copy
from contextlib import contextmanager
import hashlib
import json
import math
import struct
import sys
import zlib
from pathlib import Path

import bmesh
import bpy


REPOSITORY_ROOT = Path(__file__).parents[2]
DEFAULT_TEXTURE_ROOT = REPOSITORY_ROOT / "assets/daliuren/textures"
DEFAULT_CONTRACT_PATH = REPOSITORY_ROOT / "assets/daliuren/materials/material-contract.json"
DEFAULT_MASTER_PATH = REPOSITORY_ROOT / "assets/daliuren/source/daliuren-artifact-master.blend"

MATERIAL_FAMILIES = (
    "M_Bronze",
    "M_Patina",
    "M_Celadon",
    "M_OldGold",
    "M_AshText",
)
CAUSAL_ATTRIBUTES = (
    "causal_contact_wear",
    "causal_recess_oxidation",
    "causal_insert_boundary",
    "causal_celadon_crackle",
)
MICRO_TRIANGLE_AREA_MAX = 2.0e-7
GENERAL_KEYS = (
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
)
MOVING_NODE_IDS = {
    "calendar/slip",
    "lesson/first",
    "lesson/second",
    "lesson/third",
    "lesson/fourth",
    "transmission/bridge",
    *(f"general/{key}" for key in GENERAL_KEYS),
}
DYNAMIC_LABEL_OWNERS = {
    "dynamic/calendar": "calendar/slip",
    **{f"dynamic/lesson/{key}": f"lesson/{key}" for key in ("first", "second", "third", "fourth")},
    **{
        f"dynamic/transmission/{key}": f"transmission/{key}"
        for key in ("initial", "middle", "final")
    },
    **{f"dynamic/general/{key}": f"general/{key}" for key in GENERAL_KEYS},
    "dynamic/transmission/method": "transmission/bridge",
}
DYNAMIC_COURSE_VALUES_BY_FIELD = {
    "calendar": (
        "2026-08-14T23:57:00",
        "2026-08-15",
        "二〇二六年七月初二",
        "丙午",
        "丙申",
        "辛酉",
        "戊子",
        "辛",
        "庚申",
    ),
    "lessons": (
        "一课",
        "二课",
        "三课",
        "四课",
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
        "胜光",
    ),
    "transmissions": (
        "初传",
        "中传",
        "末传",
        "父母",
        "子孙",
        "官鬼",
        "妻财",
        "兄弟",
    ),
    "generals": (
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
    ),
    "method": ("反吟", "重审"),
}
FORBIDDEN_COURSE_VALUES = tuple(dict.fromkeys(
    value
    for values in DYNAMIC_COURSE_VALUES_BY_FIELD.values()
    for value in values
))

def _chunk(kind, payload):
    return (
        struct.pack(">I", len(payload))
        + kind
        + payload
        + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)
    )


def _clamp_byte(value):
    return max(0, min(255, int(round(value))))


def _linear_to_srgb(value):
    value = max(0.0, min(1.0, value))
    if value <= 0.0031308:
        return value * 12.92
    return 1.055 * value ** (1.0 / 2.4) - 0.055


def _rgb_bytes(linear):
    return tuple(_clamp_byte(_linear_to_srgb(channel) * 255.0) for channel in linear[:3])


def _write_rgb_png(path, dimension, pixels, srgb=False):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    compressor = zlib.compressobj(level=9)
    compressed = []
    stride = dimension * 3
    for y in range(dimension - 1, -1, -1):
        start = y * stride
        block = compressor.compress(b"\x00" + pixels[start : start + stride])
        if block:
            compressed.append(block)
    compressed.append(compressor.flush())
    payload = bytearray(b"\x89PNG\r\n\x1a\n")
    payload.extend(_chunk(b"IHDR", struct.pack(">IIBBBBB", dimension, dimension, 8, 2, 0, 0, 0)))
    if srgb:
        payload.extend(_chunk(b"sRGB", b"\x00"))
    payload.extend(_chunk(b"IDAT", b"".join(compressed)))
    payload.extend(_chunk(b"IEND", b""))
    path.write_bytes(payload)


def _sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def _slug(family):
    return family.removeprefix("M_").replace("_", "-").lower()


def _atlas_layout_sha256(family, atlas_id):
    digest = hashlib.sha256()
    for obj in _family_objects(family, atlas_id):
        digest.update(obj.name.encode("utf-8") + b"\0")
        layer = obj.data.uv_layers["UVMap"]
        digest.update(struct.pack("<I", len(layer.data)))
        for item in layer.data:
            digest.update(struct.pack("<2d", float(item.uv.x), float(item.uv.y)))
    return digest.hexdigest()


def _principled(material):
    nodes = [node for node in material.node_tree.nodes if node.bl_idname == "ShaderNodeBsdfPrincipled"]
    if len(nodes) != 1:
        raise RuntimeError(f"{material.name} requires one Principled shader for baking")
    return nodes[0]


def _material_parameters(family):
    material = bpy.data.materials[family]
    shader = _principled(material)
    return {
        "base": tuple(shader.inputs["Base Color"].default_value[:3]),
        "metallic": float(shader.inputs["Metallic"].default_value),
        "roughness": float(shader.inputs["Roughness"].default_value),
    }


def _family_objects(family, atlas_id=None):
    representatives = {}
    for obj in sorted((item for item in bpy.data.objects if item.type == "MESH"), key=lambda item: item.name):
        if obj.get("runtime_texture_family") == family and (
            atlas_id is None or obj.get("runtime_atlas_id") == atlas_id
        ):
            representatives.setdefault(obj.data.as_pointer(), obj)
    return tuple(representatives.values())


@contextmanager
def _joined_bake_proxy(objects):
    sources = tuple(objects)
    if not sources:
        raise RuntimeError("Native bake proxy requires source meshes")
    atlas_id = sources[0].get("runtime_atlas_id")
    hidden_sources = tuple(
        obj
        for obj in bpy.data.objects
        if obj.type == "MESH" and (
            obj.get("runtime_atlas_id") == atlas_id if atlas_id else obj in sources
        )
    )
    visibility = {obj: obj.hide_render for obj in hidden_sources}
    selected = tuple(obj for obj in bpy.context.selected_objects)
    active = bpy.context.view_layer.objects.active
    copies = []
    copy_mesh_names = []
    proxy = None
    try:
        bpy.ops.object.select_all(action="DESELECT")
        for index, source in enumerate(sources):
            duplicate = source.copy()
            duplicate.data = source.data.copy()
            duplicate.name = f"native-bake-proxy/source/{index}"
            duplicate.matrix_world = source.matrix_world.copy()
            duplicate.hide_render = False
            for name in CAUSAL_ATTRIBUTES:
                if duplicate.data.attributes.get(name) is None:
                    duplicate.data.attributes.new(name, "FLOAT", "FACE")
            bpy.context.scene.collection.objects.link(duplicate)
            duplicate.select_set(True)
            copies.append(duplicate)
            copy_mesh_names.append(duplicate.data.name)
        bpy.context.view_layer.objects.active = copies[0]
        if len(copies) > 1:
            bpy.ops.object.join()
        proxy = bpy.context.view_layer.objects.active
        proxy.name = "native-bake-proxy"
        proxy.hide_render = False
        for obj in hidden_sources:
            obj.hide_render = True
        bpy.context.view_layer.update()
        yield proxy
    finally:
        for obj, state in visibility.items():
            obj.hide_render = state
        bpy.ops.object.select_all(action="DESELECT")
        if proxy is not None and proxy.name in bpy.data.objects:
            bpy.data.objects.remove(proxy, do_unlink=True)
        for mesh_name in copy_mesh_names:
            mesh = bpy.data.meshes.get(mesh_name)
            if mesh is not None and mesh.users == 0:
                bpy.data.meshes.remove(mesh)
        for obj in selected:
            if obj.name in bpy.data.objects:
                obj.select_set(True)
        if active is not None and active.name in bpy.data.objects:
            bpy.context.view_layer.objects.active = active
        bpy.context.view_layer.update()


@contextmanager
def _joined_ao_proxy(target):
    occluders = tuple(sorted((
        obj for obj in bpy.data.objects
        if obj.type == "MESH"
        and obj != target
        and not obj.hide_render
        and not obj.get("dynamic_label_id")
    ), key=lambda obj: obj.name))
    sources = (target, *occluders)
    visibility = {obj: obj.hide_render for obj in sources}
    selected = tuple(bpy.context.selected_objects)
    active = bpy.context.view_layer.objects.active
    copies = []
    copy_mesh_names = []
    occluder = None
    try:
        bpy.ops.object.select_all(action="DESELECT")
        for index, source in enumerate(sources):
            duplicate = source.copy()
            duplicate.data = source.data.copy()
            duplicate.name = f"native-ao-proxy/source/{index:04d}"
            duplicate.matrix_world = source.matrix_world.copy()
            duplicate.hide_render = False
            if index:
                layer = duplicate.data.uv_layers.get("UVMap")
                if layer is None:
                    layer = duplicate.data.uv_layers.new(name="UVMap")
                for item in layer.data:
                    item.uv = (-10.0, -10.0)
            bpy.context.scene.collection.objects.link(duplicate)
            duplicate.select_set(True)
            copies.append(duplicate)
            copy_mesh_names.append(duplicate.data.name)
        bpy.context.view_layer.objects.active = copies[0]
        if len(copies) > 1:
            bpy.ops.object.join()
        occluder = bpy.context.view_layer.objects.active
        occluder.name = "native-ao-proxy"
        for source in sources:
            source.hide_render = True
        bpy.context.view_layer.update()
        yield occluder
    finally:
        for obj, state in visibility.items():
            obj.hide_render = state
        bpy.ops.object.select_all(action="DESELECT")
        if occluder is not None and occluder.name in bpy.data.objects:
            bpy.data.objects.remove(occluder, do_unlink=True)
        for mesh_name in copy_mesh_names:
            mesh = bpy.data.meshes.get(mesh_name)
            if mesh is not None and mesh.users == 0:
                bpy.data.meshes.remove(mesh)
        for obj in selected:
            if obj.name in bpy.data.objects:
                obj.select_set(True)
        if active is not None and active.name in bpy.data.objects:
            bpy.context.view_layer.objects.active = active
        bpy.context.view_layer.update()


def _native_unique_coverage(objects, dimension):
    return _native_island_coverage(objects, dimension)[0]


def _native_island_coverage(objects, dimension):
    coverage = bytearray(dimension * dimension)
    owners = array("I", [0]) * (dimension * dimension)
    next_owner = 1
    for obj in objects:
        mesh = obj.data
        layer = mesh.uv_layers["UVMap"]
        mesh.calc_loop_triangles()
        island_ids = _triangle_uv_island_ids(mesh, layer)
        owner_ids = {
            island_id: next_owner + offset
            for offset, island_id in enumerate(sorted(set(island_ids.values())))
        }
        next_owner += len(owner_ids)
        for triangle in mesh.loop_triangles:
            points = tuple(tuple(layer.data[index].uv) for index in triangle.loops)
            owner = owner_ids[island_ids[triangle.index]]
            for x, y in _triangle_pixel_centers(points, dimension):
                index = y * dimension + x
                coverage[index] = min(2, coverage[index] + 1)
                if owners[index] in (0, owner):
                    owners[index] = owner
                else:
                    owners[index] = 0xFFFFFFFF
    return coverage, owners


def _dilate_rgb(pixels, active, dimension, margin, owners=None):
    frontier = []
    for y in range(dimension):
        row = y * dimension
        for x in range(dimension):
            index = row + x
            if not active[index]:
                continue
            if (
                (x > 0 and not active[index - 1])
                or (x + 1 < dimension and not active[index + 1])
                or (y > 0 and not active[index - dimension])
                or (y + 1 < dimension and not active[index + dimension])
            ):
                frontier.append(index)

    blocked = bytearray(dimension * dimension)
    for _step in range(margin):
        claimed = bytearray(dimension * dimension)
        additions = []
        for source in frontier:
            x = source % dimension
            y = source // dimension
            for target in (
                source - dimension - 1 if x > 0 and y > 0 else -1,
                source - dimension if y > 0 else -1,
                source - dimension + 1 if x + 1 < dimension and y > 0 else -1,
                source - 1 if x > 0 else -1,
                source + 1 if x + 1 < dimension else -1,
                source + dimension - 1 if x > 0 and y + 1 < dimension else -1,
                source + dimension if y + 1 < dimension else -1,
                source + dimension + 1 if x + 1 < dimension and y + 1 < dimension else -1,
            ):
                if target < 0 or active[target] or blocked[target]:
                    continue
                if not claimed[target]:
                    claimed[target] = 1
                    additions.append((target, source))
                    if owners is not None:
                        owners[target] = owners[source]
                elif owners is not None:
                    if owners[target] != owners[source]:
                        claimed[target] = 2
        frontier = []
        for target, source in additions:
            if claimed[target] == 2:
                blocked[target] = 1
                if owners is not None:
                    owners[target] = 0xFFFFFFFF
                continue
            target_offset = target * 3
            source_offset = source * 3
            pixels[target_offset : target_offset + 3] = pixels[source_offset : source_offset + 3]
            active[target] = 1
            frontier.append(target)
    return pixels


def _stabilize_native_pixels(pixels, coverage, dimension, margin, passes=4, owners=None):
    filtered = bytearray(pixels)
    for _pass in range(passes):
        source = filtered
        filtered = bytearray(source)
        for y in range(1, dimension - 1):
            row = y * dimension
            for x in range(1, dimension - 1):
                index = row + x
                if coverage[index] != 1:
                    continue
                neighbors = [
                    neighbor
                    for neighbor in (
                        index - dimension - 1,
                        index - dimension,
                        index - dimension + 1,
                        index - 1,
                        index,
                        index + 1,
                        index + dimension - 1,
                        index + dimension,
                        index + dimension + 1,
                    )
                    if coverage[neighbor] == 1
                    and (owners is None or owners[neighbor] == owners[index])
                ]
                neighbors.sort(key=lambda neighbor: source[neighbor * 3])
                chosen = neighbors[len(neighbors) // 2]
                filtered[index * 3 : index * 3 + 3] = source[chosen * 3 : chosen * 3 + 3]
    active = bytearray(1 if value == 1 else 0 for value in coverage)
    return _dilate_rgb(filtered, active, dimension, margin, owners)


def _image_rgb_bytes(image, background, srgb=False, coverage=None, margin=0, owners=None):
    values = array("f", [0.0]) * (image.size[0] * image.size[1] * 4)
    image.pixels.foreach_get(values)
    result = bytearray(image.size[0] * image.size[1] * 3)
    active = bytearray(image.size[0] * image.size[1])
    for source in range(0, len(values), 4):
        target = source // 4 * 3
        pixel_index = source // 4
        if values[source + 3] <= 1e-6 or (coverage is not None and coverage[pixel_index] != 1):
            result[target : target + 3] = bytes(background)
        else:
            active[pixel_index] = 1
            result[target : target + 3] = bytes(
                _clamp_byte(
                    (_linear_to_srgb(values[source + channel]) if srgb else values[source + channel])
                    * 255.0
                )
                for channel in range(3)
            )
    return _dilate_rgb(result, active, image.size[0], margin, owners)


def _native_bake_channel(
    family,
    dimension,
    bake_type,
    margin,
    atlas_id=None,
    background=(0, 0, 0),
    srgb=False,
    objects=None,
    coverage=None,
    owners=None,
):
    objects = _family_objects(family, atlas_id) if objects is None else tuple(objects)
    if not objects:
        raise RuntimeError(f"No objects assigned to native bake family {family}")
    materials = tuple(sorted({
        material
        for obj in objects
        for material in obj.data.materials
        if material is not None
    }, key=lambda material: material.name))
    if not materials:
        raise RuntimeError(f"No materials assigned to native bake family {family}")

    scene = bpy.context.scene
    previous_engine = scene.render.engine
    previous_samples = scene.cycles.samples
    previous_seed = scene.cycles.seed
    previous_animated_seed = scene.cycles.use_animated_seed
    previous_sampling_pattern = scene.cycles.sampling_pattern
    previous_scrambling_distance = scene.cycles.scrambling_distance
    previous_auto_scrambling = scene.cycles.auto_scrambling_distance
    previous_adaptive_sampling = scene.cycles.use_adaptive_sampling
    object_set = set(objects)
    visibility = {}
    image = bpy.data.images.new(
        f"native-bake/{family}/{bake_type}/{dimension}",
        width=dimension,
        height=dimension,
        alpha=True,
        float_buffer=False,
    )
    image.generated_color = (0.0, 0.0, 0.0, 0.0)
    image.colorspace_settings.name = "Non-Color"
    nodes = []
    emission_overrides = []
    try:
        for obj in bpy.data.objects:
            hide_for_channel = (
                obj.type == "MESH"
                and obj not in object_set
                and (bake_type != "AO" or obj.get("dynamic_label_id"))
            )
            if hide_for_channel:
                visibility[obj] = obj.hide_render
                obj.hide_render = True
        for material in materials:
            if not material.use_nodes:
                material.use_nodes = True
            node = material.node_tree.nodes.new("ShaderNodeTexImage")
            node.name = f"Native bake target {bake_type}"
            node.image = image
            material.node_tree.nodes.active = node
            nodes.append((material, node))

            if bake_type == "BASE_COLOR":
                shader = _principled(material)
                source = shader.inputs["Base Color"]
                emission = material.node_tree.nodes.new("ShaderNodeEmission")
                if source.is_linked:
                    material.node_tree.links.new(source.links[0].from_socket, emission.inputs["Color"])
                else:
                    emission.inputs["Color"].default_value = source.default_value
                outputs = [
                    output for output in material.node_tree.nodes
                    if output.bl_idname == "ShaderNodeOutputMaterial" and output.is_active_output
                ]
                saved = []
                for output in outputs:
                    surface = output.inputs["Surface"]
                    saved.append((surface, tuple(link.from_socket for link in surface.links)))
                    for link in tuple(surface.links):
                        material.node_tree.links.remove(link)
                    material.node_tree.links.new(emission.outputs["Emission"], surface)
                emission_overrides.append((material, emission, saved))

        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.hide_render = False
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.samples = 4
        scene.cycles.seed = 1
        scene.cycles.use_animated_seed = False
        scene.cycles.sampling_pattern = "TABULATED_SOBOL"
        scene.cycles.scrambling_distance = 0.0
        scene.cycles.auto_scrambling_distance = False
        scene.cycles.use_adaptive_sampling = False
        arguments = {
            "type": "EMIT" if bake_type == "BASE_COLOR" else bake_type,
            "target": "IMAGE_TEXTURES",
            "save_mode": "INTERNAL",
            "use_clear": True,
            "use_selected_to_active": False,
            "margin": 0,
            "margin_type": "EXTEND",
            "uv_layer": "UVMap",
        }
        if bake_type == "NORMAL":
            arguments["normal_space"] = "TANGENT"
        bpy.ops.object.bake(**arguments)
        if coverage is None:
            coverage, owners = _native_island_coverage(objects, dimension)
        return _image_rgb_bytes(image, background, srgb, coverage, margin, owners)
    finally:
        scene.render.engine = previous_engine
        scene.cycles.samples = previous_samples
        scene.cycles.seed = previous_seed
        scene.cycles.use_animated_seed = previous_animated_seed
        scene.cycles.sampling_pattern = previous_sampling_pattern
        scene.cycles.scrambling_distance = previous_scrambling_distance
        scene.cycles.auto_scrambling_distance = previous_auto_scrambling
        scene.cycles.use_adaptive_sampling = previous_adaptive_sampling
        for obj, state in visibility.items():
            obj.hide_render = state
        for material, emission, saved in emission_overrides:
            for surface, sources in saved:
                for link in tuple(surface.links):
                    material.node_tree.links.remove(link)
                for source in sources:
                    material.node_tree.links.new(source, surface)
            material.node_tree.nodes.remove(emission)
        for material, node in nodes:
            material.node_tree.nodes.remove(node)
        bpy.data.images.remove(image)


def _triangle_pixel_centers(points, dimension):
    denominator = (
        (points[1][1] - points[2][1]) * (points[0][0] - points[2][0])
        + (points[2][0] - points[1][0]) * (points[0][1] - points[2][1])
    )
    if abs(denominator) <= 1e-16:
        return
    minimum_x = max(0, int(math.floor(min(value[0] for value in points) * dimension)))
    maximum_x = min(dimension, int(math.ceil(max(value[0] for value in points) * dimension)))
    minimum_y = max(0, int(math.floor(min(value[1] for value in points) * dimension)))
    maximum_y = min(dimension, int(math.ceil(max(value[1] for value in points) * dimension)))
    for y in range(minimum_y, maximum_y):
        v = (y + 0.5) / dimension
        for x in range(minimum_x, maximum_x):
            u = (x + 0.5) / dimension
            first = ((points[1][1] - points[2][1]) * (u - points[2][0]) + (points[2][0] - points[1][0]) * (v - points[2][1])) / denominator
            second = ((points[2][1] - points[0][1]) * (u - points[2][0]) + (points[0][0] - points[2][0]) * (v - points[2][1])) / denominator
            if min(first, second, 1.0 - first - second) >= -1e-9:
                yield x, y


def _triangle_has_pixel_center(points, dimension):
    return next(_triangle_pixel_centers(points, dimension), None) is not None


def _triangle_uv_island_ids(mesh, layer):
    mesh.calc_loop_triangles()
    parents = list(range(len(mesh.loop_triangles)))

    def find(index):
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    def union(first, second):
        first = find(first)
        second = find(second)
        if first != second:
            parents[second] = first

    uv_edges = {}
    for triangle in mesh.loop_triangles:
        for first, second in ((0, 1), (1, 2), (2, 0)):
            vertices = (triangle.vertices[first], triangle.vertices[second])
            loops = (triangle.loops[first], triangle.loops[second])
            endpoints = tuple(sorted(
                (
                    vertex,
                    round(float(layer.data[loop].uv.x), 10),
                    round(float(layer.data[loop].uv.y), 10),
                )
                for vertex, loop in zip(vertices, loops)
            ))
            key = (tuple(sorted(vertices)), endpoints)
            if key in uv_edges:
                union(triangle.index, uv_edges[key])
            else:
                uv_edges[key] = triangle.index
    roots = {}
    result = {}
    for triangle in mesh.loop_triangles:
        root = find(triangle.index)
        result[triangle.index] = roots.setdefault(root, len(roots) + 1)
    return result


def _object_texel_coverage_failures(obj, dimension, dilation=4, limit=None):
    failures = []
    mesh = obj.data
    layer = mesh.uv_layers["UVMap"]
    mesh.calc_loop_triangles()
    island_ids = _triangle_uv_island_ids(mesh, layer)
    owners = array("I", [0]) * (dimension * dimension)
    triangles = []
    for triangle in mesh.loop_triangles:
        points = tuple(tuple(layer.data[index].uv) for index in triangle.loops)
        centers = tuple(_triangle_pixel_centers(points, dimension))
        for x, y in centers:
            index = y * dimension + x
            island_id = island_ids[triangle.index]
            if owners[index] in (0, island_id):
                owners[index] = island_id
            else:
                owners[index] = 0xFFFFFFFF
        triangles.append((triangle, points, bool(centers)))
    for triangle, points, has_center in triangles:
        if has_center:
            continue
        u = sum(point[0] for point in points) / 3.0
        v = sum(point[1] for point in points) / 3.0
        center_x = min(dimension - 1, max(0, int(u * dimension)))
        center_y = min(dimension - 1, max(0, int(v * dimension)))
        island_id = island_ids[triangle.index]
        padded = any(
            owners[y * dimension + x] == island_id
            for y in range(max(0, center_y - dilation), min(dimension, center_y + dilation + 1))
            for x in range(max(0, center_x - dilation), min(dimension, center_x + dilation + 1))
        )
        if not padded:
            failures.append((obj.name, triangle.index))
            if limit is not None and len(failures) >= limit:
                return failures
    return failures


def _native_texel_coverage_failures(family, dimension, dilation=4, limit=None, atlas_id=None):
    failures = []
    for obj in _family_objects(family, atlas_id):
        remaining = None if limit is None else limit - len(failures)
        failures.extend(_object_texel_coverage_failures(obj, dimension, dilation, remaining))
        if limit is not None and len(failures) >= limit:
            return failures
    return failures


def _validate_native_texel_coverage(family, dimension, atlas_id=None):
    failures = _native_texel_coverage_failures(family, dimension, atlas_id=atlas_id)
    failures = [
        (object_name, triangle_index)
        for object_name, triangle_index in failures
        if bpy.data.objects[object_name].data.loop_triangles[triangle_index].area
        > MICRO_TRIANGLE_AREA_MAX
    ]
    if failures:
        obj_name, triangle_index = failures[0]
        raise RuntimeError(
            f"sub-texel UV triangle cannot be baked natively: {obj_name}:{triangle_index} at {dimension}"
        )


def _family_buffers(family, dimension, atlas_id=None):
    margin = 8
    _validate_native_texel_coverage(family, dimension, atlas_id)
    parameters = _material_parameters(family)
    source_objects = _family_objects(family, atlas_id)
    coverage, owners = _native_island_coverage(source_objects, dimension)
    with _joined_bake_proxy(source_objects) as proxy:
        proxy_objects = (proxy,)
        base = _native_bake_channel(
            family,
            dimension,
            "BASE_COLOR",
            margin,
            atlas_id,
            background=_rgb_bytes(parameters["base"]),
            srgb=True,
            objects=proxy_objects,
            coverage=coverage,
            owners=array("I", owners),
        )
        with _joined_ao_proxy(proxy_objects[0]) as ao_proxy:
            ao = _native_bake_channel(
                family, dimension, "AO", 0, atlas_id,
                background=(255, 255, 255), objects=(ao_proxy,), coverage=coverage,
                owners=array("I", owners),
            )
        ao = _stabilize_native_pixels(
            ao, coverage, dimension, margin, owners=array("I", owners)
        )
        roughness_value = _clamp_byte(parameters["roughness"] * 255.0)
        roughness = _native_bake_channel(
            family,
            dimension,
            "ROUGHNESS",
            margin,
            atlas_id,
            background=(roughness_value,) * 3,
            objects=proxy_objects,
            coverage=coverage,
            owners=array("I", owners),
        )
        normal = _native_bake_channel(
            family,
            dimension,
            "NORMAL",
            margin,
            atlas_id,
            background=(128, 128, 255),
            objects=proxy_objects,
            coverage=coverage,
            owners=array("I", owners),
        )
    metallic = _clamp_byte(parameters["metallic"] * 255.0)
    orm = bytearray(dimension * dimension * 3)
    for offset in range(0, len(orm), 3):
        orm[offset] = ao[offset]
        orm[offset + 1] = roughness[offset]
        orm[offset + 2] = metallic
    return {"baseColor": base, "orm": orm, "normal": normal}


def _downsample_two_by_two(source, source_dimension):
    target_dimension = source_dimension // 2
    target = bytearray(target_dimension * target_dimension * 3)
    for y in range(target_dimension):
        first_row = y * 2 * source_dimension * 3
        second_row = first_row + source_dimension * 3
        for x in range(target_dimension):
            first = first_row + x * 6
            second = second_row + x * 6
            output = (y * target_dimension + x) * 3
            for channel in range(3):
                target[output + channel] = (
                    source[first + channel]
                    + source[first + 3 + channel]
                    + source[second + channel]
                    + source[second + 3 + channel]
                    + 2
                ) // 4
    return target


def _validate_bake_source():
    root = bpy.data.objects.get("artifact/root")
    runtime = [obj for obj in bpy.data.objects if "node_id" in obj]
    details = [obj for obj in bpy.data.objects if "detail_id" in obj]
    inscriptions = [obj for obj in bpy.data.objects if "inscription_role" in obj]
    if root is None or root.get("node_id") != "artifact/root":
        raise RuntimeError("Daliuren master scene is required for texture baking")
    if (len(runtime), len(details), len(inscriptions)) != (28, 85, 71):
        raise RuntimeError("Daliuren master requires 28 runtime, 85 detail and 71 inscription objects")
    missing_materials = [name for name in MATERIAL_FAMILIES if bpy.data.materials.get(name) is None]
    if missing_materials:
        raise RuntimeError(f"Daliuren master materials are missing: {', '.join(missing_materials)}")
    dynamic = [obj for obj in bpy.data.objects if obj.get("dynamic_label_id")]
    if len(dynamic) != 21:
        raise RuntimeError("Daliuren master requires 21 dynamic label surfaces before baking")
    dynamic_values = set(FORBIDDEN_COURSE_VALUES)
    for obj in dynamic:
        bake_input = " ".join((obj.name, obj.data.name, *(str(value) for value in obj.values())))
        if any(value in bake_input for value in dynamic_values):
            raise RuntimeError(f"Dynamic label bake input contains course data: {obj.name}")
    physical = [
        obj
        for obj in bpy.data.objects
        if obj.type == "MESH" and not obj.get("dynamic_label_id")
    ]
    if any(obj.get("runtime_texture_family") not in MATERIAL_FAMILIES for obj in physical):
        raise RuntimeError("Daliuren master meshes require runtime texture family ownership")
    attributes = {
        attribute.name
        for obj in physical
        for attribute in obj.data.attributes
    }
    required_attributes = {
        "causal_contact_wear",
        "causal_recess_oxidation",
        "causal_insert_boundary",
        "causal_celadon_crackle",
    }
    if not required_attributes.issubset(attributes):
        raise RuntimeError("Daliuren master causal attributes are incomplete")
    atlas_ids = {obj.get("runtime_atlas_id") for obj in physical}
    if None in atlas_ids or any(obj.get("runtime_atlas_class") not in {"hero", "moving"} for obj in physical):
        raise RuntimeError("Daliuren master meshes require explicit runtime atlas ownership")
    for atlas_id in atlas_ids:
        objects = [obj for obj in physical if obj.get("runtime_atlas_id") == atlas_id]
        if any(detect_uv_issues(obj) for obj in objects):
            raise RuntimeError(f"Daliuren master UV atlas is invalid for {atlas_id}")
        if first_family_uv_overlap(objects) is not None:
            raise RuntimeError(f"Daliuren master UV atlas overlaps across meshes in {atlas_id}")


def generate_runtime_textures(texture_root, atlas_ids=None):
    _validate_bake_source()
    texture_root = Path(texture_root)
    requested = None if atlas_ids is None else set(atlas_ids)
    result = {
        family: {
            "assignment": f"objects whose runtime_texture_family is {family}",
            "atlases": {},
        }
        for family in MATERIAL_FAMILIES
    }
    groups = {}
    for obj in bpy.data.objects:
        if obj.type != "MESH" or obj.get("dynamic_label_id"):
            continue
        atlas_id = obj["runtime_atlas_id"]
        groups.setdefault(atlas_id, obj)
    if requested is not None and not requested.issubset(groups):
        raise ValueError(f"Unknown runtime atlas IDs: {sorted(requested - set(groups))}")

    for atlas_id, sample in sorted(groups.items()):
        if requested is not None and atlas_id not in requested:
            continue
        family = sample["runtime_texture_family"]
        atlas_class = sample["runtime_atlas_class"]
        lod0_dimension = 2048 if atlas_class == "moving" else 4096
        bake_scale = max(
            obj.get("runtime_bake_scale", 1)
            for obj in bpy.data.objects
            if obj.type == "MESH" and obj.get("runtime_atlas_id") == atlas_id
        )
        working_dimension = lod0_dimension * bake_scale
        working = _family_buffers(family, working_dimension, atlas_id)
        lod0 = working
        dimension = working_dimension
        while dimension > lod0_dimension:
            lod0 = {
                role: _downsample_two_by_two(pixels, dimension)
                for role, pixels in lod0.items()
            }
            dimension //= 2
        lod_buffers = {
            "lod0": lod0,
            "lod2": {
                role: _downsample_two_by_two(pixels, lod0_dimension)
                for role, pixels in lod0.items()
            },
        }
        partition = atlas_id.split(":", 1)[1].replace("_", "-")
        atlas_result = {
            "class": atlas_class,
            "bakeEngine": "BLENDER_CYCLES_NATIVE",
            "workingDimensions": [working_dimension, working_dimension],
            "uvLayoutSha256": _atlas_layout_sha256(family, atlas_id),
            "marginPixels": 8,
            "microTrianglePolicy": {
                "maxSurfaceAreaM2": MICRO_TRIANGLE_AREA_MAX,
                "fallback": "physical family defaults outside native coverage",
            },
        }
        for lod, output_dimension in (
            ("lod0", lod0_dimension),
            ("lod2", lod0_dimension // 2),
        ):
            maps = {}
            for role, suffix, colorspace in (
                ("baseColor", "basecolor", "sRGB"),
                ("orm", "orm", "Non-Color"),
                ("normal", "normal", "Non-Color"),
            ):
                relative = Path(lod) / f"{_slug(family)}-{partition}-{suffix}.png"
                path = texture_root / relative
                _write_rgb_png(
                    path,
                    output_dimension,
                    lod_buffers[lod][role],
                    srgb=role == "baseColor",
                )
                maps[role] = {
                    "file": relative.as_posix(),
                    "dimensions": [output_dimension, output_dimension],
                    "channels": "RGB",
                    "colorSpace": colorspace,
                    "sha256": _sha256(path),
                }
            atlas_result[lod] = maps
        result[family]["atlases"][atlas_id] = atlas_result
    return result


def _dynamic_surface_spec(dynamic_id):
    if dynamic_id == "dynamic/calendar":
        return (0.124, 0.007), (0.0, -0.002, 0.00825)
    if dynamic_id.startswith("dynamic/lesson/"):
        return (0.052, 0.012), (0.0, 0.0, 0.00425)
    if dynamic_id == "dynamic/transmission/method":
        return (0.090, 0.004), (0.0, 0.0205, 0.00425)
    if dynamic_id.startswith("dynamic/transmission/"):
        return (0.044, 0.014), (0.0, 0.0, 0.00525)
    return (0.016, 0.010), (0.0, 0.0, 0.00725)


def _placeholder_material():
    if bpy.data.materials.get("M_DynamicLabelPlaceholder") is not None:
        raise RuntimeError("Dynamic label placeholder already exists")
    material = bpy.data.materials.new("M_DynamicLabelPlaceholder")
    material.use_nodes = True
    shader = next(
        node
        for node in material.node_tree.nodes
        if node.bl_idname == "ShaderNodeBsdfPrincipled"
    )
    shader.inputs["Base Color"].default_value = (0.035, 0.045, 0.043, 1.0)
    shader.inputs["Metallic"].default_value = 0.0
    shader.inputs["Roughness"].default_value = 0.82
    material["runtime_role"] = "blank-dynamic-label-placeholder"
    return material


def _add_dynamic_surfaces():
    placeholder = _placeholder_material()
    surfaces = []
    for dynamic_id, owner_id in DYNAMIC_LABEL_OWNERS.items():
        owner = bpy.data.objects.get(owner_id)
        if owner is None or owner.get("node_id") != owner_id:
            raise RuntimeError(f"Missing dynamic label owner: {owner_id}")
        (width, height), location = _dynamic_surface_spec(dynamic_id)
        vertices = (
            (-width / 2, -height / 2, 0.0),
            (width / 2, -height / 2, 0.0),
            (width / 2, height / 2, 0.0),
            (-width / 2, height / 2, 0.0),
        )
        mesh = bpy.data.meshes.new(f"surface/{dynamic_id}/mesh")
        mesh.from_pydata(vertices, (), ((0, 1, 2, 3),))
        mesh.update()
        obj = bpy.data.objects.new(f"surface/{dynamic_id}", mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.parent = owner
        obj.location = location
        obj["dynamic_label_id"] = dynamic_id
        obj["owner_node_id"] = owner_id
        obj["runtime_texture_family"] = "M_DynamicLabelPlaceholder"
        mesh.materials.append(placeholder)
        surfaces.append(obj)
    return tuple(surfaces)


def _clean_mesh_for_uv(mesh):
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-9, edges=list(bm.edges))
    bmesh.ops.triangulate(
        bm,
        faces=list(bm.faces),
        quad_method="BEAUTY",
        ngon_method="BEAUTY",
    )
    bm.normal_update()
    degenerate = [face for face in bm.faces if face.calc_area() <= 1e-12]
    if degenerate:
        bmesh.ops.delete(bm, geom=degenerate, context="FACES")
    bm.to_mesh(mesh)
    bm.free()


def _mark_uv_seams(mesh):
    bm = bmesh.new()
    bm.from_mesh(mesh)
    for edge in bm.edges:
        edge.seam = len(edge.link_faces) != 2 or edge.calc_face_angle(0.0) > math.radians(60.0)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()


def _select_all_mesh_uvs(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.select_all(action="SELECT")


def _seam_unwrap(obj):
    _select_all_mesh_uvs(obj)
    bpy.ops.uv.unwrap(
        method="ANGLE_BASED",
        fill_holes=True,
        correct_aspect=True,
        margin_method="SCALED",
        margin=0.0,
    )
    bpy.ops.uv.pack_islands(
        udim_source="CLOSEST_UDIM",
        rotate=True,
        scale=True,
        margin=0.0,
        shape_method="AABB",
    )
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.select_set(False)


def _triangle_island_unwrap(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for edge in bm.edges:
        edge.seam = True
    bm.to_mesh(obj.data)
    bm.free()
    _seam_unwrap(obj)


def _largest_triangle_shape_error(obj):
    mesh = obj.data
    layer = mesh.uv_layers["UVMap"]
    mesh.calc_loop_triangles()
    triangle = max(mesh.loop_triangles, key=lambda item: _triangle_area(tuple(tuple(layer.data[index].uv) for index in item.loops)))
    points = [mesh.vertices[index].co for index in triangle.vertices]
    uv = [layer.data[index].uv for index in triangle.loops]
    lengths_3d = sorted((points[(index + 1) % 3] - points[index]).length for index in range(3))
    lengths_uv = sorted((uv[(index + 1) % 3] - uv[index]).length for index in range(3))
    normalized_3d = [value / lengths_3d[-1] for value in lengths_3d]
    normalized_uv = [value / lengths_uv[-1] for value in lengths_uv]
    return max(abs(first - second) for first, second in zip(normalized_3d, normalized_uv))


def _smart_unwrap(obj, angle_degrees=66.0):
    mesh = obj.data
    while mesh.uv_layers:
        mesh.uv_layers.remove(mesh.uv_layers[0])
    mesh.uv_layers.new(name="UVMap").active_render = True
    _select_all_mesh_uvs(obj)
    bpy.ops.uv.smart_project(
        angle_limit=math.radians(angle_degrees),
        margin_method="SCALED",
        rotate_method="AXIS_ALIGNED_Y",
        island_margin=0.0,
        area_weight=0.0,
        correct_aspect=True,
        scale_to_bounds=False,
    )
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.select_set(False)


def _pack_family_atlas(objects, lod0_dimension):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.average_islands_scale()
    bpy.ops.object.mode_set(mode="OBJECT")

    metrics = []
    total_surface = 0.0
    total_triangles = 0
    for obj in objects:
        mesh = obj.data
        mesh.calc_loop_triangles()
        surface = sum(polygon.area for polygon in mesh.polygons)
        triangles = len(mesh.loop_triangles)
        total_surface += surface
        total_triangles += triangles
        metrics.append((obj, surface, triangles))
    for obj, surface, triangles in metrics:
        mesh = obj.data
        layer = mesh.uv_layers["UVMap"]
        current_area = sum(
            _triangle_area(tuple(tuple(layer.data[index].uv) for index in triangle.loops))
            for triangle in mesh.loop_triangles
        )
        desired_area = 0.25 * surface / total_surface + 0.75 * triangles / total_triangles
        scale = math.sqrt(desired_area / current_area)
        for item in layer.data:
            item.uv *= scale

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(
        udim_source="CLOSEST_UDIM",
        rotate=True,
        rotate_method="ANY",
        scale=True,
        margin_method="FRACTION",
        margin=16.0 / lod0_dimension,
        shape_method="AABB",
    )
    bpy.ops.object.mode_set(mode="OBJECT")
    for obj in objects:
        obj.select_set(False)


def assign_primary_uvs(dynamic_surfaces):
    dynamic_pointers = {obj.data.as_pointer() for obj in dynamic_surfaces}
    source_meshes = {
        obj.data.as_pointer(): obj.data
        for obj in bpy.data.objects
        if obj.type == "MESH" and obj.data.as_pointer() not in dynamic_pointers
    }
    for _ in range(2):
        for mesh in source_meshes.values():
            _clean_mesh_for_uv(mesh)
    for mesh in source_meshes.values():
        _mark_uv_seams(mesh)
    atlas_groups = {}
    for obj in sorted((item for item in bpy.data.objects if item.type == "MESH"), key=lambda item: item.name):
        if obj.data.as_pointer() in dynamic_pointers:
            continue
        family = obj.get("material_role")
        if family not in MATERIAL_FAMILIES:
            continue
        current = obj
        moving = False
        while current is not None:
            if current.get("node_id") in MOVING_NODE_IDS:
                moving = True
                break
            current = current.parent
        atlas_class = "moving" if moving else "hero"
        if obj.name == "plate/heaven":
            atlas_id = "M_Bronze:heaven"
        elif obj.name == "detail/base/removable-bottom":
            atlas_id = "M_Patina:removable-bottom"
        elif obj.name == "inscription/historical-month-deity/56":
            atlas_id = "M_AshText:historical-month"
        else:
            atlas_id = f"{family}:{'moving' if moving else 'hero'}"
        obj["runtime_atlas_id"] = atlas_id
        obj["runtime_atlas_class"] = atlas_class
        obj["runtime_bake_scale"] = 1
        obj["runtime_texture_family"] = family
        atlas_groups.setdefault((family, atlas_id), {})
        atlas_groups[(family, atlas_id)].setdefault(obj.data.as_pointer(), obj)

    for (_family, atlas_id), representatives in sorted(atlas_groups.items()):
        objects = tuple(representatives.values())
        for obj in objects:
            if obj.name == "plate/heaven":
                _seam_unwrap(obj)
            else:
                _smart_unwrap(obj, 66.0)
        lod0_dimension = 2048 if objects[0]["runtime_atlas_class"] == "moving" else 4096
        _pack_family_atlas(objects, lod0_dimension)
        for angle_degrees in (60.0, 45.0, 30.0, 0.1):
            overlapping = [
                obj for obj in objects
                if "triangle-overlap" in detect_uv_issues(obj)
            ]
            if not overlapping:
                break
            for obj in overlapping:
                _smart_unwrap(obj, angle_degrees)
            _pack_family_atlas(objects, lod0_dimension)
        overlapping = [
            obj for obj in objects
            if "triangle-overlap" in detect_uv_issues(obj)
        ]
        if overlapping:
            for obj in overlapping:
                _triangle_island_unwrap(obj)
            _pack_family_atlas(objects, lod0_dimension)

    for obj in dynamic_surfaces:
        mesh = obj.data
        while mesh.uv_layers:
            mesh.uv_layers.remove(mesh.uv_layers[0])
        layer = mesh.uv_layers.new(name="UVMap")
        layer.active_render = True
        for item, coordinate in zip(layer.data, ((0, 0), (1, 0), (1, 1), (0, 1))):
            item.uv = coordinate
    bpy.context.view_layer.update()


def _triangle_area(points):
    first, second, third = points
    return abs(
        (second[0] - first[0]) * (third[1] - first[1])
        - (second[1] - first[1]) * (third[0] - first[0])
    ) / 2


def _positive_projection_overlap(first, second, epsilon=1e-12):
    for triangle in (first, second):
        for index, point in enumerate(triangle):
            next_point = triangle[(index + 1) % 3]
            axis = (-(next_point[1] - point[1]), next_point[0] - point[0])
            first_projection = [value[0] * axis[0] + value[1] * axis[1] for value in first]
            second_projection = [value[0] * axis[0] + value[1] * axis[1] for value in second]
            if max(first_projection) <= min(second_projection) + epsilon:
                return False
            if max(second_projection) <= min(first_projection) + epsilon:
                return False
    return True


def detect_uv_issues(obj):
    if obj.type != "MESH":
        return ("not-a-mesh",)
    mesh = obj.data
    layer = mesh.uv_layers.get("UVMap")
    if layer is None:
        return ("missing-uvmap",)
    issues = []
    if not layer.active_render:
        issues.append("inactive-render-layer")
    coordinates = [tuple(item.uv) for item in layer.data]
    if any(not math.isfinite(value) for coordinate in coordinates for value in coordinate):
        issues.append("non-finite")
    if any(value < 0.0 or value > 1.0 for coordinate in coordinates for value in coordinate if math.isfinite(value)):
        issues.append("out-of-range")

    mesh.calc_loop_triangles()
    triangles = [tuple(coordinates[index] for index in item.loops) for item in mesh.loop_triangles]
    if any(_triangle_area(triangle) <= 1e-12 for triangle in triangles):
        issues.append("degenerate-triangle")

    buckets = {}
    for triangle_index, triangle in enumerate(triangles):
        minimum_x = max(0, min(63, int(min(point[0] for point in triangle) * 64)))
        maximum_x = max(0, min(63, int(max(point[0] for point in triangle) * 64)))
        minimum_y = max(0, min(63, int(min(point[1] for point in triangle) * 64)))
        maximum_y = max(0, min(63, int(max(point[1] for point in triangle) * 64)))
        for x in range(minimum_x, maximum_x + 1):
            for y in range(minimum_y, maximum_y + 1):
                buckets.setdefault((x, y), []).append(triangle_index)
    pairs = set()
    for indices in buckets.values():
        for first_position, first_index in enumerate(indices):
            for second_index in indices[first_position + 1 :]:
                pairs.add((min(first_index, second_index), max(first_index, second_index)))
    for first_index, second_index in pairs:
        if _positive_projection_overlap(triangles[first_index], triangles[second_index]):
            issues.append("triangle-overlap")
            break
    return tuple(dict.fromkeys(issues))


def first_family_uv_overlap(objects):
    buckets = {}
    for obj in sorted(objects, key=lambda item: item.name):
        mesh = obj.data
        mesh_pointer = mesh.as_pointer()
        layer = mesh.uv_layers["UVMap"]
        mesh.calc_loop_triangles()
        for triangle in mesh.loop_triangles:
            points = tuple(tuple(layer.data[index].uv) for index in triangle.loops)
            minimum_x = max(0, min(63, int(min(point[0] for point in points) * 64)))
            maximum_x = max(0, min(63, int(max(point[0] for point in points) * 64)))
            minimum_y = max(0, min(63, int(min(point[1] for point in points) * 64)))
            maximum_y = max(0, min(63, int(max(point[1] for point in points) * 64)))
            keys = tuple(
                (x, y)
                for x in range(minimum_x, maximum_x + 1)
                for y in range(minimum_y, maximum_y + 1)
            )
            seen = set()
            for key in keys:
                for other_name, other_pointer, other_points in buckets.get(key, ()):
                    token = (other_name, other_points)
                    if token in seen or other_pointer == mesh_pointer:
                        continue
                    seen.add(token)
                    if _positive_projection_overlap(other_points, points):
                        return other_name, obj.name
            for key in keys:
                buckets.setdefault(key, []).append((obj.name, mesh_pointer, points))
    return None


def _update_material_contract(contract_path, families):
    contract_path = Path(contract_path)
    source = contract_path.read_text(encoding="utf-8")
    json.loads(source)
    runtime_textures = {
        "schemaVersion": 2,
        "channels": {
            "baseColor": "sRGB RGB",
            "orm": "Non-Color RGB: AO=R, roughness=G, metallic=B",
            "normal": "Non-Color RGB tangent-space",
        },
        "atlasPolicy": {
            "uvSourceMaster": "assets/daliuren/source/daliuren-artifact-master.blend",
            "uvAuthoringVersion": "blender-4.5.12/task4-native-atlas-v3",
            "ownership": "every physical mesh carries runtime_texture_family, runtime_atlas_id and runtime_atlas_class",
            "partitioning": "material-family atlases are explicitly partitioned by hero/moving surface class; two complex self-overlap risks use named object partitions",
            "lod0": "4096x4096 hero atlases; 2048x2048 moving atlases",
            "lod2": "deterministic 2x2 box-filter downsample of LOD0",
            "bakeEngine": "Blender 4.5.12 native Cycles",
            "padding": "8 pixels at LOD0; 4 pixels after LOD2 downsample",
            "coverage": "all triangles above 2e-7 m2 require native texel coverage; smaller microfaces use physical family defaults",
            "rebakeDeterminism": "frozen artifact file hashes are authoritative; independent probes require exact UV and simple-atlas hashes plus full-atlas bounded complex Cycles variance (at most 1024 edge texels; representative interior texels remain within one byte)",
            "opaqueAlpha": "omitted",
            "emissive": "omitted because no runtime highlight assignment consumes it",
        },
        "dynamicLabels": {
            "count": 21,
            "placeholderMaterial": "M_DynamicLabelPlaceholder",
            "ids": list(DYNAMIC_LABEL_OWNERS),
            "owners": copy.deepcopy(DYNAMIC_LABEL_OWNERS),
            "courseValuePolicy": {
                "scope": "dynamic-label-payload-and-bake-inputs-only",
                "scanTargets": [
                    "21 dynamic label surfaces",
                    "runtime dynamic label payload fields",
                ],
                "fields": {
                    field: list(values)
                    for field, values in DYNAMIC_COURSE_VALUES_BY_FIELD.items()
                },
                "fixedInscriptionPolicy": "fixed Task 1 inscriptions remain legal, including twelve earth branches and 胜光",
            },
            "contentRule": "blank geometry only; all course text is supplied at runtime",
        },
        "families": families,
    }
    marker = '\n  "runtimeTextures": '
    if marker in source:
        body = source.split(marker, 1)[0].rstrip()
        if not body.endswith(","):
            raise ValueError("runtimeTextures must be the final material-contract property")
        body = body[:-1].rstrip()
    else:
        body = source.rstrip()
        if not body.endswith("}"):
            raise ValueError("Invalid material contract")
        body = body[:-1].rstrip()
    runtime_json = json.dumps(runtime_textures, ensure_ascii=False, indent=2).replace("\n", "\n  ")
    contract_path.write_text(
        f'{body},\n  "runtimeTextures": {runtime_json}\n}}\n',
        encoding="utf-8",
    )


def prepare_runtime_assets(root, texture_root=DEFAULT_TEXTURE_ROOT, contract_path=DEFAULT_CONTRACT_PATH):
    if root.get("node_id") != "artifact/root":
        raise ValueError("Runtime UV preparation requires artifact/root")
    if root.get("uv_bake_complete") or any(obj.get("dynamic_label_id") for obj in bpy.data.objects):
        raise RuntimeError("Runtime UV assets are already prepared")
    if bpy.data.materials.get("M_DynamicLabelPlaceholder") is not None:
        raise RuntimeError("Runtime UV assets are already prepared")

    surfaces = _add_dynamic_surfaces()
    assign_primary_uvs(surfaces)
    for obj in bpy.data.objects:
        if obj.type != "MESH" or obj.get("dynamic_label_id"):
            continue
        family = obj.get("material_role")
        if family not in MATERIAL_FAMILIES:
            raise RuntimeError(f"Missing runtime material family on {obj.name}")
        obj["runtime_texture_family"] = family
    families = generate_runtime_textures(texture_root)
    _update_material_contract(contract_path, families)
    root["uv_bake_complete"] = True
    root["runtime_texture_contract"] = "assets/daliuren/materials/material-contract.json#runtimeTextures"
    bpy.context.view_layer.update()
    return surfaces


def parse_args(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("--texture-root", type=Path, default=DEFAULT_TEXTURE_ROOT)
    parser.add_argument("--contract", type=Path, default=DEFAULT_CONTRACT_PATH)
    parser.add_argument("--save-master", type=Path, default=DEFAULT_MASTER_PATH)
    return parser.parse_args(argv)


def main():
    sys.path.insert(0, str(Path(__file__).parent))
    from build_graybox import build_master

    args = parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])
    root = build_master()
    prepare_runtime_assets(root, args.texture_root.resolve(), args.contract.resolve())
    master_path = args.save_master.resolve()
    master_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(master_path))
    print(f"Saved UV/baked master: {master_path}")


if __name__ == "__main__":
    main()
