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
LESSON_KEYS = ("first", "second", "third", "fourth")
BEVELED_RUNTIME_IDS = (
    "base/body",
    "plate/earth",
    "plate/heaven",
    "transmission/initial",
    "transmission/middle",
    "transmission/final",
    *(f"general/{key}" for key in GENERAL_KEYS),
)


def _finish_detail(obj, parent, detail_id, index, location, rotation_z=0.0):
    if "node_id" in obj:
        del obj["node_id"]
    obj.parent = parent
    obj.location = location
    obj.rotation_euler.z = rotation_z
    obj["detail_id"] = detail_id
    obj["detail_index"] = index
    obj["owner_node_id"] = parent["node_id"]
    return obj


def _box(name, parent, detail_id, index, size, location, rotation_z=0.0, bevel=0.0004):
    obj = add_beveled_box(name, size, (0.0, 0.0, 0.0), bevel)
    return _finish_detail(obj, parent, detail_id, index, location, rotation_z)


def _disc(name, parent, detail_id, index, radius, depth, location, bevel=0.00035):
    obj = add_disc(name, radius, depth, (0.0, 0.0, 0.0), bevel)
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


def _dovetail(name, parent, index):
    length = 0.132
    lower_half_width = 0.007
    upper_half_width = 0.0045
    bottom = 0.0042
    top = 0.0072
    vertices = [
        (-length / 2, -lower_half_width, bottom),
        (-length / 2, lower_half_width, bottom),
        (-length / 2, upper_half_width, top),
        (-length / 2, -upper_half_width, top),
        (length / 2, -lower_half_width, bottom),
        (length / 2, lower_half_width, bottom),
        (length / 2, upper_half_width, top),
        (length / 2, -upper_half_width, top),
    ]
    faces = (
        (0, 1, 2, 3),
        (4, 7, 6, 5),
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (3, 7, 4, 0),
    )
    mesh = bpy.data.meshes.new(f"{name}/mesh")
    mesh.from_pydata(vertices, (), faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    _finish_detail(
        obj,
        parent,
        "mechanism/lesson-dovetails",
        index,
        (0.0, 0.042, 0.0),
    )
    modifier = obj.modifiers.new(name="rail edge bevel", type="BEVEL")
    modifier.width = 0.00035
    modifier.segments = 2
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)
    return obj


def _add_runtime_bevels():
    for node_id in BEVELED_RUNTIME_IDS:
        obj = bpy.data.objects[node_id]
        modifier = obj.modifiers.new(name="high detail edge bevel", type="BEVEL")
        modifier.width = 0.0005
        modifier.segments = 3
        modifier.limit_method = "ANGLE"


def _add_base_details():
    base = bpy.data.objects["base/body"]
    wall_specs = (
        ((0.488, 0.010, 0.008), (0.0, 0.242, -0.020)),
        ((0.488, 0.010, 0.008), (0.0, -0.242, -0.020)),
        ((0.010, 0.468, 0.008), (0.242, 0.0, -0.020)),
        ((0.010, 0.468, 0.008), (-0.242, 0.0, -0.020)),
    )
    for index, (size, location) in enumerate(wall_specs):
        _box(
            f"detail/base/shell-return/{index:02d}",
            base,
            "structure/base-shell-thickness",
            index,
            size,
            location,
        )
    _box(
        "detail/base/removable-bottom",
        base,
        "structure/base-bottom-seam",
        0,
        (0.484, 0.484, 0.0012),
        (0.0, 0.0, -0.0252),
        bevel=0.0002,
    )
    for index, (x, y) in enumerate(
        ((-0.244, -0.244), (-0.244, 0.244), (0.244, -0.244), (0.244, 0.244))
    ):
        _box(
            f"detail/base/cast-corner/{index:02d}",
            base,
            "structure/base-corner-transition",
            index,
            (0.020, 0.020, 0.010),
            (x, y, -0.017),
            bevel=0.0025,
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
        (0.0, 0.0, 0.012),
        128,
    )
    for index, angle in enumerate((0.0, math.pi / 4, math.pi / 2, 3 * math.pi / 4)):
        _box(
            f"detail/heaven/support-rib/{index:02d}",
            heaven,
            "structure/heaven-support-rib",
            index,
            (0.118, 0.006, 0.0012),
            (0.0, 0.0, 0.0122),
            rotation_z=angle,
            bevel=0.0003,
        )
    _disc(
        "detail/heaven/center-bearing",
        heaven,
        "mechanism/heaven-bearing",
        0,
        0.018,
        0.004,
        (0.0, 0.0, 0.014),
    )
    for index in range(12):
        angle = math.radians(90.0 - index * 30.0)
        detent_location = (0.173 * math.cos(angle), 0.173 * math.sin(angle), 0.013)
        inlay_location = (0.155 * math.cos(angle), 0.155 * math.sin(angle), 0.0124)
        _disc(
            f"detail/heaven/detent/{index:02d}",
            heaven,
            "mechanism/heaven-detent",
            index,
            0.003,
            0.0018,
            detent_location,
            0.00025,
        )
        _box(
            f"detail/heaven/inlay-bed/{index:02d}",
            heaven,
            "structure/heaven-inlay-bed",
            index,
            (0.020, 0.010, 0.0006),
            inlay_location,
            rotation_z=angle - math.pi / 2,
            bevel=0.0002,
        )
        _torus(
            f"detail/heaven/contact-seam/{index:02d}",
            heaven,
            "structure/bronze-celadon-contact-seam",
            index,
            0.008,
            0.0006,
            (inlay_location[0], inlay_location[1], 0.0129),
            32,
        )


def _add_lesson_details():
    for index, lesson in enumerate(LESSON_KEYS):
        owner = bpy.data.objects[f"lesson/{lesson}"]
        stop_x = 0.071 * owner["motion_axis"][0]
        _dovetail(f"detail/lesson/{lesson}/dovetail", owner, index)
        _box(
            f"detail/lesson/{lesson}/end-stop",
            owner,
            "mechanism/lesson-end-stop",
            index,
            (0.008, 0.082, 0.006),
            (stop_x, 0.0, 0.004),
            bevel=0.0006,
        )
        _box(
            f"detail/lesson/{lesson}/readout-bed",
            owner,
            "mechanism/lesson-readout-bed",
            index,
            (0.132, 0.078, 0.0014),
            (0.0, 0.0, 0.0043),
            bevel=0.0003,
        )
        _torus(
            f"detail/lesson/{lesson}/general-socket",
            owner,
            "mechanism/lesson-general-socket",
            index,
            0.009,
            0.001,
            (0.058, 0.0, 0.0065),
            32,
        )


def _add_bridge_details():
    bridge = bpy.data.objects["transmission/bridge"]
    _box(
        "detail/bridge/support-body",
        bridge,
        "structure/bridge-support",
        0,
        (0.404, 0.040, 0.004),
        (0.0, 0.0, -0.005),
        bevel=0.0006,
    )
    for index, x in enumerate((-0.140, 0.0, 0.140)):
        _box(
            f"detail/bridge/direction-tenon/{index:02d}",
            bridge,
            "mechanism/transmission-tenon",
            index,
            (0.026, 0.014, 0.006),
            (x, -0.021, 0.003),
            bevel=0.0005,
        )
    _box(
        "detail/bridge/front-stop",
        bridge,
        "mechanism/bridge-stops",
        0,
        (0.392, 0.006, 0.008),
        (0.0, -0.025, 0.002),
        bevel=0.0005,
    )


def _add_general_details():
    earth = bpy.data.objects["plate/earth"]
    _torus(
        "detail/general/recessed-chain-track",
        earth,
        "mechanism/general-track",
        0,
        0.218,
        0.003,
        (0.0, 0.0, 0.006),
        128,
    )
    for index, key in enumerate(GENERAL_KEYS):
        owner = bpy.data.objects[f"general/{key}"]
        _disc(
            f"detail/general/{key}/top-seal-interface",
            owner,
            "mechanism/general-seal-interface",
            index,
            0.009,
            0.0016,
            (0.0, 0.0, 0.0072),
            0.0003,
        )


def upgrade_to_high_detail(root):
    if root.get("node_id") != "artifact/root":
        raise ValueError("High-detail upgrade requires artifact/root")
    if any("detail_id" in obj for obj in bpy.data.objects):
        raise RuntimeError("Artifact is already upgraded to high detail")

    _add_runtime_bevels()
    _add_base_details()
    _add_heaven_details()
    _add_lesson_details()
    _add_bridge_details()
    _add_general_details()
    bpy.context.view_layer.update()
    return root
