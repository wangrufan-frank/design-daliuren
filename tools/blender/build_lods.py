import json
from pathlib import Path

import bpy

from build_graybox import build_master
from daliuren_contract import BRANCH_INLAY_NODE_IDS, NODE_IDS
from materials import srgb_hex
from uv_and_bake import DYNAMIC_LABEL_OWNERS, _add_dynamic_surfaces, assign_primary_uvs

REPOSITORY_ROOT = Path(__file__).parents[2]
MATERIAL_CONTRACT_PATH = REPOSITORY_ROOT / "assets/daliuren/materials/material-contract.json"
TEXTURE_ROOT = REPOSITORY_ROOT / "assets/daliuren/textures"
OUTER_BOARD_ALBEDO_PATH = TEXTURE_ROOT / "source/outer-board-v10-albedo.png"
OUTER_BOARD_NORMAL_PATH = TEXTURE_ROOT / "source/outer-board-v10-normal.png"
SOURCE_MARKER = "daliuren_lod_source"
LEGACY_EXPORT_MATERIALS = ("M_EarthVoid", "M_HeavenVoid")


def _source_objects():
    source = tuple(obj for obj in bpy.context.scene.objects if obj.get(SOURCE_MARKER))
    if source:
        return source

    runtime_ids = {
        obj["node_id"]
        for obj in bpy.context.scene.objects
        if obj.get("node_id")
    }
    dynamic_ids = {
        obj["dynamic_label_id"]
        for obj in bpy.context.scene.objects
        if obj.get("dynamic_label_id")
    }
    if runtime_ids != set(NODE_IDS) or dynamic_ids != set(DYNAMIC_LABEL_OWNERS):
        build_master()
        surfaces = _add_dynamic_surfaces()
        assign_primary_uvs(surfaces)
    source = tuple(bpy.context.scene.objects)
    for obj in source:
        obj[SOURCE_MARKER] = True
    return source


def _duplicate_collection(level):
    source = _source_objects()
    source_world = {obj: obj.matrix_world.copy() for obj in source}
    collection = bpy.data.collections.new(f"daliuren-artifact-lod{level}")
    collection["lod_level"] = level
    bpy.context.scene.collection.children.link(collection)

    copies = {}
    for obj in source:
        if (
            obj.get("surface_treatment") in {"rear-slip-seat", "shallow-slot"}
            or obj.get("role") == "fixed-historical-inscription"
        ):
            continue
        duplicate = obj.copy()
        if obj.data is not None:
            duplicate.data = obj.data.copy()
        duplicate.name = f"lod{level}/{obj.name}"
        duplicate.pop(SOURCE_MARKER, None)
        duplicate["lod_level"] = level
        collection.objects.link(duplicate)
        copies[obj] = duplicate

    def hierarchy_depth(obj):
        depth = 0
        while obj.parent is not None:
            depth += 1
            obj = obj.parent
        return depth

    for source_obj, duplicate in sorted(copies.items(), key=lambda item: hierarchy_depth(item[0])):
        parent = copies.get(source_obj.parent)
        duplicate.parent = parent
        duplicate.matrix_parent_inverse.identity()
        duplicate.matrix_basis = (
            parent.matrix_world.inverted() @ source_world[source_obj]
            if parent is not None
            else source_world[source_obj]
        )
    return collection


def _set_bevel_segments(obj, segments):
    for modifier in obj.modifiers:
        if modifier.type == "BEVEL":
            modifier.segments = min(modifier.segments, segments)


def _decimate(obj, ratio):
    if obj.type != "MESH" or len(obj.data.loop_triangles) < 100:
        return
    modifier = obj.modifiers.new(name="LOD triangle reduction", type="DECIMATE")
    modifier.ratio = ratio
    modifier.use_collapse_triangulate = True


def _reduce_lod(collection, level):
    for obj in collection.all_objects:
        if obj.type != "MESH" or obj.get("dynamic_label_id"):
            continue

        if level == 1:
            _set_bevel_segments(obj, 2)
        else:
            _set_bevel_segments(obj, 1)

        inscription_role = obj.get("inscription_role")
        if inscription_role:
            if level == 2 and inscription_role.startswith("historical-"):
                _decimate(obj, 0.25)
            continue

        if level == 2 and obj.get("visual_role") == "zodiac-glyph":
            _decimate(obj, 0.04)
            continue
        if level == 2 and (obj.get("visual_role") or obj.get("detail_id")):
            _decimate(obj, 0.35)

        if level == 1:
            if obj.get("node_id"):
                _decimate(obj, 0.65)
        elif obj.get("node_id"):
            _decimate(obj, 0.25)


def _gltf_material_output_group():
    group = bpy.data.node_groups.get("glTF Material Output")
    if group is None:
        group = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
        group.interface.new_socket(
            name="Occlusion",
            in_out="INPUT",
            socket_type="NodeSocketFloat",
        )
    return group


def _runtime_material(atlas_id, family, texture_lod, atlas):
    name = f"RT_{texture_lod}_{atlas_id.replace(':', '_')}"
    material = bpy.data.materials.get(name)
    if material is not None:
        return material

    material = bpy.data.materials.new(name)
    material["material_family"] = family
    material["runtime_atlas_id"] = atlas_id
    material["runtime_texture_lod"] = texture_lod
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    links = material.node_tree.links

    output = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    links.new(principled.outputs["BSDF"], output.inputs["Surface"])

    images = {}
    for role in ("baseColor", "orm", "normal"):
        record = atlas[texture_lod][role]
        path = TEXTURE_ROOT / record["file"]
        image = bpy.data.images.load(str(path), check_existing=True)
        image.colorspace_settings.name = "sRGB" if role == "baseColor" else "Non-Color"
        node = nodes.new("ShaderNodeTexImage")
        node.name = role
        node.label = role
        node.image = image
        images[role] = node

    links.new(images["baseColor"].outputs["Color"], principled.inputs["Base Color"])
    orm = nodes.new("ShaderNodeSeparateColor")
    links.new(images["orm"].outputs["Color"], orm.inputs["Color"])
    links.new(orm.outputs["Green"], principled.inputs["Roughness"])
    links.new(orm.outputs["Blue"], principled.inputs["Metallic"])

    normal = nodes.new("ShaderNodeNormalMap")
    links.new(images["normal"].outputs["Color"], normal.inputs["Color"])
    links.new(normal.outputs["Normal"], principled.inputs["Normal"])

    gltf_output = nodes.new("ShaderNodeGroup")
    gltf_output.node_tree = _gltf_material_output_group()
    links.new(orm.outputs["Red"], gltf_output.inputs["Occlusion"])
    return material


def _outer_board_runtime_material():
    name = "RT_M_JadeBody_outer_board_v10"
    material = bpy.data.materials.get(name)
    if material is not None:
        return material

    material = bpy.data.materials.new(name)
    material["material_family"] = "M_JadeBody"
    material["runtime_projection"] = "outer-board-v10"
    material["source_texture"] = OUTER_BOARD_ALBEDO_PATH.relative_to(REPOSITORY_ROOT).as_posix()
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    links = material.node_tree.links

    output = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.inputs["Metallic"].default_value = 0.0
    principled.inputs["Roughness"].default_value = 0.31
    links.new(principled.outputs["BSDF"], output.inputs["Surface"])

    albedo_image = bpy.data.images.load(str(OUTER_BOARD_ALBEDO_PATH), check_existing=True)
    albedo_image.colorspace_settings.name = "sRGB"
    albedo = nodes.new("ShaderNodeTexImage")
    albedo.name = "Outer board v10 albedo"
    albedo.image = albedo_image
    normal_image = bpy.data.images.load(str(OUTER_BOARD_NORMAL_PATH), check_existing=True)
    normal_image.colorspace_settings.name = "Non-Color"
    normal_texture = nodes.new("ShaderNodeTexImage")
    normal_texture.name = "Outer board v10 normal"
    normal_texture.image = normal_image
    coordinates = nodes.new("ShaderNodeUVMap")
    coordinates.uv_map = "BoardUV"
    normal = nodes.new("ShaderNodeNormalMap")
    normal.inputs["Strength"].default_value = 0.24
    links.new(coordinates.outputs["UV"], albedo.inputs["Vector"])
    links.new(coordinates.outputs["UV"], normal_texture.inputs["Vector"])
    links.new(albedo.outputs["Color"], principled.inputs["Base Color"])
    links.new(normal_texture.outputs["Color"], normal.inputs["Color"])
    links.new(normal.outputs["Normal"], principled.inputs["Normal"])
    return material


def _uniform_jade_runtime_material():
    name = "RT_M_JadeBody_uniform"
    material = bpy.data.materials.get(name)
    if material is not None:
        return material

    material = bpy.data.materials.new(name)
    material["material_family"] = "M_JadeBody"
    material["runtime_projection"] = "uniform-jade"
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    links = material.node_tree.links

    output = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.inputs["Base Color"].default_value = srgb_hex("#F0EADD")
    principled.inputs["Metallic"].default_value = 0.0
    principled.inputs["Roughness"].default_value = 0.27
    if "Specular IOR Level" in principled.inputs:
        principled.inputs["Specular IOR Level"].default_value = 0.34
    links.new(principled.outputs["BSDF"], output.inputs["Surface"])
    return material


def _uses_uniform_jade(obj):
    source_name = obj.name.removeprefix(f"lod{obj.get('lod_level')}/")
    return (
        obj.get("node_id") in {"base/body", "plate/heaven", "plate/core"}
        or source_name in {
            "detail/heaven/dial-foundation",
            "detail/heaven/linked-ring-1",
            "detail/heaven/linked-ring-2",
        }
        or obj.get("visual_role") in {"corner-pearl", "jade-pivot"}
    )


def _assign_outer_board_uv(obj, board):
    layer = obj.data.uv_layers.get("BoardUV") or obj.data.uv_layers.new(name="BoardUV")
    board_inverse = board.matrix_world.inverted()
    for loop in obj.data.loops:
        point = board_inverse @ (obj.matrix_world @ obj.data.vertices[loop.vertex_index].co)
        layer.data[loop.index].uv = (2.0 * point.x + 0.5, 2.0 * point.y + 0.5)
    layer.active_render = True


def _bind_runtime_textures(collection, level):
    contract = json.loads(MATERIAL_CONTRACT_PATH.read_text(encoding="utf-8"))
    runtime = contract["runtimeTextures"]
    texture_lod = "lod2" if level == 2 else "lod0"
    materials = {}
    board = next(obj for obj in collection.all_objects if obj.get("node_id") == "plate/earth")
    outer_board_material = _outer_board_runtime_material()
    uniform_jade_material = _uniform_jade_runtime_material()
    for obj in collection.all_objects:
        if obj.type != "MESH" or obj.get("dynamic_label_id"):
            continue
        if obj.get("node_id") == "interaction/month-general-ring" or obj.get("inscription_role") or obj.get("text_role") in {"general-name", "month-general"}:
            continue
        if obj.get("node_id") == "plate/earth":
            _assign_outer_board_uv(obj, board)
            obj["runtime_projection"] = "outer-board-v10"
            obj.data.materials.clear()
            obj.data.materials.append(outer_board_material)
            continue
        family = obj["runtime_texture_family"]
        if family == "M_TranslucentJade":
            continue
        if _uses_uniform_jade(obj):
            obj["runtime_projection"] = "uniform-jade"
            obj.data.materials.clear()
            obj.data.materials.append(uniform_jade_material)
            continue
        atlas_id = obj["runtime_atlas_id"]
        atlas = runtime["families"][family]["atlases"][atlas_id]
        material = materials.setdefault(
            atlas_id,
            _runtime_material(atlas_id, family, texture_lod, atlas),
        )
        obj.data.materials.clear()
        obj.data.materials.append(material)


def _remove_legacy_export_materials():
    for name in LEGACY_EXPORT_MATERIALS:
        material = bpy.data.materials.get(name)
        if material is not None:
            bpy.data.materials.remove(material)


def build_lod(level: int) -> bpy.types.Collection:
    if level not in {0, 1, 2}:
        raise ValueError(f"LOD level must be 0, 1 or 2, got {level}")
    collection = _duplicate_collection(level)
    bpy.context.view_layer.update()
    if level:
        _reduce_lod(collection, level)
    _bind_runtime_textures(collection, level)
    _remove_legacy_export_materials()
    bpy.context.view_layer.update()
    return collection
