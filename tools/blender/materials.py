import math
from pathlib import Path

import bpy
from mathutils import Vector


REPOSITORY_ROOT = Path(__file__).parents[2]
MATERIAL_NAMES = (
    "M_Bronze",
    "M_Patina",
    "M_Celadon",
    "M_OldGold",
    "M_AshText",
)
MASK_NAMES = (
    "mask_contact_wear",
    "mask_recess_oxidation",
    "mask_insert_dirt",
    "mask_celadon_crackle",
)
PALETTE = {
    "ink": "#121817",
    "bronze": "#26322F",
    "patina": "#435C53",
    "celadon": "#879B92",
    "ash": "#C2C6BB",
    "oldGold": "#80704C",
}
MASK_ATTRIBUTES = {
    "mask_contact_wear": "causal_contact_wear",
    "mask_recess_oxidation": "causal_recess_oxidation",
    "mask_insert_dirt": "causal_insert_boundary",
    "mask_celadon_crackle": "causal_celadon_crackle",
}
CONTACT_DETAIL_IDS = {
    "mechanism/heaven-detent",
    "mechanism/lesson-dovetails",
    "mechanism/lesson-general-socket",
    "mechanism/general-track",
    "structure/heaven-inlay-bed",
}
RECESS_DETAIL_IDS = {
    "structure/base-bottom-seam",
    "structure/base-shell-thickness",
    "mechanism/heaven-bearing",
    "structure/heaven-support-rib",
    "structure/bronze-celadon-contact-seam",
    "mechanism/general-track",
    "structure/bridge-support",
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


def _build_crackle_group():
    group = _new_group("mask_celadon_crackle", "celadon_crackle")
    group["affected_surfaces"] = "celadon surfaces only"
    input_node, output_node = _group_io(group)
    painted = _attribute(group, "Painted celadon island", MASK_ATTRIBUTES[group.name])
    coordinates = group.nodes.new("ShaderNodeTexCoord")
    coordinates.name = "Celadon-local coordinates"
    scale = group.nodes.new("ShaderNodeVectorMath")
    scale.name = "Crackle scale"
    scale.operation = "SCALE"
    scale.inputs[3].default_value = 38.0
    voronoi = group.nodes.new("ShaderNodeTexVoronoi")
    voronoi.name = "Irregular glaze cells"
    voronoi.distance = "EUCLIDEAN"
    voronoi.feature = "DISTANCE_TO_EDGE"
    threshold = group.nodes.new("ShaderNodeMath")
    threshold.name = "Restrained crack width"
    threshold.operation = "LESS_THAN"
    threshold.inputs[1].default_value = 0.035
    confine = group.nodes.new("ShaderNodeMath")
    confine.name = "Confine cracks to celadon"
    confine.operation = "MULTIPLY"
    strength = group.nodes.new("ShaderNodeMath")
    strength.name = "Crackle strength"
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


def _build_bronze():
    material, shader = _base_material("M_Bronze", PALETTE["bronze"], 1.0, 0.58)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    contact = _group_node(nodes, "mask_contact_wear", "Causal contact polish", 0.78)
    roughness = nodes.new("ShaderNodeMapRange")
    roughness.name = "Contact-polished roughness"
    roughness.inputs["From Min"].default_value = 0.0
    roughness.inputs["From Max"].default_value = 1.0
    roughness.inputs["To Min"].default_value = 0.58
    roughness.inputs["To Max"].default_value = 0.31
    roughness.clamp = True
    links.new(contact.outputs["Factor"], roughness.inputs["Value"])
    links.new(roughness.outputs["Result"], _socket(shader, "Roughness"))

    recess = _group_node(nodes, "mask_recess_oxidation", "Causal recess tint", 0.52)
    tint = nodes.new("ShaderNodeMixRGB")
    tint.name = "Bronze to recessed patina"
    tint.blend_type = "MIX"
    tint.inputs[1].default_value = srgb_hex(PALETTE["bronze"])
    tint.inputs[2].default_value = srgb_hex(PALETTE["patina"])
    links.new(recess.outputs["Factor"], tint.inputs[0])
    links.new(tint.outputs["Color"], _socket(shader, "Base Color"))
    return material


def _build_patina():
    material, shader = _base_material("M_Patina", PALETTE["patina"], 1.0, 0.72)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    recess = _group_node(nodes, "mask_recess_oxidation", "Causal oxidation coverage", 0.9)
    roughness = nodes.new("ShaderNodeMapRange")
    roughness.name = "Oxidation roughness"
    roughness.inputs["From Min"].default_value = 0.0
    roughness.inputs["From Max"].default_value = 1.0
    roughness.inputs["To Min"].default_value = 0.72
    roughness.inputs["To Max"].default_value = 0.84
    roughness.clamp = True
    links.new(recess.outputs["Factor"], roughness.inputs["Value"])
    links.new(roughness.outputs["Result"], _socket(shader, "Roughness"))
    return material


def _build_celadon():
    material, shader = _base_material("M_Celadon", PALETTE["celadon"], 0.0, 0.34)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    _socket(shader, "Specular IOR Level").default_value = 0.34
    _socket(shader, "Coat Weight").default_value = 0.18
    _socket(shader, "Coat Roughness").default_value = 0.28

    dirt = _group_node(nodes, "mask_insert_dirt", "Causal insert-boundary dirt", 0.38)
    crackle = _group_node(nodes, "mask_celadon_crackle", "Celadon-only crackle", 0.22)
    dirt_tint = nodes.new("ShaderNodeMixRGB")
    dirt_tint.name = "Boundary dirt tint"
    dirt_tint.inputs[1].default_value = srgb_hex(PALETTE["celadon"])
    dirt_tint.inputs[2].default_value = srgb_hex(PALETTE["patina"])
    links.new(dirt.outputs["Factor"], dirt_tint.inputs[0])
    links.new(dirt_tint.outputs["Color"], _socket(shader, "Base Color"))

    roughness = nodes.new("ShaderNodeMapRange")
    roughness.name = "Crackle roughness response"
    roughness.inputs["From Min"].default_value = 0.0
    roughness.inputs["From Max"].default_value = 1.0
    roughness.inputs["To Min"].default_value = 0.34
    roughness.inputs["To Max"].default_value = 0.48
    roughness.clamp = True
    links.new(crackle.outputs["Factor"], roughness.inputs["Value"])
    links.new(roughness.outputs["Result"], _socket(shader, "Roughness"))

    coordinates = nodes.new("ShaderNodeTexCoord")
    coordinates.name = "Glaze coordinates"
    orange_peel = nodes.new("ShaderNodeTexNoise")
    orange_peel.name = "Glaze orange peel"
    orange_peel.noise_dimensions = "3D"
    orange_peel.inputs["Scale"].default_value = 72.0
    orange_peel.inputs["Detail"].default_value = 2.0
    orange_peel.inputs["Roughness"].default_value = 0.38
    bump = nodes.new("ShaderNodeBump")
    bump.name = "Restrained glaze micro-normal"
    bump.inputs["Strength"].default_value = 0.075
    bump.inputs["Distance"].default_value = 0.00015
    links.new(coordinates.outputs["Generated"], orange_peel.inputs["Vector"])
    links.new(orange_peel.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], _socket(shader, "Normal"))
    return material


def _build_old_gold():
    material, shader = _base_material("M_OldGold", PALETTE["oldGold"], 1.0, 0.38)
    _socket(shader, "Coat Weight").default_value = 0.04
    return material


def _build_ash_text():
    material, shader = _base_material("M_AshText", PALETTE["ash"], 0.0, 0.68)
    _socket(shader, "Specular IOR Level").default_value = 0.24
    return material


def build_master_materials():
    existing_materials = [name for name in MATERIAL_NAMES if bpy.data.materials.get(name)]
    existing_groups = [name for name in MASK_NAMES if bpy.data.node_groups.get(name)]
    if existing_materials or existing_groups:
        raise RuntimeError("Master materials or mask groups already exist")

    _build_contact_group()
    _build_recess_group()
    _build_insert_dirt_group()
    _build_crackle_group()
    return (
        _build_bronze(),
        _build_patina(),
        _build_celadon(),
        _build_old_gold(),
        _build_ash_text(),
    )


def _physical_material_name(obj):
    role = obj.get("inscription_role")
    if role == "mechanical-scale":
        return "M_OldGold"
    if role:
        return "M_AshText"
    detail_id = obj.get("detail_id")
    if detail_id in PATINA_DETAIL_IDS:
        return "M_Patina"
    if detail_id in CELADON_DETAIL_IDS:
        return "M_Celadon"
    if obj.name.endswith("/readout") or "/readout/" in obj.name:
        return "M_Celadon"
    if obj.get("node_id") in {
        "transmission/initial",
        "transmission/middle",
        "transmission/final",
    }:
        return "M_Celadon"
    return "M_Bronze"


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

    for obj in sorted((item for item in bpy.data.objects if item.type == "MESH"), key=lambda item: item.name):
        name = _physical_material_name(obj)
        obj.data.materials.clear()
        obj.data.materials.append(bpy.data.materials[name])
        obj["material_role"] = name

        detail_id = obj.get("detail_id")
        if obj.name in CONTACT_OBJECTS or detail_id in CONTACT_DETAIL_IDS:
            _set_float_attribute(
                obj,
                MASK_ATTRIBUTES["mask_contact_wear"],
                _attribute_pattern(obj, "contact"),
            )
        if detail_id in RECESS_DETAIL_IDS:
            _set_float_attribute(
                obj,
                MASK_ATTRIBUTES["mask_recess_oxidation"],
                _attribute_pattern(obj, "recess"),
            )
        if name == "M_Celadon":
            _set_float_attribute(
                obj,
                MASK_ATTRIBUTES["mask_insert_dirt"],
                _attribute_pattern(obj, "boundary"),
            )
            _set_float_attribute(
                obj,
                MASK_ATTRIBUTES["mask_celadon_crackle"],
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
    x_positions = (-3.8, -1.9, 0.0, 1.9, 3.8)
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

    key_data = bpy.data.lights.new("material-board/key-4300K", "AREA")
    key_data.energy = 1250.0
    key_data.shape = "DISK"
    key_data.size = 4.5
    key_data.use_temperature = True
    key_data.temperature = 4300.0
    key = bpy.data.objects.new("material-board/key-4300K", key_data)
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
