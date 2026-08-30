import argparse
import math
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).parent))

from daliuren_contract import DIMENSIONS, POSE_IDS
from geometry import add_beveled_box, add_disc
from high_detail_geometry import upgrade_to_high_detail
from inscriptions import FUNCTIONAL_ROLES, HISTORICAL_ROLES, build_fixed_inscriptions
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


def add_shallow_seat(name, parent, slip, world_z):
    seat = add_beveled_box(
        name,
        (slip.dimensions.x + 0.008, slip.dimensions.y + 0.008, 0.001),
        (slip.location.x, slip.location.y, world_z),
        0.0002,
    )
    del seat["node_id"]
    world_matrix = seat.matrix_world.copy()
    seat.parent = parent
    seat.matrix_world = world_matrix
    seat["material_variant"] = "ink-bronze"
    seat["surface_treatment"] = "shallow-slot"
    return seat


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
    calendar.rotation_euler.x = math.radians(10.0)
    configure_motion(
        calendar,
        (0.0, 0.238, base_height + 0.024),
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

    base = bpy.data.objects["base/body"]
    for side, x in (("left", -0.110), ("right", 0.110)):
        seat = add_beveled_box(
            f"detail/calendar/seat-{side}",
            (0.048, 0.044, 0.016),
            (x, 0.238, base_height + 0.008),
            0.0015,
        )
        del seat["node_id"]
        world_matrix = seat.matrix_world.copy()
        seat.parent = base
        seat.matrix_world = world_matrix
        seat["surface_treatment"] = "rear-slip-seat"


def add_lesson_slips(root, earth, base_height):
    positions = {
        "fourth": (-0.181, 0.167),
        "third": (-0.181, -0.167),
        "second": (0.181, -0.167),
        "first": (0.181, 0.167),
    }
    for visual_order, (key, (x, y)) in enumerate(positions.items()):
        slip = add_beveled_box(
            f"lesson/{key}",
            DIMENSIONS["lesson_slip"],
            (x, y, base_height + 0.018),
            0.0012,
        )
        slip["visual_order"] = visual_order
        slip["settled_location"] = tuple(slip.location)
        slip.parent = root
        add_shallow_seat(
            f"detail/slip-seat/lesson/{key}",
            earth,
            slip,
            base_height + DIMENSIONS["earth_plate"][2] + 0.0001,
        )


def add_transmission_slips(root, base, earth, base_height):
    for module_order, (key, x) in enumerate(
        (("initial", -0.096), ("middle", 0.0), ("final", 0.096))
    ):
        slip = add_beveled_box(
            f"transmission/{key}",
            DIMENSIONS["transmission_slip"],
            (x, -0.194, base_height + 0.0185),
            0.0012,
        )
        slip["module_order"] = module_order
        slip["settled_location"] = tuple(slip.location)
        slip.parent = root
        add_shallow_seat(
            f"detail/slip-seat/transmission/{key}",
            earth,
            slip,
            base_height + DIMENSIONS["earth_plate"][2] + 0.0001,
        )
    method = add_beveled_box(
        "transmission/method",
        DIMENSIONS["method_slip"],
        (0.0, -0.238, base_height + 0.0045),
        0.0009,
    )
    method.parent = root
    add_shallow_seat(
        "detail/slip-seat/transmission/method",
        base,
        method,
        base_height + 0.0001,
    )


def add_generals(base):
    diameter, depth = DIMENSIONS["general_inlay"]
    settled_z = base.dimensions.z / 2 + depth / 2
    first = None
    for index, general_key in enumerate(GENERAL_KEYS):
        angle = math.radians(90.0 - index * 30.0)
        direction = (math.cos(angle), math.sin(angle))
        scale = 0.240 / max(abs(direction[0]), abs(direction[1]))
        settled_location = (
            direction[0] * scale,
            direction[1] * scale,
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
        general.parent = base
        general.rotation_euler.z = angle - math.pi / 2
        general["domain"] = "general"
        general["general_key"] = general_key
        general["ring_index"] = index
        general["settled_location"] = tuple(general.location)
        general["closed_rotation_euler"] = tuple(general.rotation_euler)


def _add_course_curve_mesh(name, z, bevel_depth):
    curve = bpy.data.curves.new(f"{name}/curve", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = bevel_depth
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
    for point, (x, y, offset_z) in zip(spline.points, points):
        point.co = (x, y, z + offset_z, 1.0)

    obj = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    return obj


def add_course_trace(earth):
    material = bpy.data.materials.get("graybox/trace-dark")
    if material is None:
        material = bpy.data.materials.new("graybox/trace-dark")
        material.diffuse_color = (0.025, 0.030, 0.028, 1.0)

    earth_top = earth.location.z + earth.dimensions.z / 2
    cutter = _add_course_curve_mesh("trace/course-groove-cutter", earth_top - 0.00075, 0.0011)
    groove = earth.modifiers.new(name="course groove", type="BOOLEAN")
    groove.operation = "DIFFERENCE"
    groove.solver = "EXACT"
    groove.object = cutter
    bpy.context.view_layer.objects.active = earth
    bpy.ops.object.modifier_apply(modifier=groove.name)
    cutter_mesh = cutter.data
    bpy.data.objects.remove(cutter, do_unlink=True)
    if cutter_mesh.users == 0:
        bpy.data.meshes.remove(cutter_mesh)

    trace = _add_course_curve_mesh("trace/course", earth_top - 0.001, 0.00065)
    world_matrix = trace.matrix_world.copy()
    trace.parent = earth
    trace.matrix_world = world_matrix
    trace["node_id"] = "trace/course"
    trace["surface_treatment"] = "recessed-groove"
    trace["runtime_reveal"] = True
    trace.data.materials.append(material)
    return trace


def build_graybox():
    clear_scene()
    configure_scene_units()
    root = new_empty("artifact/root", (0.0, 0.0, 0.0))

    base_height = DIMENSIONS["base"][2]
    base = add_beveled_box(
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
    add_lesson_slips(root, earth, base_height)
    add_transmission_slips(root, base, earth, base_height)
    add_generals(base)
    add_course_trace(earth)
    repository_root = Path(__file__).parents[2]
    font_path = repository_root / "assets/daliuren/fonts/NotoSerifCJKsc-Regular.otf"
    build_fixed_inscriptions(earth, heaven, font_path, roles=FUNCTIONAL_ROLES)
    return root


def build_master():
    root = build_graybox()
    repository_root = Path(__file__).parents[2]
    font_path = repository_root / "assets/daliuren/fonts/NotoSerifCJKsc-Regular.otf"
    build_fixed_inscriptions(
        bpy.data.objects["plate/earth"],
        bpy.data.objects["plate/heaven"],
        font_path,
        roles=HISTORICAL_ROLES,
    )
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
            preview.hide_viewport = source.hide_viewport
            preview.hide_render = source.hide_render
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
