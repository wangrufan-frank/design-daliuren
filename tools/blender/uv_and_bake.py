import argparse
import copy
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
    for y in range(dimension):
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


def _principled(material):
    nodes = [node for node in material.node_tree.nodes if node.bl_idname == "ShaderNodeBsdfPrincipled"]
    if len(nodes) != 1:
        raise RuntimeError(f"{material.name} requires one Principled shader for baking")
    return nodes[0]


def _material_parameters(family):
    material = bpy.data.materials[family]
    shader = _principled(material)
    parameters = {
        "base": tuple(shader.inputs["Base Color"].default_value[:3]),
        "metallic": float(shader.inputs["Metallic"].default_value),
        "roughness": float(shader.inputs["Roughness"].default_value),
    }
    nodes = material.node_tree.nodes
    if family == "M_Bronze":
        parameters.update({
            "contact_strength": float(nodes["Causal contact polish"].inputs["Strength"].default_value),
            "recess_strength": float(nodes["Causal recess tint"].inputs["Strength"].default_value),
            "patina": tuple(nodes["Bronze to recessed patina"].inputs[2].default_value[:3]),
            "rough_min": float(nodes["Contact-polished roughness"].inputs["To Min"].default_value),
            "rough_max": float(nodes["Contact-polished roughness"].inputs["To Max"].default_value),
        })
    elif family == "M_Patina":
        parameters.update({
            "recess_strength": float(nodes["Causal oxidation coverage"].inputs["Strength"].default_value),
            "rough_min": float(nodes["Oxidation roughness"].inputs["To Min"].default_value),
            "rough_max": float(nodes["Oxidation roughness"].inputs["To Max"].default_value),
        })
    elif family == "M_Celadon":
        parameters.update({
            "dirt_strength": float(nodes["Causal insert-boundary dirt"].inputs["Strength"].default_value),
            "crackle_strength": float(nodes["Celadon-only crackle"].inputs["Strength"].default_value),
            "patina": tuple(nodes["Boundary dirt tint"].inputs[2].default_value[:3]),
            "crackle_tint": float(nodes["Restrained crackle tint"].inputs[1].default_value),
            "rough_min": float(nodes["Crackle roughness response"].inputs["To Min"].default_value),
            "rough_max": float(nodes["Crackle roughness response"].inputs["To Max"].default_value),
            "orange_scale": float(nodes["Glaze orange peel"].inputs["Scale"].default_value),
            "orange_detail": float(nodes["Glaze orange peel"].inputs["Detail"].default_value),
            "orange_roughness": float(nodes["Glaze orange peel"].inputs["Roughness"].default_value),
            "normal_strength": float(nodes["Restrained glaze micro-normal"].inputs["Strength"].default_value),
            "crackle_normal_strength": float(nodes["Shallow crackle groove"].inputs["Strength"].default_value),
        })
    return parameters


def _attribute_values(mesh, triangle, name):
    attribute = mesh.attributes.get(name)
    if attribute is None:
        return (0.0, 0.0, 0.0)
    if attribute.domain == "FACE":
        value = float(attribute.data[triangle.polygon_index].value)
        return (value, value, value)
    if attribute.domain == "POINT":
        return tuple(float(attribute.data[index].value) for index in triangle.vertices)
    raise RuntimeError(f"Unsupported {name} domain on {mesh.name}: {attribute.domain}")


def _interpolate(values, weights):
    return sum(value * weight for value, weight in zip(values, weights))


def _mix(first, second, factor):
    factor = max(0.0, min(1.0, factor))
    return tuple(a + (b - a) * factor for a, b in zip(first, second))


def _shade_texel(family, parameters, source, weights):
    contact = _interpolate(source["contact"], weights)
    recess = _interpolate(source["recess"], weights)
    boundary = _interpolate(source["boundary"], weights)
    crackle = _interpolate(source["crackle"], weights)
    phase = _interpolate(source["phase"], weights)
    generated = tuple(
        _interpolate(tuple(value[index] for value in source["generated"]), weights)
        for index in range(3)
    )

    base = parameters["base"]
    roughness = parameters["roughness"]
    ao = 0.90 + 0.10 * abs(source["normal_z"])
    normal = (0.0, 0.0, 1.0)
    if family == "M_Bronze":
        contact = max(0.0, min(1.0, contact * parameters["contact_strength"]))
        recess = max(0.0, min(1.0, recess * parameters["recess_strength"]))
        base = _mix(base, parameters["patina"], recess)
        roughness = parameters["rough_min"] + (parameters["rough_max"] - parameters["rough_min"]) * contact
        ao *= 1.0 - 0.20 * recess
    elif family == "M_Patina":
        recess = max(0.0, min(1.0, recess * parameters["recess_strength"]))
        roughness = parameters["rough_min"] + (parameters["rough_max"] - parameters["rough_min"]) * recess
        ao *= 1.0 - 0.15 * recess
    elif family == "M_Celadon":
        boundary = max(0.0, min(1.0, boundary * parameters["dirt_strength"]))
        crackle = max(0.0, min(1.0, crackle * parameters["crackle_strength"]))
        tint = min(1.0, boundary + crackle * parameters["crackle_tint"])
        base = _mix(base, parameters["patina"], tint)
        roughness = parameters["rough_min"] + (parameters["rough_max"] - parameters["rough_min"]) * crackle
        ao *= 1.0 - 0.12 * boundary - 0.04 * crackle
        scale = parameters["orange_scale"]
        detail = 1.0 + 0.05 * parameters["orange_detail"]
        attenuation = 1.0 - 0.10 * parameters["orange_roughness"]
        amplitude = parameters["normal_strength"] * detail * attenuation
        gx, gy, gz = generated
        phase_angle = phase * math.tau
        nx = amplitude * math.sin(scale * (gx + 0.37 * gy) + phase_angle)
        ny = amplitude * math.sin(scale * (gy + 0.31 * gz) - phase_angle)
        nx += parameters["crackle_normal_strength"] * (source["crackle"][1] - source["crackle"][0])
        ny += parameters["crackle_normal_strength"] * (source["crackle"][2] - source["crackle"][0])
        length = math.sqrt(nx * nx + ny * ny + 1.0)
        normal = (nx / length, ny / length, 1.0 / length)

    return (
        _rgb_bytes(base),
        (
            _clamp_byte(ao * 255.0),
            _clamp_byte(roughness * 255.0),
            _clamp_byte(parameters["metallic"] * 255.0),
        ),
        tuple(_clamp_byte(128.0 + value * 127.0) for value in normal),
    )


def _family_buffers(family, dimension):
    parameters = _material_parameters(family)
    pixel_count = dimension * dimension
    base_default = bytes(_rgb_bytes(parameters["base"]))
    orm_default = bytes((255, _clamp_byte(parameters["roughness"] * 255.0), _clamp_byte(parameters["metallic"] * 255.0)))
    base = bytearray(base_default * pixel_count)
    orm = bytearray(orm_default * pixel_count)
    normal = bytearray(bytes((128, 128, 255)) * pixel_count)
    objects = {}
    for obj in sorted((item for item in bpy.data.objects if item.type == "MESH"), key=lambda item: item.name):
        if obj.get("runtime_texture_family") == family:
            objects.setdefault(obj.data.as_pointer(), obj)

    for obj in objects.values():
        mesh = obj.data
        layer = mesh.uv_layers["UVMap"]
        coordinates = [vertex.co.copy() for vertex in mesh.vertices]
        minimum = tuple(min(value[index] for value in coordinates) for index in range(3))
        maximum = tuple(max(value[index] for value in coordinates) for index in range(3))
        generated = []
        for coordinate in coordinates:
            generated.append(tuple(
                0.5 if maximum[index] - minimum[index] <= 1e-12 else (coordinate[index] - minimum[index]) / (maximum[index] - minimum[index])
                for index in range(3)
            ))
        mesh.calc_loop_triangles()
        for triangle in mesh.loop_triangles:
            uv = tuple(tuple(layer.data[index].uv) for index in triangle.loops)
            denominator = (
                (uv[1][1] - uv[2][1]) * (uv[0][0] - uv[2][0])
                + (uv[2][0] - uv[1][0]) * (uv[0][1] - uv[2][1])
            )
            if abs(denominator) <= 1e-16:
                continue
            source = {
                "contact": _attribute_values(mesh, triangle, "causal_contact_wear"),
                "recess": _attribute_values(mesh, triangle, "causal_recess_oxidation"),
                "boundary": _attribute_values(mesh, triangle, "causal_insert_boundary"),
                "crackle": _attribute_values(mesh, triangle, "causal_celadon_crackle"),
                "phase": _attribute_values(mesh, triangle, "dirt_phase"),
                "generated": tuple(generated[index] for index in triangle.vertices),
                "normal_z": float(triangle.normal.z),
            }
            minimum_x = max(0, int(math.floor(min(value[0] for value in uv) * dimension)))
            maximum_x = min(dimension, int(math.ceil(max(value[0] for value in uv) * dimension)))
            minimum_y = max(0, int(math.floor(min(value[1] for value in uv) * dimension)))
            maximum_y = min(dimension, int(math.ceil(max(value[1] for value in uv) * dimension)))
            for y in range(minimum_y, maximum_y):
                v = (y + 0.5) / dimension
                for x in range(minimum_x, maximum_x):
                    u = (x + 0.5) / dimension
                    first = ((uv[1][1] - uv[2][1]) * (u - uv[2][0]) + (uv[2][0] - uv[1][0]) * (v - uv[2][1])) / denominator
                    second = ((uv[2][1] - uv[0][1]) * (u - uv[2][0]) + (uv[0][0] - uv[2][0]) * (v - uv[2][1])) / denominator
                    third = 1.0 - first - second
                    if min(first, second, third) < -1e-9:
                        continue
                    base_pixel, orm_pixel, normal_pixel = _shade_texel(
                        family,
                        parameters,
                        source,
                        (first, second, third),
                    )
                    offset = (y * dimension + x) * 3
                    base[offset : offset + 3] = bytes(base_pixel)
                    orm[offset : offset + 3] = bytes(orm_pixel)
                    normal[offset : offset + 3] = bytes(normal_pixel)
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
    for family in MATERIAL_FAMILIES:
        objects = [obj for obj in physical if obj.get("runtime_texture_family") == family]
        if not objects or any(detect_uv_issues(obj) for obj in objects):
            raise RuntimeError(f"Daliuren master UV atlas is invalid for {family}")
        if first_family_uv_overlap(objects) is not None:
            raise RuntimeError(f"Daliuren master UV atlas overlaps across meshes in {family}")


def generate_runtime_textures(texture_root):
    _validate_bake_source()
    texture_root = Path(texture_root)
    result = {}
    for family in MATERIAL_FAMILIES:
        family_result = {"assignment": f"objects whose material_role is {family}"}
        lod0 = _family_buffers(family, 2048)
        lod_buffers = {
            "lod0": lod0,
            "lod2": {role: _downsample_two_by_two(pixels, 2048) for role, pixels in lod0.items()},
        }
        for lod, dimension in (("lod0", 2048), ("lod2", 1024)):
            maps = {}
            for role, suffix, colorspace in (
                ("baseColor", "basecolor", "sRGB"),
                ("orm", "orm", "Non-Color"),
                ("normal", "normal", "Non-Color"),
            ):
                relative = Path(lod) / f"{_slug(family)}-{suffix}.png"
                path = texture_root / relative
                _write_rgb_png(path, dimension, lod_buffers[lod][role], srgb=role == "baseColor")
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
        edge.seam = len(edge.link_faces) != 2 or edge.calc_face_angle(0.0) > 0.001
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
        margin=0.002,
    )
    bpy.ops.uv.pack_islands(
        udim_source="CLOSEST_UDIM",
        rotate=True,
        scale=True,
        margin=0.002,
        shape_method="AABB",
    )
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.select_set(False)


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


def _smart_unwrap(obj):
    mesh = obj.data
    while mesh.uv_layers:
        mesh.uv_layers.remove(mesh.uv_layers[0])
    mesh.uv_layers.new(name="UVMap").active_render = True
    _select_all_mesh_uvs(obj)
    bpy.ops.uv.smart_project(
        angle_limit=math.radians(0.1),
        margin_method="SCALED",
        rotate_method="AXIS_ALIGNED_Y",
        island_margin=0.008,
        area_weight=0.0,
        correct_aspect=True,
        scale_to_bounds=True,
    )
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.select_set(False)
    smart_coordinates = [tuple(item.uv) for item in mesh.uv_layers["UVMap"].data]
    if detect_uv_issues(obj) or _largest_triangle_shape_error(obj) > 0.08:
        _seam_unwrap(obj)
        if detect_uv_issues(obj):
            for item, coordinate in zip(mesh.uv_layers["UVMap"].data, smart_coordinates):
                item.uv = coordinate


def _place_mesh_in_atlas(mesh, index, grid):
    layer = mesh.uv_layers["UVMap"]
    coordinates = [tuple(item.uv) for item in layer.data]
    minimum_x = min(value[0] for value in coordinates)
    maximum_x = max(value[0] for value in coordinates)
    minimum_y = min(value[1] for value in coordinates)
    maximum_y = max(value[1] for value in coordinates)
    width = maximum_x - minimum_x
    height = maximum_y - minimum_y
    if width <= 1e-12 or height <= 1e-12:
        raise RuntimeError(f"Degenerate unwrap for {mesh.name}")
    cell = 1.0 / grid
    padding = cell * 0.08
    available = cell - 2 * padding
    scale = min(available / width, available / height)
    column = index % grid
    row = index // grid
    offset_x = column * cell + (cell - width * scale) / 2
    offset_y = row * cell + (cell - height * scale) / 2
    for item, (u, v) in zip(layer.data, coordinates):
        item.uv = (
            offset_x + (u - minimum_x) * scale,
            offset_y + (v - minimum_y) * scale,
        )


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
    for family in MATERIAL_FAMILIES:
        representatives = {}
        for obj in sorted((item for item in bpy.data.objects if item.type == "MESH"), key=lambda item: item.name):
            if obj.data.as_pointer() in dynamic_pointers:
                continue
            if obj.get("material_role") != family:
                continue
            representatives.setdefault(obj.data.as_pointer(), obj)
        objects = tuple(representatives.values())
        grid = math.ceil(math.sqrt(len(objects)))
        for index, obj in enumerate(objects):
            _smart_unwrap(obj)
            _place_mesh_in_atlas(obj.data, index, grid)

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
