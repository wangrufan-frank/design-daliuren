import argparse
import copy
import hashlib
import json
import math
import struct
import sys
import zlib
from pathlib import Path

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
FORBIDDEN_COURSE_VALUES = (
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
    "一课",
    "二课",
    "三课",
    "四课",
    "庚申",
)

FAMILY_BASE_RGB = {
    "M_Bronze": (38, 50, 47),
    "M_Patina": (67, 92, 83),
    "M_Celadon": (135, 155, 146),
    "M_OldGold": (128, 112, 76),
    "M_AshText": (194, 198, 187),
}
FAMILY_ORM = {
    "M_Bronze": (210, 148, 245),
    "M_Patina": (196, 184, 238),
    "M_Celadon": (232, 87, 0),
    "M_OldGold": (224, 97, 250),
    "M_AshText": (238, 173, 0),
}
FAMILY_SEEDS = {name: index for index, name in enumerate(MATERIAL_FAMILIES)}


def _chunk(kind, payload):
    return (
        struct.pack(">I", len(payload))
        + kind
        + payload
        + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)
    )


def _clamp_byte(value):
    return max(0, min(255, int(value)))


def _base_color_pixel(family, x, y):
    seed = FAMILY_SEEDS[family]
    coarse = ((x // 64) + 3 * (y // 64) + seed) % 9 - 4
    grain = 0 if x % 64 == 0 or y % 64 == 0 else ((x % 17) * (y % 19)) % 5 - 2
    return tuple(_clamp_byte(channel + coarse + grain) for channel in FAMILY_BASE_RGB[family])


def _orm_pixel(family, x, y):
    ao, roughness, metallic = FAMILY_ORM[family]
    x_block = x // 64
    y_block = y // 64
    fine = 0 if x % 64 == 0 or y % 64 == 0 else ((x % 13) + 2 * (y % 11)) % 3
    return (
        _clamp_byte(ao - ((x_block + y_block) % 5) - fine),
        _clamp_byte(roughness + ((2 * x_block + y_block) % 7) + fine),
        _clamp_byte(metallic - ((x_block + 3 * y_block) % 4)),
    )


def _normal_pixel(family, x, y):
    x_block = x // 64
    y_block = y // 64
    if x_block == 0 and y_block == 0:
        return 128, 128, 255
    seed = FAMILY_SEEDS[family]
    nx = ((3 * x_block + 5 * y_block + seed) % 9) - 4
    ny = ((7 * x_block + 2 * y_block + 2 * seed) % 9) - 4
    nz = math.sqrt(max(0.0, 1.0 - (nx / 127.0) ** 2 - (ny / 127.0) ** 2))
    return 128 + nx, 128 + ny, _clamp_byte(128 + 127 * nz)


def _write_rgb_png(path, dimension, pixel_function, srgb=False):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    compressor = zlib.compressobj(level=9)
    compressed = []
    for y in range(dimension):
        row = bytearray(1 + dimension * 3)
        for x in range(dimension):
            offset = 1 + x * 3
            row[offset : offset + 3] = bytes(pixel_function(x, y))
        block = compressor.compress(row)
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


def generate_runtime_textures(texture_root):
    texture_root = Path(texture_root)
    result = {}
    for family in MATERIAL_FAMILIES:
        family_result = {"assignment": f"objects whose material_role is {family}"}
        for lod, dimension in (("lod0", 2048), ("lod2", 1024)):
            maps = {}
            for role, suffix, colorspace, pixel_function in (
                (
                    "baseColor",
                    "basecolor",
                    "sRGB",
                    lambda x, y, current=family: _base_color_pixel(current, x, y),
                ),
                (
                    "orm",
                    "orm",
                    "Non-Color",
                    lambda x, y, current=family: _orm_pixel(current, x, y),
                ),
                (
                    "normal",
                    "normal",
                    "Non-Color",
                    lambda x, y, current=family: _normal_pixel(current, x, y),
                ),
            ):
                relative = Path(lod) / f"{_slug(family)}-{suffix}.png"
                path = texture_root / relative
                _write_rgb_png(path, dimension, pixel_function, srgb=role == "baseColor")
                maps[role] = {
                    "file": relative.as_posix(),
                    "dimensions": [dimension, dimension],
                    "channels": "RGB",
                    "colorSpace": colorspace,
                    "sha256": _sha256(path),
                }
            family_result[lod] = maps
        result[family] = family_result
    return result


def _dynamic_surface_spec(dynamic_id):
    if dynamic_id == "dynamic/calendar":
        return (0.124, 0.007), (0.0, -0.002, 0.0081)
    if dynamic_id.startswith("dynamic/lesson/"):
        return (0.052, 0.012), (0.0, 0.0, 0.0071)
    if dynamic_id == "dynamic/transmission/method":
        return (0.090, 0.004), (0.0, 0.0215, 0.0041)
    if dynamic_id.startswith("dynamic/transmission/"):
        return (0.044, 0.014), (0.0, 0.0, 0.0051)
    return (0.016, 0.010), (0.0, 0.0, 0.0071)


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


def _assign_mesh_uv(mesh):
    while mesh.uv_layers:
        mesh.uv_layers.remove(mesh.uv_layers[0])
    layer = mesh.uv_layers.new(name="UVMap")
    layer.active_render = True
    polygon_count = len(mesh.polygons)
    if polygon_count == 0:
        return
    grid = math.ceil(math.sqrt(polygon_count))
    cell = 1.0 / grid
    radius = cell * 0.36
    for polygon in mesh.polygons:
        column = polygon.index % grid
        row = polygon.index // grid
        center_x = (column + 0.5) * cell
        center_y = (row + 0.5) * cell
        loop_count = polygon.loop_total
        for local_index, loop_index in enumerate(polygon.loop_indices):
            angle = -math.pi / 2 + local_index * 2 * math.pi / loop_count
            layer.data[loop_index].uv = (
                center_x + radius * math.cos(angle),
                center_y + radius * math.sin(angle),
            )


def assign_primary_uvs(dynamic_surfaces):
    dynamic_meshes = {obj.data.as_pointer(): obj for obj in dynamic_surfaces}
    processed = set()
    for obj in sorted((item for item in bpy.data.objects if item.type == "MESH"), key=lambda item: item.name):
        pointer = obj.data.as_pointer()
        if pointer in processed:
            continue
        processed.add(pointer)
        _assign_mesh_uv(obj.data)
        if pointer in dynamic_meshes:
            layer = obj.data.uv_layers["UVMap"]
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


def _update_material_contract(contract_path, families):
    contract_path = Path(contract_path)
    source = contract_path.read_text(encoding="utf-8")
    json.loads(source)
    runtime_textures = {
        "schemaVersion": 1,
        "channels": {
            "baseColor": "sRGB RGB",
            "orm": "Non-Color RGB: AO=R, roughness=G, metallic=B",
            "normal": "Non-Color RGB tangent-space",
        },
        "atlasPolicy": {
            "lod0": "2048x2048 per physical material family",
            "lod2": "1024x1024 per physical material family",
            "opaqueAlpha": "omitted",
            "emissive": "omitted because no runtime highlight assignment consumes it",
        },
        "dynamicLabels": {
            "count": 21,
            "placeholderMaterial": "M_DynamicLabelPlaceholder",
            "ids": list(DYNAMIC_LABEL_OWNERS),
            "owners": copy.deepcopy(DYNAMIC_LABEL_OWNERS),
            "forbiddenCourseValues": list(FORBIDDEN_COURSE_VALUES),
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
