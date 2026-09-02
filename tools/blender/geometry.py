import math

import bpy


def _apply_bevel(obj, width):
    if width <= 0:
        return
    modifier = obj.modifiers.new(name="edge bevel", type="BEVEL")
    modifier.width = width
    modifier.segments = 3
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def _finish_runtime_object(obj, node_id, bevel):
    obj.name = node_id
    obj["node_id"] = node_id
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    _apply_bevel(obj, bevel)
    return obj


def add_beveled_box(node_id, size, location, bevel):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.dimensions = size
    return _finish_runtime_object(obj, node_id, bevel)


def add_disc(node_id, radius, depth, location, bevel):
    bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=radius, depth=depth, location=location)
    return _finish_runtime_object(bpy.context.object, node_id, bevel)


def add_ring(node_id, outer_radius, inner_radius, depth, location, bevel=0.0):
    if not 0 < inner_radius < outer_radius:
        raise ValueError("Ring radii must satisfy 0 < inner < outer")
    segments = 128
    half_depth = depth / 2
    vertices = []
    for z in (-half_depth, half_depth):
        for radius in (outer_radius, inner_radius):
            vertices.extend(
                (
                    radius * math.cos(index * 2 * math.pi / segments),
                    radius * math.sin(index * 2 * math.pi / segments),
                    z,
                )
                for index in range(segments)
            )
    outer_bottom = 0
    inner_bottom = segments
    outer_top = segments * 2
    inner_top = segments * 3
    faces = []
    for index in range(segments):
        next_index = (index + 1) % segments
        faces.extend((
            (outer_top + index, outer_top + next_index, inner_top + next_index, inner_top + index),
            (outer_bottom + next_index, outer_bottom + index, inner_bottom + index, inner_bottom + next_index),
            (outer_bottom + index, outer_bottom + next_index, outer_top + next_index, outer_top + index),
            (inner_bottom + next_index, inner_bottom + index, inner_top + index, inner_top + next_index),
        ))
    mesh = bpy.data.meshes.new(f"{node_id}/mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(clean_customdata=False)
    mesh.update()
    obj = bpy.data.objects.new(node_id, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    return _finish_runtime_object(obj, node_id, bevel)


def add_annular_sector(node_id, inner_radius, outer_radius, angle_start, angle_end, depth, location, bevel):
    if not 0 < inner_radius < outer_radius:
        raise ValueError("Sector radii must satisfy 0 < inner < outer")
    if not 0 < angle_end - angle_start <= math.tau:
        raise ValueError("Sector angle must be positive and at most one turn")
    steps = max(2, math.ceil((angle_end - angle_start) / math.tau * 128))
    angles = [angle_start + (angle_end - angle_start) * index / steps for index in range(steps + 1)]
    half = depth / 2
    vertices = []
    for z in (-half, half):
        for radius in (inner_radius, outer_radius):
            vertices.extend((radius * math.cos(angle), radius * math.sin(angle), z) for angle in angles)
    count = steps + 1
    bottom_inner, bottom_outer, top_inner, top_outer = 0, count, count * 2, count * 3
    faces = []
    for index in range(steps):
        next_index = index + 1
        faces.extend((
            (top_inner + index, top_outer + index, top_outer + next_index, top_inner + next_index),
            (bottom_inner + next_index, bottom_outer + next_index, bottom_outer + index, bottom_inner + index),
            (bottom_inner + index, top_inner + index, top_inner + next_index, bottom_inner + next_index),
            (bottom_outer + next_index, top_outer + next_index, top_outer + index, bottom_outer + index),
        ))
    faces.extend((
        (bottom_inner, bottom_outer, top_outer, top_inner),
        (bottom_inner + steps, top_inner + steps, top_outer + steps, bottom_outer + steps),
    ))
    mesh = bpy.data.meshes.new(f"{node_id}/mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(clean_customdata=False)
    mesh.update()
    obj = bpy.data.objects.new(node_id, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    return _finish_runtime_object(obj, node_id, bevel)
