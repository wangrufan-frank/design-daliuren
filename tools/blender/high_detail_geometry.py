import math
from pathlib import Path

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


def _visual_box(name, parent, size, location, rotation_z=0.0, variant="jade"):
    obj = add_beveled_box(name, size, (0.0, 0.0, 0.0), min(size) * 0.18)
    del obj["node_id"]
    obj.parent = parent
    obj.location = location
    obj.rotation_euler.z = rotation_z
    obj["visual_role"] = name.split("/")[1]
    obj["material_variant"] = variant
    return obj


def _visual_text(name, text, parent, font, location, rotation_z, variant):
    curve = bpy.data.curves.new(f"{name}/curve", "FONT")
    curve.body = text
    curve.font = font
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.size = 0.023
    curve.extrude = 0.00045
    curve.bevel_depth = 0.00012
    curve.resolution_u = 3
    obj = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    obj.rotation_euler.z = rotation_z
    obj["visual_role"] = "zodiac-glyph"
    obj["material_variant"] = variant
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)
    return obj


def _add_zodiac_gallery():
    earth = bpy.data.objects["plate/earth"]
    font_path = Path(__file__).parents[2] / "assets/daliuren/fonts/STKaiti.ttf"
    if not font_path.is_file():
        font_path = Path(__file__).parents[2] / "assets/daliuren/fonts/NotoSerifCJKsc-Regular.otf"
    font = bpy.data.fonts.load(str(font_path), check_existing=True)
    animals = tuple("鼠牛虎兔龙蛇马羊猴鸡狗猪")
    variants = (
        "zodiac-blue", "zodiac-gold", "zodiac-gold", "zodiac-red",
        "zodiac-blue", "zodiac-green", "zodiac-red", "zodiac-blue",
        "zodiac-gold", "zodiac-green", "zodiac-gold", "zodiac-red",
    )
    for index, (animal, variant) in enumerate(zip(animals, variants)):
        angle = math.radians(90 - index * 30)
        x, y = 0.232 * math.cos(angle), 0.232 * math.sin(angle)
        rotation = angle - math.pi / 2
        _visual_box(
            f"zodiac/{index:02d}/gold-frame",
            earth,
            (0.056, 0.038, 0.0020),
            (x, y, 0.0080),
            rotation,
            "gold",
        )
        _visual_box(
            f"zodiac/{index:02d}/jade-panel",
            earth,
            (0.051, 0.033, 0.0013),
            (x, y, 0.0093),
            rotation,
            "jade-panel",
        )
        _visual_text(
            f"zodiac/{index:02d}/glyph",
            animal,
            earth,
            font,
            (x, y, 0.0101),
            rotation,
            variant,
        )


def _add_ring_dividers():
    specs = (
        (bpy.data.objects["plate/heaven"], (0.174, 0.141), 0.0132),
        (bpy.data.objects["plate/generals"], (0.124, 0.073), 0.0092),
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
        dot["visual_role"] = "constellation-star"
        dot["material_variant"] = "gold"
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=0.0065, location=(0.0, 0.0, 0.0))
    pearl = bpy.context.object
    pearl.name = "detail/core/jade-pivot"
    pearl.parent = core
    pearl.location = (0.0, 0.0, 0.0135)
    pearl["visual_role"] = "jade-pivot"
    pearl["material_variant"] = "pearl"


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
    _add_zodiac_gallery()
    _add_ring_dividers()
    _add_core_details()
    _add_runtime_bevels()
    bpy.context.view_layer.update()
    return root
