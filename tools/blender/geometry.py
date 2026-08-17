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
