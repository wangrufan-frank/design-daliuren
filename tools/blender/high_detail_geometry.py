import bpy

from geometry import add_beveled_box


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
BEVELED_RUNTIME_IDS = (
    "base/body",
    "plate/earth",
    "plate/heaven",
    "transmission/initial",
    "transmission/middle",
    "transmission/final",
    *(f"general/{key}" for key in GENERAL_KEYS),
)


def _finish_detail(obj, parent, detail_id, index, location):
    if "node_id" in obj:
        del obj["node_id"]
    obj.parent = parent
    obj.location = location
    obj["detail_id"] = detail_id
    obj["detail_index"] = index
    obj["owner_node_id"] = parent["node_id"]
    return obj


def _box(name, parent, detail_id, index, size, location, bevel=0.0004):
    obj = add_beveled_box(name, size, (0.0, 0.0, 0.0), bevel)
    return _finish_detail(obj, parent, detail_id, index, location)


def _torus(
    name,
    parent,
    detail_id,
    index,
    major_radius,
    minor_radius,
    location,
    major_segments=64,
):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=major_segments,
        minor_segments=8,
        location=(0.0, 0.0, 0.0),
    )
    obj = bpy.context.object
    obj.name = name
    return _finish_detail(obj, parent, detail_id, index, location)


def _add_runtime_bevels():
    for node_id in BEVELED_RUNTIME_IDS:
        obj = bpy.data.objects[node_id]
        modifier = obj.modifiers.new(name="high detail edge bevel", type="BEVEL")
        modifier.width = 0.0005
        modifier.segments = 3
        modifier.limit_method = "ANGLE"
        if node_id == "plate/heaven":
            weld = obj.modifiers.new(name="remove bevel slivers", type="WELD")
            weld.merge_threshold = 0.000002
            obj.modifiers.new(name="freeze clean export triangles", type="TRIANGULATE")


def _add_base_details():
    base = bpy.data.objects["base/body"]
    wall_specs = (
        ((0.488, 0.008, 0.0008), (0.0, 0.256, -0.0256)),
        ((0.488, 0.008, 0.0008), (0.0, -0.256, -0.0256)),
        ((0.008, 0.488, 0.0008), (0.256, 0.0, -0.0256)),
        ((0.008, 0.488, 0.0008), (-0.256, 0.0, -0.0256)),
    )
    for index, (size, location) in enumerate(wall_specs):
        _box(
            f"detail/base/shell-return/{index:02d}",
            base,
            "structure/base-shell-thickness",
            index,
            size,
            location,
            bevel=0.0002,
        )
    _box(
        "detail/base/removable-bottom",
        base,
        "structure/base-bottom-seam",
        0,
        (0.484, 0.484, 0.0008),
        (0.0, 0.0, -0.0256),
        bevel=0.00015,
    )
    for index, (x, y) in enumerate(
        ((-0.252, -0.252), (-0.252, 0.252), (0.252, -0.252), (0.252, 0.252))
    ):
        _box(
            f"detail/base/cast-corner/{index:02d}",
            base,
            "structure/base-corner-transition",
            index,
            (0.016, 0.016, 0.0012),
            (x, y, -0.0254),
            bevel=0.0003,
        )


def _add_heaven_details():
    heaven = bpy.data.objects["plate/heaven"]
    _torus(
        "detail/heaven/bronze-rim",
        heaven,
        "structure/heaven-bronze-rim",
        0,
        0.1855,
        0.0035,
        (0.0, 0.0, 0.0091),
        128,
    )


def upgrade_to_high_detail(root):
    if root.get("node_id") != "artifact/root":
        raise ValueError("High-detail upgrade requires artifact/root")
    if any(
        obj.get("detail_id") != "structure/bronze-inlay-branch-bed"
        for obj in bpy.data.objects
        if obj.get("detail_id")
    ):
        raise RuntimeError("Artifact is already upgraded to high detail")

    _add_base_details()
    _add_heaven_details()
    _add_runtime_bevels()
    bpy.context.view_layer.update()
    return root
