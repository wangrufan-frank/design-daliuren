import argparse
import math
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).parent))

from daliuren_contract import DIMENSIONS, POSE_IDS
from geometry import add_beveled_box, add_disc
from poses import apply_pose


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


def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    for collection in list(bpy.data.collections):
        if collection.name.startswith("pose-preview/"):
            bpy.data.collections.remove(collection)


def configure_scene_units():
    units = bpy.context.scene.unit_settings
    units.system = "METRIC"
    units.length_unit = "MILLIMETERS"
    units.scale_length = 1.0


def new_empty(node_id, location):
    obj = bpy.data.objects.new(node_id, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj["node_id"] = node_id
    return obj


def new_helper_empty(name, parent, location=(0.0, 0.0, 0.0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    return obj


def add_child_box(name, parent, size, location, bevel=0.001):
    obj = add_beveled_box(name, size, (0.0, 0.0, 0.0), bevel)
    del obj["node_id"]
    obj.parent = parent
    obj.location = location
    return obj


def add_runtime_child_box(node_id, parent, size, location, bevel=0.001):
    obj = add_beveled_box(node_id, size, (0.0, 0.0, 0.0), bevel)
    obj.parent = parent
    obj.location = location
    return obj


def configure_motion(obj, closed_location, motion_axis, travel_m):
    open_location = tuple(
        coordinate + axis * travel_m
        for coordinate, axis in zip(closed_location, motion_axis)
    )
    obj.location = closed_location
    obj["closed_location"] = closed_location
    obj["open_location"] = open_location
    obj["motion_axis"] = motion_axis
    obj["travel_m"] = travel_m
    obj["closed_rotation_euler"] = tuple(obj.rotation_euler)


def add_historical_ring(radius, z):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=radius,
        minor_radius=0.003,
        major_segments=128,
        minor_segments=12,
        location=(0.0, 0.0, z),
    )
    ring = bpy.context.object
    ring.name = "reference/historical-ring"
    ring["role"] = "fixed-historical-inscription"
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return ring


def parent_runtime_parts(root):
    for obj in bpy.context.scene.objects:
        if obj is not root and "node_id" in obj:
            obj.parent = root


def add_calendar(root, base_height):
    calendar = new_empty("calendar/slip", (0.0, 0.0, 0.0))
    calendar.parent = root
    configure_motion(
        calendar,
        (0.0, 0.238, base_height + 0.008),
        (0.0, 0.0, 1.0),
        DIMENSIONS["slip_rise"],
    )
    add_child_box(
        "calendar/slip/body",
        calendar,
        (0.300, 0.032, 0.008),
        (0.0, 0.0, 0.0),
    )
    add_child_box(
        "calendar/slip/readout",
        calendar,
        (0.264, 0.020, 0.004),
        (0.0, -0.002, 0.006),
        0.0008,
    )


def add_lessons(root, base_height):
    layout = (
        ("fourth", 0, (-0.184, 0.110, base_height + 0.006), (-1.0, 0.0, 0.0)),
        ("third", 1, (-0.184, -0.110, base_height + 0.006), (-1.0, 0.0, 0.0)),
        ("second", 2, (0.184, -0.110, base_height + 0.006), (1.0, 0.0, 0.0)),
        ("first", 3, (0.184, 0.110, base_height + 0.006), (1.0, 0.0, 0.0)),
    )
    lesson_width, lesson_depth = DIMENSIONS["lesson"]
    for lesson, visual_order, closed_location, motion_axis in layout:
        lesson_id = f"lesson/{lesson}"
        lesson_root = new_empty(lesson_id, (0.0, 0.0, 0.0))
        lesson_root.parent = root
        lesson_root["visual_order"] = visual_order
        configure_motion(
            lesson_root,
            closed_location,
            motion_axis,
            DIMENSIONS["lesson_travel"],
        )
        add_child_box(
            f"{lesson_id}/body",
            lesson_root,
            (lesson_width, lesson_depth, 0.008),
            (0.0, 0.0, 0.0),
        )
        for readout, local_y in (("upper", 0.024), ("lower", -0.024)):
            add_child_box(
                f"{lesson_id}/readout/{readout}",
                lesson_root,
                (0.124, 0.034, 0.006),
                (0.0, local_y, DIMENSIONS["lesson_readout_rise"]),
                0.0008,
            )
        new_helper_empty(
            f"{lesson_id}/socket/general",
            lesson_root,
            (0.058, 0.0, 0.012),
        )


def add_transmission_bridge(root, base_height):
    bridge = new_empty("transmission/bridge", (0.0, 0.0, 0.0))
    bridge.parent = root
    configure_motion(
        bridge,
        (0.0, -0.232, base_height + 0.006),
        (0.0, -1.0, 0.0),
        DIMENSIONS["bridge_travel"],
    )
    add_child_box(
        "transmission/bridge/body",
        bridge,
        (DIMENSIONS["bridge_width"], 0.048, 0.008),
        (0.0, 0.0, 0.0),
    )
    for module_order, (module, local_x) in enumerate(
        (("initial", -0.140), ("middle", 0.0), ("final", 0.140))
    ):
        obj = add_runtime_child_box(
            f"transmission/{module}",
            bridge,
            (0.112, 0.038, 0.010),
            (local_x, 0.0, 0.009),
        )
        obj["module_order"] = module_order


def add_generals(root, base_height):
    radius = 0.218
    closed_z = base_height + 0.007
    first = None
    for index, general_key in enumerate(GENERAL_KEYS):
        angle = math.radians(90.0 - index * 30.0)
        closed_location = (
            radius * math.cos(angle),
            radius * math.sin(angle),
            closed_z,
        )
        node_id = f"general/{general_key}"
        if first is None:
            general = add_disc(node_id, 0.012, 0.014, closed_location, 0.001)
            first = general
            first.data.name = "general/shared-seal-mesh"
        else:
            general = bpy.data.objects.new(node_id, first.data)
            bpy.context.scene.collection.objects.link(general)
            general.location = closed_location
            general["node_id"] = node_id
        general.parent = root
        general.rotation_euler.z = angle - math.pi / 2
        general["domain"] = "general"
        general["general_key"] = general_key
        general["ring_index"] = index
        configure_motion(
            general,
            closed_location,
            (0.0, 0.0, 1.0),
            DIMENSIONS["general_rise"],
        )


def add_course_copy_anchors(root):
    for domain, location in (
        ("lessons", (-0.185, 0.0, 0.125)),
        ("transmissions", (0.0, -0.185, 0.125)),
        ("generals", (0.185, 0.0, 0.125)),
    ):
        anchor = new_empty(f"anchor/course-copy/{domain}", location)
        anchor.parent = root


def build_graybox():
    clear_scene()
    configure_scene_units()
    root = new_empty("artifact/root", (0.0, 0.0, 0.0))

    base_height = DIMENSIONS["base"][2]
    add_beveled_box(
        "base/body",
        DIMENSIONS["base"],
        (0.0, 0.0, base_height / 2),
        0.004,
    )
    earth = add_beveled_box(
        "plate/earth",
        (0.440, 0.440, 0.010),
        (0.0, 0.0, base_height + 0.005),
        0.002,
    )
    earth["fixed"] = True

    heaven_diameter, heaven_depth = DIMENSIONS["heaven_plate"]
    heaven = add_disc(
        "plate/heaven",
        heaven_diameter / 2,
        heaven_depth,
        (0.0, 0.0, 0.074),
        0.002,
    )
    heaven["closed_rotation_euler"] = tuple(heaven.rotation_euler)
    add_historical_ring(radius=0.145, z=0.087)
    parent_runtime_parts(root)
    add_calendar(root, base_height)
    add_lessons(root, base_height)
    add_transmission_bridge(root, base_height)
    add_generals(root, base_height)
    add_course_copy_anchors(root)
    return root


def build_pose_previews():
    for collection in list(bpy.data.collections):
        if collection.name.startswith("pose-preview/"):
            for obj in list(collection.objects):
                bpy.data.objects.remove(obj, do_unlink=True)
            bpy.data.collections.remove(collection)

    physical_meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    preview_collections = []
    for pose_id in POSE_IDS:
        apply_pose(pose_id)
        collection = bpy.data.collections.new(f"pose-preview/{pose_id}")
        bpy.context.scene.collection.children.link(collection)
        collection["pose_id"] = pose_id
        collection.hide_viewport = pose_id != "closed"
        collection.hide_render = pose_id != "closed"
        preview_collections.append(collection)

        for source in physical_meshes:
            preview = source.copy()
            preview.data = source.data
            preview.name = f"preview/{pose_id}/{source.name}"
            preview.hide_viewport = False
            preview.hide_render = False
            for key in list(preview.keys()):
                del preview[key]
            world_matrix = source.matrix_world.copy()
            preview.parent = None
            preview.matrix_world = world_matrix
            collection.objects.link(preview)

    for source in physical_meshes:
        source.hide_viewport = True
        source.hide_render = True
    apply_pose("closed")
    return tuple(preview_collections)


def parse_args(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("--save", type=Path)
    return parser.parse_args(argv)


def main():
    args = parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])
    build_graybox()
    build_pose_previews()
    if args.save:
        output = args.save.resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(output))
        print(f"Saved graybox: {output}")


if __name__ == "__main__":
    main()
