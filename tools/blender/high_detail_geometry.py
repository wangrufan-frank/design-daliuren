import math

import bpy

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

ZODIAC_LAYOUT = (
    ("snake", (-0.140, 0.210), (0.120, 0.070)),
    ("horse", (0.000, 0.210), (0.120, 0.070)),
    ("goat", (0.140, 0.210), (0.120, 0.070)),
    ("monkey", (0.210, 0.105), (0.070, 0.120)),
    ("rooster", (0.210, 0.000), (0.070, 0.120)),
    ("dog", (0.210, -0.105), (0.070, 0.120)),
    ("pig", (0.140, -0.210), (0.120, 0.070)),
    ("rat", (0.000, -0.210), (0.120, 0.070)),
    ("ox", (-0.140, -0.210), (0.120, 0.070)),
    ("tiger", (-0.210, -0.105), (0.070, 0.120)),
    ("rabbit", (-0.210, 0.000), (0.070, 0.120)),
    ("dragon", (-0.210, 0.105), (0.070, 0.120)),
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
        0.163,
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


def _zodiac_box(name, parent, index, animal, size, location, role, variant):
    obj = add_beveled_box(name, size, (0.0, 0.0, 0.0), 0.00065)
    del obj["node_id"]
    obj.parent = parent
    obj.location = location
    obj["visual_role"] = role
    obj["zodiac_index"] = index
    obj["zodiac_animal"] = animal
    obj["material_variant"] = variant
    return obj


def _zodiac_cloud(name, parent, index, animal, center, panel_size):
    curve = bpy.data.curves.new(f"{name}/curve", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = 0.00025
    curve.bevel_resolution = 3
    curve.fill_mode = "FULL"
    spline = curve.splines.new("POLY")
    length = min(panel_size) * 0.38
    points = ((-length, 0.0), (-length * 0.38, length * 0.25),
              (0.0, -length * 0.10), (length * 0.36, length * 0.28),
              (length, 0.0))
    spline.points.add(len(points) - 1)
    for point, (x, y) in zip(spline.points, points):
        point.co = (x, y, 0.0, 1.0)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = (center[0], center[1] - panel_size[1] * 0.28, 0.00320)
    obj["visual_role"] = "zodiac-cloud-relief"
    obj["zodiac_index"] = index
    obj["zodiac_animal"] = animal
    obj["material_variant"] = "gold"
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)
    return obj


def _add_zodiac_gallery():
    earth = bpy.data.objects["plate/earth"]
    for index, (animal, center, panel_size) in enumerate(ZODIAC_LAYOUT):
        _zodiac_box(
            f"zodiac/{index:02d}/panel-frame", earth, index, animal,
            (panel_size[0] + 0.003, panel_size[1] + 0.003, 0.00020),
            (*center, 0.00285), "zodiac-panel-frame", "gold",
        )
        _zodiac_box(
            f"zodiac/{index:02d}/panel-recess", earth, index, animal,
            (*panel_size, 0.00015), (*center, 0.00282),
            "zodiac-panel-recess", "jade-recess",
        )
        _zodiac_box(
            f"zodiac/{index:02d}/animal-relief", earth, index, animal,
            (panel_size[0] * 0.985, panel_size[1] * 0.985, 0.00010),
            (*center, 0.00290), "zodiac-animal-relief", f"zodiac-motif-{animal}",
        )
        _zodiac_cloud(
            f"zodiac/{index:02d}/cloud-relief", earth, index, animal, center, panel_size
        )


def _add_ring_dividers():
    specs = (
        (bpy.data.objects["plate/heaven"], (0.164, 0.126), 0.0052),
        (bpy.data.objects["plate/generals"], (0.108, 0.064), 0.0037),
    )
    for parent, (outer_radius, inner_radius), z in specs:
        length = outer_radius - inner_radius
        center_radius = (outer_radius + inner_radius) / 2
        for index in range(12):
            angle = math.radians(90 - index * 30)
            _visual_box(
                f"divider/{parent.name.rsplit('/', 1)[-1]}/{index:02d}",
                parent,
                (0.00075, length, 0.00055),
                (center_radius * math.cos(angle), center_radius * math.sin(angle), z),
                angle - math.pi / 2,
                "gold",
            )


def _add_core_details():
    core = bpy.data.objects["plate/core"]
    points = ((-0.042, 0.026), (-0.026, 0.006), (-0.012, 0.018),
              (-0.020, -0.014), (0.006, -0.030), (0.039, -0.021), (0.047, 0.021))
    for index, (x, y) in enumerate(points):
        dot = add_disc(f"constellation/star-{index:02d}", 0.0023, 0.0010, (0.0, 0.0, 0.0), 0.0002)
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
            (0.00115, math.hypot(dx, dy), 0.00075),
            ((start[0] + end[0]) / 2, (start[1] + end[1]) / 2, 0.0090),
            math.atan2(dy, dx) - math.pi / 2,
            "gold",
        )["visual_role"] = "beidou-link"
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=0.0065, location=(0.0, 0.0, 0.0))
    pearl = bpy.context.object
    pearl.name = "detail/core/jade-pivot"
    pearl.parent = core
    pearl.location = (0.0, 0.0, 0.0135)
    pearl["visual_role"] = "jade-pivot"
    pearl["material_variant"] = "pearl"


def _add_corner_pearls():
    earth = bpy.data.objects["plate/earth"]
    surface_z = earth.dimensions.z / 2 + 0.00015
    for index, (x, y) in enumerate(((-0.158, 0.158), (0.158, 0.158), (-0.158, -0.158), (0.158, -0.158))):
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
    _add_core_details()
    _add_zodiac_gallery()
    _add_corner_pearls()
    _add_runtime_bevels()
    bpy.context.view_layer.update()
    return root
