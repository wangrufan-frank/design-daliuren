import math
import bpy

from daliuren_contract import VISUAL_ORIENTATION_OFFSET_DEG
from geometry import add_beveled_box, add_disc


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
    "plate/generals",
    "plate/core",
    "transmission/initial",
    "transmission/middle",
    "transmission/final",
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
        ((0.488, 0.008, 0.0008), (0.0, 0.256, -0.0136)),
        ((0.488, 0.008, 0.0008), (0.0, -0.256, -0.0136)),
        ((0.008, 0.488, 0.0008), (0.256, 0.0, -0.0136)),
        ((0.008, 0.488, 0.0008), (-0.256, 0.0, -0.0136)),
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
        (0.0, 0.0, -0.0136),
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
            (x, y, -0.0134),
            bevel=0.0003,
        )


def _add_heaven_details():
    heaven = bpy.data.objects["plate/heaven"]
    _torus(
        "detail/heaven/bronze-rim",
        heaven,
        "structure/heaven-bronze-rim",
        0,
        0.1585,
        0.0022,
        (0.0, 0.0, 0.0048),
        128,
    )


def _visual_box(name, parent, size, location, rotation_z=0.0, variant="jade"):
    obj = add_beveled_box(name, size, (0.0, 0.0, 0.0), min(size) * 0.18)
    del obj["node_id"]
    obj.parent = parent
    obj.location = location
    obj.rotation_euler.z = rotation_z
    obj["visual_role"] = name.split("/")[1]
    obj["material_variant"] = variant
    return obj


def _add_ring_dividers():
    specs = (
        (bpy.data.objects["plate/heaven"], (0.159, 0.120), 0.0052),
        (bpy.data.objects["plate/generals"], (0.108, 0.064), 0.0037),
    )
    for parent, (outer_radius, inner_radius), z in specs:
        length = outer_radius - inner_radius
        center_radius = (outer_radius + inner_radius) / 2
        for index in range(12):
            angle = math.radians(90 + VISUAL_ORIENTATION_OFFSET_DEG - index * 30)
            _visual_box(
                f"divider/{parent.name.rsplit('/', 1)[-1]}/{index:02d}",
                parent,
                (0.00075, length, 0.00055),
                (center_radius * math.cos(angle), center_radius * math.sin(angle), z),
                angle - math.pi / 2,
                "gold",
            )


def _add_ring_craft():
    specs = (
        (bpy.data.objects["plate/heaven"], 0.1557, 0.00675),
        (bpy.data.objects["plate/heaven"], 0.1330, 0.00675),
        (bpy.data.objects["plate/heaven"], 0.1195, 0.00525),
        (bpy.data.objects["plate/generals"], 0.1010, 0.00355),
        (bpy.data.objects["plate/core"], 0.0510, 0.00315),
    )
    for index, (parent, radius, z) in enumerate(specs):
        groove = _torus(
            f"detail/ring/groove-{index:02d}",
            parent,
            "structure/heaven-ring-groove",
            index,
            radius,
            0.00028,
            (0.0, 0.0, z),
            64,
        )
        groove["visual_role"] = "ring-groove"
        groove["material_variant"] = "gold"


def _add_core_details():
    core = bpy.data.objects["plate/core"]
    points = ((-0.0227, 0.0255), (-0.0244, 0.0067), (-0.0092, 0.0053),
              (-0.0194, -0.0191), (0.0002, -0.0306), (0.0303, -0.0120), (0.0309, 0.0266))
    for index, (x, y) in enumerate(points):
        dot = add_disc(f"constellation/star-{index:02d}", 0.0028, 0.0011, (0.0, 0.0, 0.0), 0.0002)
        del dot["node_id"]
        dot.parent = core
        dot.location = (x, y, 0.0093)
        dot["visual_role"] = "beidou-star"
        dot["material_variant"] = "beidou-blue"
    for index, (start, end) in enumerate(zip(points, points[1:])):
        dx, dy = end[0] - start[0], end[1] - start[1]
        _visual_box(
            f"constellation/beidou-link-{index:02d}",
            core,
            (0.00135, math.hypot(dx, dy), 0.00082),
            ((start[0] + end[0]) / 2, (start[1] + end[1]) / 2, 0.0090),
            math.atan2(dy, dx) - math.pi / 2,
            "gold",
        )["visual_role"] = "beidou-link"
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=0.0078, location=(0.0, 0.0, 0.0))
    pearl = bpy.context.object
    pearl.name = "detail/core/jade-pivot"
    pearl.parent = core
    pearl.location = (0.0, 0.0, 0.0122)
    pearl["visual_role"] = "jade-pivot"
    pearl["material_variant"] = "pearl"


def _add_corner_pearls():
    earth = bpy.data.objects["plate/earth"]
    surface_z = earth.dimensions.z / 2 + 0.00015
    for index, (x, y) in enumerate(((-0.1342, 0.1270), (0.1189, 0.1230), (-0.1264, -0.1307), (0.1075, -0.1395))):
        seat = _torus(
            f"detail/earth/corner-pearl-seat-{index:02d}",
            earth,
            "structure/plate-pearl-seat",
            index,
            0.0132,
            0.00105,
            (x, y, surface_z + 0.00035),
            64,
        )
        seat["visual_role"] = "pearl-seat"
        seat["material_variant"] = "jade-panel"
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=48,
            ring_count=24,
            radius=0.0115,
            location=(0.0, 0.0, 0.0),
        )
        pearl = bpy.context.object
        pearl.name = f"detail/earth/corner-pearl-{index:02d}"
        pearl.parent = earth
        pearl.location = (x, y, surface_z + 0.0080)
        pearl["visual_role"] = "corner-pearl"
        pearl["material_variant"] = "pearl"
        bpy.ops.object.shade_smooth()


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
    _add_ring_dividers()
    _add_ring_craft()
    _add_core_details()
    _add_corner_pearls()
    _add_runtime_bevels()
    bpy.context.view_layer.update()
    return root
