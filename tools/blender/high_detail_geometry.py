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


def _cutter_box(name, parent, size, location, rotation_z=0.0):
    bpy.ops.mesh.primitive_cube_add(location=(0.0, 0.0, 0.0))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.parent = parent
    obj.location = location
    obj.rotation_euler.z = rotation_z
    return obj


def _cutter_disc(name, parent, radius, depth, location):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=48,
        radius=radius,
        depth=depth,
        location=(0.0, 0.0, 0.0),
    )
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.location = location
    return obj


def _cutter_torus(name, parent, major_radius, minor_radius, location, segments=48):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=segments,
        minor_segments=8,
        location=(0.0, 0.0, 0.0),
    )
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.location = location
    return obj


def _apply_cutters(target, cutters, label):
    bpy.ops.object.select_all(action="DESELECT")
    for cutter in cutters:
        cutter.select_set(True)
    bpy.context.view_layer.objects.active = cutters[0]
    if len(cutters) > 1:
        bpy.ops.object.join()
    combined = bpy.context.view_layer.objects.active
    combined.name = f"cutter/{label}"

    bpy.ops.object.select_all(action="DESELECT")
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    modifier = target.modifiers.new(name=f"cut {label}", type="BOOLEAN")
    modifier.operation = "DIFFERENCE"
    modifier.solver = "EXACT"
    modifier.object = combined
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(combined, do_unlink=True)


def _readout_bed(name, parent, index):
    bed_x = -0.065 * parent["motion_axis"][0]
    return _box(
        name,
        parent,
        "mechanism/lesson-readout-bed",
        index,
        (0.004, 0.086, 0.0008),
        (bed_x, 0.0, 0.0038),
        bevel=0.00015,
    )


def _dovetail(name, parent, index):
    length = 0.132
    lower_half_width = 0.007
    upper_half_width = 0.0045
    bottom = 0.0035
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
        (0.0, 0.048, 0.0),
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
        ((0.488, 0.008, 0.0008), (0.0, 0.256, -0.0260)),
        ((0.488, 0.008, 0.0008), (0.0, -0.256, -0.0260)),
        ((0.008, 0.488, 0.0008), (0.256, 0.0, -0.0260)),
        ((0.008, 0.488, 0.0008), (-0.256, 0.0, -0.0260)),
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
        (0.0, 0.0, -0.0260),
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
            (x, y, -0.0259),
            bevel=0.0003,
        )


def _add_heaven_details():
    heaven = bpy.data.objects["plate/heaven"]
    detent_cutters = []
    inlay_cutters = []
    seam_cutters = []
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
        detent_location = (0.173 * math.cos(angle), 0.173 * math.sin(angle), 0.0108)
        inlay_location = (0.155 * math.cos(angle), 0.155 * math.sin(angle), 0.0108)
        _disc(
            f"detail/heaven/detent/{index:02d}",
            heaven,
            "mechanism/heaven-detent",
            index,
            0.0025,
            0.0004,
            detent_location,
            0.00025,
        )
        _box(
            f"detail/heaven/inlay-bed/{index:02d}",
            heaven,
            "structure/heaven-inlay-bed",
            index,
            (0.018, 0.008, 0.0004),
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
            0.0004,
            (inlay_location[0], inlay_location[1], 0.0109),
            32,
        )
        detent_cutters.append(
            _cutter_disc(
                f"cutter/heaven/detent/{index:02d}",
                heaven,
                0.0032,
                0.0023,
                (detent_location[0], detent_location[1], 0.0114),
            )
        )
        inlay_cutters.append(
            _cutter_box(
                f"cutter/heaven/inlay/{index:02d}",
                heaven,
                (0.021, 0.011, 0.0023),
                (inlay_location[0], inlay_location[1], 0.0114),
                angle - math.pi / 2,
            )
        )
        seam_cutters.append(
            _cutter_torus(
                f"cutter/heaven/contact-seam/{index:02d}",
                heaven,
                0.008,
                0.001,
                (inlay_location[0], inlay_location[1], 0.0114),
                32,
            )
        )
    _apply_cutters(heaven, detent_cutters, "heaven-detents")
    _apply_cutters(heaven, inlay_cutters, "heaven-inlay-beds")
    _apply_cutters(heaven, seam_cutters, "heaven-contact-seams")


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
        _readout_bed(f"detail/lesson/{lesson}/readout-bed", owner, index)
        _torus(
            f"detail/lesson/{lesson}/general-socket",
            owner,
            "mechanism/lesson-general-socket",
            index,
            0.009,
            0.001,
            (0.058, 0.0, 0.0042),
            32,
        )


def _add_bridge_details():
    bridge = bpy.data.objects["transmission/bridge"]
    _box(
        "detail/bridge/support-body",
        bridge,
        "structure/bridge-support",
        0,
        (0.404, 0.010, 0.004),
        (0.0, -0.018, -0.005),
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
    track_cutter = _cutter_torus(
        "cutter/general/recessed-chain-track",
        earth,
        0.218,
        0.0035,
        (0.0, 0.0, 0.0045),
        128,
    )
    _torus(
        "detail/general/recessed-chain-track",
        earth,
        "mechanism/general-track",
        0,
        0.218,
        0.002,
        (0.0, 0.0, 0.0024),
        128,
    )
    _apply_cutters(earth, [track_cutter], "general-chain-track")
    for index, key in enumerate(GENERAL_KEYS):
        owner = bpy.data.objects[f"general/{key}"]
        _disc(
            f"detail/general/{key}/top-seal-interface",
            owner,
            "mechanism/general-seal-interface",
            index,
            0.003,
            0.0012,
            (0.0, -0.008, 0.0067),
            0.0003,
        )


def upgrade_to_high_detail(root):
    if root.get("node_id") != "artifact/root":
        raise ValueError("High-detail upgrade requires artifact/root")
    if any("detail_id" in obj for obj in bpy.data.objects):
        raise RuntimeError("Artifact is already upgraded to high detail")

    _add_base_details()
    _add_heaven_details()
    _add_lesson_details()
    _add_bridge_details()
    _add_general_details()
    _add_runtime_bevels()
    bpy.context.view_layer.update()
    return root
