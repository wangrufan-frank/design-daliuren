import argparse
import math
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).parent))

from daliuren_contract import BRANCHES, DIMENSIONS, POSE_IDS
from geometry import add_beveled_box, add_disc
from high_detail_geometry import upgrade_to_high_detail
from inscriptions import build_fixed_inscriptions
from materials import apply_master_materials, build_master_materials
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


def add_child_box(name, parent, size, location, bevel=0.001):
    obj = add_beveled_box(name, size, (0.0, 0.0, 0.0), bevel)
    del obj["node_id"]
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
        0.012,
    )
    add_child_box(
        "calendar/slip/body",
        calendar,
        DIMENSIONS["calendar_slip"],
        (0.0, 0.0, 0.0),
    )
    add_child_box(
        "calendar/slip/readout",
        calendar,
        (0.264, 0.020, 0.001),
        (0.0, -0.002, 0.004),
        0.0003,
    )


def add_lesson_slips(root, base_height):
    positions = {
        "fourth": (-0.176, 0.132),
        "third": (-0.176, -0.132),
        "second": (0.176, -0.132),
        "first": (0.176, 0.132),
    }
    for visual_order, (key, (x, y)) in enumerate(positions.items()):
        slip = add_beveled_box(
            f"lesson/{key}",
            DIMENSIONS["lesson_slip"],
            (x, y, base_height + 0.0185),
            0.0012,
        )
        slip["visual_order"] = visual_order
        slip["settled_location"] = tuple(slip.location)
        slip.parent = root


def add_transmission_slips(root, base_height):
    for module_order, (key, x) in enumerate(
        (("initial", -0.128), ("middle", 0.0), ("final", 0.128))
    ):
        slip = add_beveled_box(
            f"transmission/{key}",
            DIMENSIONS["transmission_slip"],
            (x, -0.205, base_height + 0.019),
            0.0012,
        )
        slip["module_order"] = module_order
        slip["settled_location"] = tuple(slip.location)
        slip.parent = root
    method = add_beveled_box(
        "transmission/method",
        DIMENSIONS["method_slip"],
        (0.0, -0.247, base_height + 0.016),
        0.0009,
    )
    method.parent = root


def add_generals(root, base_height):
    radius = 0.218
    diameter, depth = DIMENSIONS["general_inlay"]
    settled_z = base_height + DIMENSIONS["earth_plate"][2] + depth / 2
    first = None
    for index, general_key in enumerate(GENERAL_KEYS):
        angle = math.radians(90.0 - index * 30.0)
        settled_location = (
            radius * math.cos(angle),
            radius * math.sin(angle),
            settled_z,
        )
        node_id = f"general/{general_key}"
        if first is None:
            general = add_disc(node_id, diameter / 2, depth, settled_location, 0.0008)
            first = general
            first.data.name = "general/shared-inlay-mesh"
        else:
            general = bpy.data.objects.new(node_id, first.data)
            bpy.context.scene.collection.objects.link(general)
            general.location = settled_location
            general["node_id"] = node_id
        general.parent = root
        general.rotation_euler.z = angle - math.pi / 2
        general["domain"] = "general"
        general["general_key"] = general_key
        general["ring_index"] = index
        general["settled_location"] = tuple(general.location)
        general["closed_rotation_euler"] = tuple(general.rotation_euler)


def add_branch_inlays(earth, heaven):
    for surface, parent, radius, depth in (
        ("earth", earth, 0.202, 0.0012),
        ("heaven", heaven, 0.164, 0.0012),
    ):
        surface_top = parent.dimensions.z / 2
        for index, branch in enumerate(BRANCHES):
            angle = math.radians(90.0 - index * 30.0)
            inlay = add_disc(
                f"branch/{surface}/{branch}",
                0.011,
                depth,
                (
                    radius * math.cos(angle),
                    radius * math.sin(angle),
                    surface_top + depth / 2,
                ),
                0.0003,
            )
            inlay.parent = parent
            inlay["surface"] = surface
            inlay["branch"] = branch
            inlay["ring_index"] = index
            inlay["surface_treatment"] = "graybox-inlay"


def add_course_trace(earth):
    material = bpy.data.materials.get("graybox/trace-dark")
    if material is None:
        material = bpy.data.materials.new("graybox/trace-dark")
        material.diffuse_color = (0.025, 0.030, 0.028, 1.0)

    curve = bpy.data.curves.new("trace/course/curve", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = 0.00055
    curve.bevel_resolution = 2
    curve.resolution_v = 2
    curve.fill_mode = "FULL"
    spline = curve.splines.new("POLY")
    points = (
        (-0.108, 0.072, 0.0),
        (-0.042, 0.112, 0.00015),
        (0.030, 0.060, 0.0),
        (-0.012, -0.016, 0.00012),
        (0.092, -0.082, 0.0),
    )
    spline.points.add(len(points) - 1)
    surface_z = earth.dimensions.z / 2 + 0.0003
    for point, (x, y, z) in zip(spline.points, points):
        point.co = (x, y, surface_z + z, 1.0)

    trace = bpy.data.objects.new("trace/course", curve)
    bpy.context.scene.collection.objects.link(trace)
    trace.parent = earth
    trace["node_id"] = "trace/course"
    trace["surface_treatment"] = "shallow-groove"
    trace["runtime_reveal"] = True
    curve.materials.append(material)
    bpy.ops.object.select_all(action="DESELECT")
    trace.select_set(True)
    bpy.context.view_layer.objects.active = trace
    bpy.ops.object.convert(target="MESH")
    return trace


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
        DIMENSIONS["earth_plate"],
        (0.0, 0.0, base_height + DIMENSIONS["earth_plate"][2] / 2),
        0.002,
    )
    earth["fixed"] = True

    heaven_diameter, heaven_depth = DIMENSIONS["heaven_plate"]
    heaven = add_disc(
        "plate/heaven",
        heaven_diameter / 2,
        heaven_depth,
        (0.0, 0.0, base_height + DIMENSIONS["earth_plate"][2] + heaven_depth / 2),
        0.002,
    )
    heaven["closed_rotation_euler"] = tuple(heaven.rotation_euler)
    add_historical_ring(radius=0.145, z=0.087)
    parent_runtime_parts(root)
    add_calendar(root, base_height)
    add_lesson_slips(root, base_height)
    add_transmission_slips(root, base_height)
    add_generals(root, base_height)
    add_branch_inlays(earth, heaven)
    add_course_trace(earth)
    return root


def build_master():
    root = build_graybox()
    repository_root = Path(__file__).parents[2]
    font_path = repository_root / "assets/daliuren/fonts/NotoSerifCJKsc-Regular.otf"
    build_fixed_inscriptions(bpy.data.objects["plate/heaven"], font_path)
    upgrade_to_high_detail(root)
    build_master_materials()
    apply_master_materials(root)
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
    parser.add_argument("--master", action="store_true")
    return parser.parse_args(argv)


def main():
    args = parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])
    if args.master:
        build_master()
    else:
        build_graybox()
        build_pose_previews()
    if args.save:
        output = args.save.resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(output))
        label = "master" if args.master else "graybox"
        print(f"Saved {label}: {output}")


if __name__ == "__main__":
    main()
