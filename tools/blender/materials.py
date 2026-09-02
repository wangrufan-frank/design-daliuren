import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


REPOSITORY_ROOT = Path(__file__).parents[2]
MATERIAL_NAMES = (
    "M_JadeBody",
    "M_TranslucentJade",
    "M_JadeRecess",
    "M_InkText",
    "M_CinnabarText",
    "M_OldGold",
)
MASK_NAMES = (
    "mask_contact_wear",
    "mask_recess_oxidation",
    "mask_insert_dirt",
    "mask_jade_microtexture",
)
PALETTE = {
    "ink": "#27231F",
    "jadeBody": "#DCE8E0",
    "jadeInlay": "#C7E5D2",
    "jadeRecess": "#B9C9BE",
    "cinnabar": "#C54A32",
    "oldGold": "#C8953D",
}
MASK_ATTRIBUTES = {
    "mask_contact_wear": "causal_contact_wear",
    "mask_recess_oxidation": "causal_recess_oxidation",
    "mask_insert_dirt": "causal_insert_boundary",
    "mask_jade_microtexture": "causal_jade_microtexture",
}
CONTACT_DETAIL_IDS = {
    "mechanism/heaven-detent",
    "mechanism/lesson-dovetails",
    "mechanism/lesson-end-stop",
    "mechanism/lesson-general-socket",
    "mechanism/bridge-stops",
    "mechanism/general-track",
}
RECESS_DETAIL_IDS = {
    "structure/base-bottom-seam",
    "structure/base-shell-thickness",
    "mechanism/heaven-bearing",
    "structure/bronze-celadon-contact-seam",
    "mechanism/general-track",
}
PATINA_DETAIL_IDS = {
    "structure/base-bottom-seam",
    "structure/base-shell-thickness",
    "structure/bronze-celadon-contact-seam",
}
CELADON_DETAIL_IDS = {"structure/heaven-inlay-bed"}
CONTACT_OBJECTS = {"base/body", "plate/earth", "plate/heaven"}
LESSON_PHASES = {
    "first": 0.11,
    "second": 0.37,
    "third": 0.63,
    "fourth": 0.89,
}


def _linear_channel(value):
    value /= 255.0
    if value <= 0.04045:
        return value / 12.92
    return ((value + 0.055) / 1.055) ** 2.4


def srgb_hex(value):
    return (*(_linear_channel(int(value[index : index + 2], 16)) for index in (1, 3, 5)), 1.0)


def _socket(node, name):
    socket = node.inputs.get(name)
    if socket is None:
        raise RuntimeError(f"Blender {bpy.app.version_string} lacks {node.name}.{name}")
    return socket


def _new_group(name, semantic, output_name="Factor"):
    group = bpy.data.node_groups.new(name, "ShaderNodeTree")
    group["mask_semantic"] = semantic
    group.interface.new_socket(
        name="Strength", in_out="INPUT", socket_type="NodeSocketFloat"
    ).default_value = 1.0
    group.interface.new_socket(
        name=output_name, in_out="OUTPUT", socket_type="NodeSocketFloat"
    )
    group.nodes.new("NodeGroupInput").name = "Mask Controls"
    group.nodes.new("NodeGroupOutput").name = "Mask Result"
    return group


def _attribute(group, name, attribute_name):
    node = group.nodes.new("ShaderNodeAttribute")
    node.name = name
    node.attribute_name = attribute_name
    return node


def _group_io(group):
    return group.nodes["Mask Controls"], group.nodes["Mask Result"]


def _build_contact_group():
    group = _new_group("mask_contact_wear", "contact_wear")
    group["affected_surfaces"] = "outer touch edges; detents; rails; insert slots"
    input_node, output_node = _group_io(group)
    attribute = _attribute(group, "Painted contact attribute", MASK_ATTRIBUTES[group.name])
    remap = group.nodes.new("ShaderNodeMapRange")
    remap.name = "Edge polish response"
    remap.inputs["From Min"].default_value = 0.15
    remap.inputs["From Max"].default_value = 1.0
    remap.inputs["To Min"].default_value = 0.0
    remap.inputs["To Max"].default_value = 1.0
    remap.clamp = True
    multiply = group.nodes.new("ShaderNodeMath")
    multiply.name = "Contact strength"
    multiply.operation = "MULTIPLY"
    multiply.use_clamp = True
    group.links.new(attribute.outputs["Fac"], remap.inputs["Value"])
    group.links.new(remap.outputs["Result"], multiply.inputs[0])
    group.links.new(input_node.outputs["Strength"], multiply.inputs[1])
    group.links.new(multiply.outputs[0], output_node.inputs["Factor"])
    return group


def _build_recess_group():
    group = _new_group("mask_recess_oxidation", "recess_oxidation")
    group["affected_surfaces"] = "grooves; underside seams; bearing roots"
    input_node, output_node = _group_io(group)
    attribute = _attribute(group, "Painted recess attribute", MASK_ATTRIBUTES[group.name])
    concentrate = group.nodes.new("ShaderNodeMath")
    concentrate.name = "Confine oxidation to recess"
    concentrate.operation = "POWER"
    concentrate.inputs[1].default_value = 1.65
    multiply = group.nodes.new("ShaderNodeMath")
    multiply.name = "Oxidation strength"
    multiply.operation = "MULTIPLY"
    multiply.use_clamp = True
    group.links.new(attribute.outputs["Fac"], concentrate.inputs[0])
    group.links.new(concentrate.outputs[0], multiply.inputs[0])
    group.links.new(input_node.outputs["Strength"], multiply.inputs[1])
    group.links.new(multiply.outputs[0], output_node.inputs["Factor"])
    return group


def _build_insert_dirt_group():
    group = _new_group("mask_insert_dirt", "insert_dirt")
    group["affected_surfaces"] = "bronze/celadon boundaries only"
    input_node, output_node = _group_io(group)
    boundary = _attribute(group, "Painted insert boundary", MASK_ATTRIBUTES[group.name])
    phase = _attribute(group, "Object dirt phase", "dirt_phase")
    coordinates = group.nodes.new("ShaderNodeTexCoord")
    coordinates.name = "Object-local coordinates"
    phase_vector = group.nodes.new("ShaderNodeCombineXYZ")
    phase_vector.name = "Asymmetric object phase"
    add = group.nodes.new("ShaderNodeVectorMath")
    add.name = "Offset dirt field per object"
    add.operation = "ADD"
    noise = group.nodes.new("ShaderNodeTexNoise")
    noise.name = "Boundary dirt breakup"
    noise.noise_dimensions = "3D"
    noise.inputs["Scale"].default_value = 7.0
    noise.inputs["Detail"].default_value = 2.2
    noise.inputs["Roughness"].default_value = 0.48
    confine = group.nodes.new("ShaderNodeMath")
    confine.name = "Confine dirt to boundary"
    confine.operation = "MULTIPLY"
    strength = group.nodes.new("ShaderNodeMath")
    strength.name = "Boundary dirt strength"
    strength.operation = "MULTIPLY"
    strength.use_clamp = True
    group.links.new(phase.outputs["Fac"], phase_vector.inputs["X"])
    group.links.new(phase.outputs["Fac"], phase_vector.inputs["Z"])
    group.links.new(coordinates.outputs["Generated"], add.inputs[0])
    group.links.new(phase_vector.outputs["Vector"], add.inputs[1])
    group.links.new(add.outputs["Vector"], noise.inputs["Vector"])
    group.links.new(boundary.outputs["Fac"], confine.inputs[0])
    group.links.new(noise.outputs["Fac"], confine.inputs[1])
    group.links.new(confine.outputs[0], strength.inputs[0])
    group.links.new(input_node.outputs["Strength"], strength.inputs[1])
    group.links.new(strength.outputs[0], output_node.inputs["Factor"])
    return group


def _build_jade_microtexture_group():
    group = _new_group("mask_jade_microtexture", "jade_microtexture")
    group["affected_surfaces"] = "jade surfaces only"
    input_node, output_node = _group_io(group)
    painted = _attribute(group, "Painted jade island", MASK_ATTRIBUTES[group.name])
    coordinates = group.nodes.new("ShaderNodeTexCoord")
    coordinates.name = "Jade-local coordinates"
    scale = group.nodes.new("ShaderNodeVectorMath")
    scale.name = "Microtexture scale"
    scale.operation = "SCALE"
    scale.inputs[3].default_value = 14.0
    voronoi = group.nodes.new("ShaderNodeTexVoronoi")
    voronoi.name = "Irregular glaze cells"
    voronoi.distance = "EUCLIDEAN"
    voronoi.feature = "DISTANCE_TO_EDGE"
    threshold = group.nodes.new("ShaderNodeMath")
    threshold.name = "Restrained crack width"
    threshold.operation = "LESS_THAN"
    threshold.inputs[1].default_value = 0.045
    confine = group.nodes.new("ShaderNodeMath")
    confine.name = "Confine microtexture to jade"
    confine.operation = "MULTIPLY"
    strength = group.nodes.new("ShaderNodeMath")
    strength.name = "Microtexture strength"
    strength.operation = "MULTIPLY"
    strength.use_clamp = True
    group.links.new(coordinates.outputs["Generated"], scale.inputs[0])
    group.links.new(scale.outputs["Vector"], voronoi.inputs["Vector"])
    group.links.new(voronoi.outputs["Distance"], threshold.inputs[0])
    group.links.new(threshold.outputs[0], confine.inputs[0])
    group.links.new(painted.outputs["Fac"], confine.inputs[1])
    group.links.new(confine.outputs[0], strength.inputs[0])
    group.links.new(input_node.outputs["Strength"], strength.inputs[1])
    group.links.new(strength.outputs[0], output_node.inputs["Factor"])
    return group


def _group_node(nodes, group_name, label, strength=1.0):
    node = nodes.new("ShaderNodeGroup")
    node.name = label
    node.node_tree = bpy.data.node_groups[group_name]
    node.inputs["Strength"].default_value = strength
    return node


def _base_material(name, color, metallic, roughness):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = srgb_hex(color)
    material["physical_role"] = name.removeprefix("M_").lower()
    material["material_family"] = name
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    output.name = "Material Output"
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.name = "Principled BSDF"
    _socket(shader, "Base Color").default_value = srgb_hex(color)
    _socket(shader, "Metallic").default_value = metallic
    _socket(shader, "Roughness").default_value = roughness
    material.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material, shader


def _link_jade_recess_tone(material, shader):
    nodes = material.node_tree.nodes
    attribute = nodes.new("ShaderNodeAttribute")
    attribute.name = "Sheltered recess tone"
    attribute.attribute_name = MASK_ATTRIBUTES["mask_recess_oxidation"]
    mix = nodes.new("ShaderNodeMixRGB")
    mix.name = "Darken sheltered jade recesses"
    mix.blend_type = "MIX"
    mix.inputs[1].default_value = _socket(shader, "Base Color").default_value
    mix.inputs[2].default_value = srgb_hex("#A5B6AC")
    material.node_tree.links.new(attribute.outputs["Fac"], mix.inputs[0])
    material.node_tree.links.new(mix.outputs["Color"], _socket(shader, "Base Color"))


def _link_jade_micro_normal(material, shader):
    microtexture = material.node_tree.nodes.new("ShaderNodeGroup")
    microtexture.name = "Jade microtexture mask"
    microtexture.node_tree = bpy.data.node_groups["mask_jade_microtexture"]
    bump = material.node_tree.nodes.new("ShaderNodeBump")
    bump.name = "Jade micro-normal"
    bump.inputs["Strength"].default_value = 0.14
    bump.inputs["Distance"].default_value = 0.00025
    material.node_tree.links.new(microtexture.outputs["Factor"], bump.inputs["Height"])
    material.node_tree.links.new(bump.outputs["Normal"], _socket(shader, "Normal"))


def _build_jade_body():
    material, shader = _base_material("M_JadeBody", PALETTE["jadeBody"], 0.0, 0.27)
    _link_jade_recess_tone(material, shader)
    _link_jade_micro_normal(material, shader)
    _socket(shader, "Specular IOR Level").default_value = 0.34
    _socket(shader, "Coat Weight").default_value = 0.18
    _socket(shader, "Coat Roughness").default_value = 0.28
    return material


def _build_translucent_jade():
    material, shader = _base_material("M_TranslucentJade", PALETTE["jadeInlay"], 0.0, 0.24)
    _socket(shader, "IOR").default_value = 1.48
    _socket(shader, "Transmission Weight").default_value = 0.12
    _socket(shader, "Coat Weight").default_value = 0.16
    _socket(shader, "Emission Strength").default_value = 0.0
    material["modeled_thickness_m"] = 0.004
    return material


def _build_jade_recess():
    material, shader = _base_material("M_JadeRecess", PALETTE["jadeRecess"], 0.0, 0.42)
    _socket(shader, "Emission Strength").default_value = 0.0
    return material


def _build_old_gold():
    material, shader = _base_material("M_OldGold", PALETTE["oldGold"], 1.0, 0.32)
    _socket(shader, "Metallic").default_value = 0.68
    _socket(shader, "Coat Weight").default_value = 0.04
    _socket(shader, "Emission Strength").default_value = 0.0
    return material


def _build_ink_text():
    material, shader = _base_material("M_InkText", PALETTE["ink"], 0.0, 0.92)
    _socket(shader, "Specular IOR Level").default_value = 0.0
    _socket(shader, "Coat Weight").default_value = 0.0
    return material


def _build_cinnabar_text():
    material, shader = _base_material("M_CinnabarText", PALETTE["cinnabar"], 0.0, 0.88)
    _socket(shader, "Specular IOR Level").default_value = 0.0
    _socket(shader, "Coat Weight").default_value = 0.0
    return material


def _build_interaction_raycast():
    material, shader = _base_material("M_InteractionRaycast", "#000000", 0.0, 1.0)
    _socket(shader, "Alpha").default_value = 0.0
    transparent = material.node_tree.nodes.new("ShaderNodeBsdfTransparent")
    transparent.name = "Raycast-only transparency"
    mix = material.node_tree.nodes.new("ShaderNodeMixShader")
    mix.name = "Suppress interaction annulus render"
    mix.inputs[0].default_value = 0.0
    material.node_tree.links.new(transparent.outputs[0], mix.inputs[1])
    material.node_tree.links.new(shader.outputs["BSDF"], mix.inputs[2])
    material.node_tree.links.new(mix.outputs[0], material.node_tree.nodes["Material Output"].inputs["Surface"])
    material.surface_render_method = "DITHERED"
    material["runtime_visibility"] = "raycast-only"
    material["color_write"] = False
    material["depth_write"] = False
    return material


def build_master_materials():
    existing_materials = [name for name in MATERIAL_NAMES if bpy.data.materials.get(name)]
    existing_groups = [name for name in MASK_NAMES if bpy.data.node_groups.get(name)]
    if existing_materials or existing_groups:
        raise RuntimeError("Master materials or mask groups already exist")

    _build_contact_group()
    _build_recess_group()
    _build_insert_dirt_group()
    _build_jade_microtexture_group()
    materials = (
        _build_jade_body(),
        _build_translucent_jade(),
        _build_jade_recess(),
        _build_ink_text(),
        _build_cinnabar_text(),
        _build_old_gold(),
    )
    return materials


def _zodiac_relief_artwork_material():
    name = "M_ZodiacReliefArtwork"
    existing = bpy.data.materials.get(name)
    if existing is not None:
        return existing
    path = REPOSITORY_ROOT / "assets/daliuren/textures/source/zodiac-relief-artwork.png"
    if not path.is_file():
        raise RuntimeError(f"Missing generated zodiac relief artwork texture: {path}")
    material, shader = _base_material(name, PALETTE["jadeBody"], 0.0, 0.31)
    image = bpy.data.images.load(str(path), check_existing=True)
    image.colorspace_settings.name = "sRGB"
    texture = material.node_tree.nodes.new("ShaderNodeTexImage")
    texture.name = "Approved zodiac relief artwork"
    texture.image = image
    texture.projection = "FLAT"
    coordinates = material.node_tree.nodes.new("ShaderNodeTexCoord")
    coordinates.name = "Shared plate/earth projection"
    coordinates.object = bpy.data.objects["plate/earth"]
    mapping = material.node_tree.nodes.new("ShaderNodeMapping")
    mapping.name = "Square board calibration"
    mapping.inputs["Scale"].default_value = (2.0, 2.0, 1.0)
    mapping.inputs["Location"].default_value = (0.5, 0.5, 0.0)
    material.node_tree.links.new(coordinates.outputs["Object"], mapping.inputs["Vector"])
    material.node_tree.links.new(mapping.outputs["Vector"], texture.inputs["Vector"])
    material.node_tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])
    material["source_texture"] = path.relative_to(REPOSITORY_ROOT).as_posix()
    material["source_art"] = "daliuren-heaven-plate-translucent-jade-generals-v10.png"
    material["projection"] = "raised zodiac relief only"
    return material


def _beidou_blue_material():
    name = "M_BeidouBlue"
    existing = bpy.data.materials.get(name)
    if existing is not None:
        return existing
    material, _ = _base_material(name, "#285FA8", 0.35, 0.26)
    return material


def _physical_material_name(obj):
    if obj.name in {
        "plate/heaven",
        "detail/heaven/dial-foundation",
        "detail/heaven/linked-ring-1",
        "detail/heaven/linked-ring-2",
        "plate/generals",
        "plate/core",
    }:
        return "M_JadeBody"
    role = obj.get("inscription_role")
    if role in {"earth-branch", "heaven-branch"}:
        return "M_InkText"
    if obj.get("text_role") == "general-name":
        return "M_InkText"
    if obj.get("text_role") == "month-general":
        return "M_CinnabarText"
    if role:
        return "M_InkText"
    variant = obj.get("material_variant")
    if variant in {"gold", "zodiac-gold", "zodiac-red"}:
        return "M_OldGold"
    if variant == "jade-recess":
        return "M_JadeRecess"
    if obj.get("domain") == "general":
        return "M_TranslucentJade"
    return "M_JadeBody"


def _normalized_coordinate(value, minimum, maximum):
    extent = maximum - minimum
    if extent <= 1e-12:
        return 0.5
    return (value - minimum) / extent


def _attribute_pattern(obj, kind):
    coordinates = [vertex.co.copy() for vertex in obj.data.vertices]
    if not coordinates:
        return ()
    minimum = Vector((min(value[index] for value in coordinates) for index in range(3)))
    maximum = Vector((max(value[index] for value in coordinates) for index in range(3)))
    result = []
    for coordinate in coordinates:
        x = _normalized_coordinate(coordinate.x, minimum.x, maximum.x)
        y = _normalized_coordinate(coordinate.y, minimum.y, maximum.y)
        z = _normalized_coordinate(coordinate.z, minimum.z, maximum.z)
        edge = max(abs(2.0 * x - 1.0), abs(2.0 * y - 1.0))
        if kind == "contact":
            value = 0.18 + 0.54 * edge + 0.28 * z
        elif kind == "recess":
            value = 0.15 + 0.73 * (1.0 - z) + 0.12 * (1.0 - edge)
        elif kind == "boundary":
            value = 0.08 + 0.92 * edge * (0.72 + 0.28 * (1.0 - z))
        elif kind == "crackle":
            value = 0.62 + 0.25 * z + 0.13 * (1.0 - edge)
        else:
            raise ValueError(f"Unknown attribute pattern: {kind}")
        result.append(max(0.0, min(1.0, value)))
    return tuple(result)


def _face_mask_values(obj, kind):
    polygons = tuple(obj.data.polygons)
    if not polygons:
        return ()
    centers = [polygon.center for polygon in polygons]
    minimum = Vector((min(value[index] for value in centers) for index in range(3)))
    maximum = Vector((max(value[index] for value in centers) for index in range(3)))
    radial_values = [math.hypot(center.x, center.y) for center in centers]
    radial_minimum = min(radial_values)
    radial_maximum = max(radial_values)
    detail_id = obj.get("detail_id")
    result = []
    for polygon, radial in zip(polygons, radial_values):
        center = polygon.center
        normal = polygon.normal
        x = _normalized_coordinate(center.x, minimum.x, maximum.x)
        y = _normalized_coordinate(center.y, minimum.y, maximum.y)
        z = _normalized_coordinate(center.z, minimum.z, maximum.z)
        edge = max(abs(2.0 * x - 1.0), abs(2.0 * y - 1.0))

        if kind == "contact":
            if detail_id == "mechanism/heaven-detent":
                affected = normal.z > 0.30
                value = 0.72 + 0.28 * max(0.0, normal.z) if affected else 0.0
            elif detail_id in {"mechanism/general-track", "mechanism/lesson-general-socket"}:
                if detail_id == "mechanism/lesson-general-socket":
                    radial_position = _normalized_coordinate(radial, radial_minimum, radial_maximum)
                    affected = radial_position < 0.48 and normal.z > -0.70
                else:
                    affected = normal.z > 0.12
                value = 0.70 + 0.30 * max(0.0, normal.z) if affected else 0.0
            elif detail_id == "mechanism/lesson-dovetails":
                affected = normal.z > 0.08 or (z > 0.48 and abs(normal.y) > 0.30)
                value = 0.74 + 0.26 * z if affected else 0.0
            elif detail_id in {"mechanism/lesson-end-stop", "mechanism/bridge-stops"}:
                affected = edge > 0.72 and abs(normal.z) < 0.90 and z > 0.18
                value = 0.76 + 0.24 * z if affected else 0.0
            else:
                affected = edge > 0.76 and normal.z > -0.35
                value = 0.68 + 0.32 * max(z, 0.0) if affected else 0.0
        elif kind == "recess":
            if detail_id in {"structure/base-bottom-seam", "structure/base-shell-thickness"}:
                affected = normal.z < -0.20 or (z < 0.16 and abs(normal.z) < 0.96)
                value = 0.74 + 0.26 * (1.0 - z) if affected else 0.0
            elif detail_id == "mechanism/heaven-bearing":
                affected = z < 0.46 and normal.z < 0.72
                value = 0.72 + 0.28 * (1.0 - z) if affected else 0.0
            else:
                affected = normal.z < 0.15
                value = 0.70 + 0.30 * max(0.0, -normal.z) if affected else 0.0
        elif kind == "boundary":
            affected = abs(normal.z) < 0.94
            value = 0.76 + 0.24 * (1.0 - abs(normal.z)) if affected else 0.0
        else:
            raise ValueError(f"Unknown face attribute pattern: {kind}")
        result.append(max(0.0, min(1.0, value)))
    return tuple(result)


def _set_float_attribute(obj, name, values):
    attribute = obj.data.attributes.get(name)
    if attribute is not None:
        obj.data.attributes.remove(attribute)
    attribute = obj.data.attributes.new(name=name, type="FLOAT", domain="POINT")
    if isinstance(values, (float, int)):
        values = (float(values),) * len(attribute.data)
    if len(values) != len(attribute.data):
        raise RuntimeError(f"Attribute {name} length mismatch on {obj.name}")
    attribute.data.foreach_set("value", values)


def _set_face_attribute(obj, name, values):
    attribute = obj.data.attributes.get(name)
    if attribute is not None:
        obj.data.attributes.remove(attribute)
    attribute = obj.data.attributes.new(name=name, type="FLOAT", domain="FACE")
    if len(values) != len(attribute.data):
        raise RuntimeError(f"Face attribute {name} length mismatch on {obj.name}")
    attribute.data.foreach_set("value", values)


def _lesson_phase(obj):
    for lesson, phase in LESSON_PHASES.items():
        if obj.name.startswith(f"lesson/{lesson}/"):
            return phase
    return (sum((index + 1) * ord(char) for index, char in enumerate(obj.name)) % 89 + 5) / 100.0


def apply_master_materials(root):
    if root.get("node_id") != "artifact/root":
        raise ValueError("Material assignment requires artifact/root")
    missing = [name for name in MATERIAL_NAMES if bpy.data.materials.get(name) is None]
    if missing:
        raise RuntimeError(f"Missing master materials: {', '.join(missing)}")
    if any(obj.get("material_role") for obj in bpy.data.objects if obj.type == "MESH"):
        raise RuntimeError("Artifact materials are already assigned")

    interaction = bpy.data.materials.get("M_InteractionRaycast") or _build_interaction_raycast()
    for obj in sorted((item for item in bpy.data.objects if item.type == "MESH"), key=lambda item: item.name):
        name = _physical_material_name(obj)
        variant = obj.get("material_variant", "")
        material_role = name
        if obj.get("visual_role") == "zodiac-animal-relief":
            material = _zodiac_relief_artwork_material()
            material_role = "M_JadeBody"
        elif variant == "beidou-blue":
            material = _beidou_blue_material()
            material_role = "M_JadeBody"
        else:
            material = interaction if obj.get("node_id") == "interaction/month-general-ring" else bpy.data.materials[name]
        obj.data.materials.clear()
        obj.data.materials.append(material)
        obj["material_role"] = material_role

        detail_id = obj.get("detail_id")
        if obj.name in CONTACT_OBJECTS or detail_id in CONTACT_DETAIL_IDS:
            _set_face_attribute(
                obj,
                MASK_ATTRIBUTES["mask_contact_wear"],
                _face_mask_values(obj, "contact"),
            )
        if detail_id in RECESS_DETAIL_IDS:
            _set_face_attribute(
                obj,
                MASK_ATTRIBUTES["mask_recess_oxidation"],
                _face_mask_values(obj, "recess"),
            )
        if name == "M_JadeBody":
            _set_face_attribute(
                obj,
                MASK_ATTRIBUTES["mask_insert_dirt"],
                _face_mask_values(obj, "boundary"),
            )
            _set_float_attribute(
                obj,
                MASK_ATTRIBUTES["mask_jade_microtexture"],
                _attribute_pattern(obj, "crackle"),
            )
            _set_float_attribute(obj, "dirt_phase", _lesson_phase(obj))
    bpy.context.view_layer.update()
    return root


def _look_at(obj, target):
    obj.rotation_euler = ((Vector(target) - obj.location).to_track_quat("-Z", "Y")).to_euler()


def _board_ground_material():
    material = bpy.data.materials.new("review/neutral-ground")
    material.use_nodes = True
    shader = next(
        node
        for node in material.node_tree.nodes
        if node.bl_idname == "ShaderNodeBsdfPrincipled"
    )
    shader.inputs["Base Color"].default_value = (0.095, 0.105, 0.102, 1.0)
    shader.inputs["Metallic"].default_value = 0.0
    shader.inputs["Roughness"].default_value = 0.78
    return material


def _review_principled_material(name, color, _strength):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Metallic"].default_value = 0.0
    shader.inputs["Roughness"].default_value = 0.55
    return material


def _camera_view_size(scene, camera, depth):
    width = 2.0 * depth * math.tan(camera.data.angle_x * 0.5)
    height = width * scene.render.resolution_y / scene.render.resolution_x
    return width, height


def _camera_local_from_pixel(scene, camera, x, y, depth):
    view_width, view_height = _camera_view_size(scene, camera, depth)
    return Vector(
        (
            (x / scene.render.resolution_x - 0.5) * view_width,
            (0.5 - y / scene.render.resolution_y) * view_height,
            -depth,
        )
    )


def _camera_facing_plane(scene, camera, name, pixel_region, depth, material, role):
    left, top, right, bottom = pixel_region
    view_width, view_height = _camera_view_size(scene, camera, depth)
    bpy.ops.mesh.primitive_plane_add(size=2.0)
    plane = bpy.context.object
    plane.name = name
    plane["review_role"] = role
    plane.data.materials.append(material)
    plane.parent = camera
    plane.matrix_parent_inverse = Matrix.Identity(4)
    plane.location = _camera_local_from_pixel(
        scene,
        camera,
        (left + right) * 0.5,
        (top + bottom) * 0.5,
        depth,
    )
    plane.scale = (
        (right - left) / scene.render.resolution_x * view_width * 0.5,
        (bottom - top) / scene.render.resolution_y * view_height * 0.5,
        1.0,
    )
    return plane


def build_material_board_scene():
    scene = bpy.data.scenes.new("material-board")
    bpy.context.window.scene = scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.resolution_percentage = 100
    scene.render.use_file_extension = True
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world = bpy.data.worlds.new("material-board/world")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = srgb_hex(PALETTE["ink"])
    background.inputs["Strength"].default_value = 0.28

    ground_material = _board_ground_material()
    bpy.ops.mesh.primitive_plane_add(size=20.0, location=(0.0, 0.0, 0.0))
    ground = bpy.context.object
    ground.name = "review/neutral-ground"
    ground.data.materials.append(ground_material)

    order = MATERIAL_NAMES
    x_positions = (-4.75, -2.85, -0.95, 0.95, 2.85, 4.75)
    for index, (name, x) in enumerate(zip(order, x_positions)):
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=96,
            ring_count=64,
            radius=0.72,
            location=(x, 0.0, 0.72),
        )
        sphere = bpy.context.object
        sphere.name = f"review/sphere/{name}"
        sphere["review_material"] = name
        sphere.data.materials.append(bpy.data.materials[name])
        bpy.ops.object.shade_smooth()

        for attribute_name in MASK_ATTRIBUTES.values():
            values = []
            for vertex in sphere.data.vertices:
                normal = vertex.co.normalized()
                if attribute_name == "causal_contact_wear":
                    values.append(max(0.0, normal.z) ** 2)
                elif attribute_name == "causal_recess_oxidation":
                    values.append(max(0.0, -normal.z) ** 1.5)
                elif attribute_name == "causal_insert_boundary":
                    values.append(max(0.0, 1.0 - abs(normal.z) * 1.8))
                else:
                    values.append(0.82 + 0.18 * max(0.0, normal.z))
            _set_float_attribute(sphere, attribute_name, values)
        _set_float_attribute(sphere, "dirt_phase", 0.13 + index * 0.17)

    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=128,
        ring_count=96,
        radius=0.08,
        location=(0.0, 0.0, 0.0),
    )
    closeup = bpy.context.object
    closeup.name = "review/jade-closeup"
    closeup["review_material"] = "M_JadeBody"
    closeup["review_role"] = "micro-surface-inset"
    closeup.data.materials.append(bpy.data.materials["M_JadeBody"])
    bpy.ops.object.shade_smooth()
    _set_face_attribute(
        closeup,
        MASK_ATTRIBUTES["mask_insert_dirt"],
        (0.0,) * len(closeup.data.polygons),
    )
    _set_float_attribute(
        closeup,
        MASK_ATTRIBUTES["mask_jade_microtexture"],
        1.0,
    )
    _set_float_attribute(closeup, "dirt_phase", 0.41)

    key_data = bpy.data.lights.new("material-board/key-5200K", "SUN")
    key_data.energy = 2.8
    key_data.angle = math.radians(8.0)
    key_data.use_temperature = True
    key_data.temperature = 5200.0
    key = bpy.data.objects.new("material-board/key-5200K", key_data)
    scene.collection.objects.link(key)
    key.location = (-4.5, -4.8, 6.2)
    _look_at(key, (0.0, 0.0, 0.7))

    fill_data = bpy.data.lights.new("material-board/fill", "AREA")
    fill_data.energy = 360.0
    fill_data.size = 5.0
    fill = bpy.data.objects.new("material-board/fill", fill_data)
    scene.collection.objects.link(fill)
    fill.location = (4.5, -1.5, 3.2)
    _look_at(fill, (0.0, 0.0, 0.7))

    rim_data = bpy.data.lights.new("material-board/rim", "AREA")
    rim_data.energy = 480.0
    rim_data.shape = "RECTANGLE"
    rim_data.size = 3.5
    rim_data.size_y = 0.7
    rim = bpy.data.objects.new("material-board/rim", rim_data)
    scene.collection.objects.link(rim)
    rim.location = (0.0, 3.0, 4.0)
    _look_at(rim, (0.0, 0.0, 0.7))

    camera_data = bpy.data.cameras.new("material-board/camera")
    camera_data.lens = 62.0
    camera = bpy.data.objects.new("material-board/camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (0.0, -17.2, 5.0)
    _look_at(camera, (0.0, 0.0, 0.7))
    bpy.context.view_layer.update()
    inset_region = (790, 2, 1300, 360)
    frame_material = _review_principled_material(
        "review/jade-inset-frame-material",
        srgb_hex(PALETTE["jadeBody"]),
        0.32,
    )
    panel_material = _review_principled_material(
        "review/jade-inset-panel-material",
        srgb_hex(PALETTE["ink"]),
        0.12,
    )
    label_material = _review_principled_material(
        "review/jade-inset-label-material",
        srgb_hex(PALETTE["ink"]),
        0.62,
    )
    _camera_facing_plane(
        scene,
        camera,
        "review/celadon-inset-frame",
        inset_region,
        2.30,
        frame_material,
        "inset-frame",
    )
    _camera_facing_plane(
        scene,
        camera,
        "review/celadon-inset-panel",
        (794, 6, 1296, 356),
        2.295,
        panel_material,
        "inset-panel",
    )
    label_curve = bpy.data.curves.new("review/celadon-inset-label", "FONT")
    label_curve.body = "CELADON  /  MICRO"
    label_curve.align_x = "LEFT"
    label_curve.align_y = "TOP"
    label_curve.size = 0.012
    label_curve.materials.append(label_material)
    label = bpy.data.objects.new("review/celadon-inset-label", label_curve)
    label["review_role"] = "inset-label"
    scene.collection.objects.link(label)
    label.parent = camera
    label.matrix_parent_inverse = Matrix.Identity(4)
    label.location = _camera_local_from_pixel(scene, camera, 1052, 12, 1.55)
    closeup.location = camera.matrix_world @ _camera_local_from_pixel(
        scene,
        camera,
        960,
        175,
        1.69,
    )
    scene.camera = camera

    bpy.context.view_layer.update()
    return scene


def render_material_board(output_path):
    output_path = Path(output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    original_scene = bpy.context.scene
    scene = build_material_board_scene()
    scene.render.filepath = str(output_path)
    bpy.ops.render.render(write_still=True)
    bpy.context.window.scene = original_scene
    bpy.data.scenes.remove(scene)
    return output_path
