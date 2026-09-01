import argparse
import math
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).parent))

from daliuren_contract import (
    DIAL_CENTER_OFFSET_M,
    DIMENSIONS,
    GENERAL_ANGULAR_CLEARANCE_DEG,
    GENERAL_INLAY_DEPTH_M,
    GENERAL_INLAY_HALF_ANGLE_RAD,
    GENERAL_RADIAL_CLEARANCE_M,
    GENERAL_SECTOR_ANGLE_DEG,
    GENERAL_SECTOR_INNER_RADIUS,
    GENERAL_SECTOR_OUTER_RADIUS,
    MONTH_GENERAL_RADIUS_M,
    POSE_IDS,
    VISUAL_EARTH_ORDER,
    VISUAL_MONTH_ORDER,
    visual_angle,
)
from geometry import add_annular_sector, add_beveled_box, add_disc, add_ring
from high_detail_geometry import upgrade_to_high_detail
from inscriptions import HISTORICAL_ROLES, build_fixed_inscriptions
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
GENERAL_NAMES = (
    "贵人", "螣蛇", "朱雀", "六合", "勾陈", "青龙",
    "天空", "白虎", "太常", "玄武", "太阴", "天后",
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
    ring.hide_render = True
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
        (0.0, 0.238, 0.008),
        (0.0, 0.0, 1.0),
        0.012,
    )
    add_child_box(
        "calendar/slip/body",
        calendar,
        DIMENSIONS["calendar_slip"],
        (0.0, 0.0, 0.0),
    )
    readout = add_child_box(
        "calendar/slip/readout",
        calendar,
        (0.264, 0.020, 0.001),
        (0.0, -0.002, 0.004),
        0.0,
    )
    readout["material_variant"] = "jade-recess"

    base = bpy.data.objects["base/body"]
    for side, x in (("left", -0.110), ("right", 0.110)):
        seat = add_beveled_box(
            f"detail/calendar/seat-{side}",
            (0.048, 0.044, 0.016),
            (x, 0.238, 0.012),
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
            (x, y, 0.010),
            0.0012,
        )
        slip["visual_order"] = visual_order
        slip["settled_location"] = tuple(slip.location)
        slip.parent = root
        add_shallow_seat(
            f"detail/slip-seat/lesson/{key}",
            earth,
            slip,
            base_height - 0.001,
        )


def add_transmission_slips(root, base, earth, base_height):
    for module_order, (key, x) in enumerate(
        (("initial", -0.096), ("middle", 0.0), ("final", 0.096))
    ):
        slip = add_beveled_box(
            f"transmission/{key}",
            DIMENSIONS["transmission_slip"],
            (x, -0.194, 0.010),
            0.0012,
        )
        slip["module_order"] = module_order
        slip["settled_location"] = tuple(slip.location)
        slip.parent = root
        add_shallow_seat(
            f"detail/slip-seat/transmission/{key}",
            earth,
            slip,
            base_height - 0.001,
        )
    method = add_beveled_box(
        "transmission/method",
        DIMENSIONS["method_slip"],
        (0.0, -0.238, 0.010),
        0.0009,
    )
    method.parent = root
    add_shallow_seat(
        "detail/slip-seat/transmission/method",
        base,
        method,
        base_height - 0.001,
    )


def add_sector_in_slot(node_id, slot, inner_radius, outer_radius, half_angle, depth, z, bevel):
    obj = add_annular_sector(
        node_id,
        inner_radius,
        outer_radius,
        math.pi / 2 - half_angle,
        math.pi / 2 + half_angle,
        depth,
        (0.0, 0.0, 0.0),
        bevel,
    )
    center_radius = (GENERAL_SECTOR_INNER_RADIUS + GENERAL_SECTOR_OUTER_RADIUS) / 2
    for vertex in obj.data.vertices:
        vertex.co.y -= center_radius
    obj.data.update()
    obj.parent = slot
    obj.location.z = z
    return obj


def add_generals(general_ring, font_path):
    font = bpy.data.fonts.load(str(font_path), check_existing=True)
    depth = GENERAL_INLAY_DEPTH_M
    seat_top = general_ring.dimensions.z / 2
    seat_z = seat_top + 0.0002
    center_radius = (GENERAL_SECTOR_INNER_RADIUS + GENERAL_SECTOR_OUTER_RADIUS) / 2
    for index, (general_key, general_name, branch) in enumerate(zip(GENERAL_KEYS, GENERAL_NAMES, VISUAL_EARTH_ORDER)):
        piece_inner = GENERAL_SECTOR_INNER_RADIUS + GENERAL_RADIAL_CLEARANCE_M
        piece_outer = GENERAL_SECTOR_OUTER_RADIUS - GENERAL_RADIAL_CLEARANCE_M
        angle = visual_angle(index)
        slot = new_empty(
            f"general-slot/{branch}",
            (center_radius * math.cos(angle), center_radius * math.sin(angle), seat_z),
        )
        slot.parent = general_ring
        slot.rotation_euler.z = angle - math.pi / 2
        slot["visual_index"] = index
        slot["sector_inner_radius_m"] = piece_inner
        slot["sector_outer_radius_m"] = piece_outer
        slot["sector_angle_deg"] = GENERAL_SECTOR_ANGLE_DEG
        slot["seat_z_m"] = seat_z
        recess = add_sector_in_slot(
            f"detail/general-recess/{branch}",
            slot,
            GENERAL_SECTOR_INNER_RADIUS,
            GENERAL_SECTOR_OUTER_RADIUS,
            math.radians(GENERAL_SECTOR_ANGLE_DEG / 2),
            0.0006,
            0.0003,
            0.0002,
        )
        del recess["node_id"]
        recess["surface_treatment"] = "general-seat-recess"
        recess["material_variant"] = "jade-recess"
        general = add_sector_in_slot(
            f"general/{general_key}",
            slot,
            piece_inner,
            piece_outer,
            GENERAL_INLAY_HALF_ANGLE_RAD,
            depth,
            0.0,
            0.0003,
        )
        general.parent = general_ring
        general.location = (*slot.location[:2], seat_z + depth / 2)
        general.rotation_euler = slot.rotation_euler
        general["domain"] = "general"
        general["general_key"] = general_key
        general["target_earth"] = branch
        general["ring_index"] = index
        general["sector_inner_radius_m"] = piece_inner
        general["sector_outer_radius_m"] = piece_outer
        general["sector_angle_deg"] = GENERAL_SECTOR_ANGLE_DEG
        general["radial_clearance_m"] = GENERAL_RADIAL_CLEARANCE_M
        general["angular_clearance_deg"] = GENERAL_ANGULAR_CLEARANCE_DEG
        general["settled_z_m"] = general.location.z
        general["settled_location"] = tuple(slot.location)
        general["closed_rotation_euler"] = tuple(general.rotation_euler)
        curve = bpy.data.curves.new(f"general/{general_key}/name/curve", "FONT")
        curve.body = general_name
        curve.font = font
        curve.align_x = "CENTER"
        curve.align_y = "CENTER"
        curve.size = 0.016
        curve.extrude = 0.00015
        glyph = bpy.data.objects.new(f"general/{general_key}/name", curve)
        bpy.context.scene.collection.objects.link(glyph)
        glyph.parent = general
        glyph.location.z = depth / 2
        glyph["text_role"] = "general-name"
        glyph["general_key"] = general_key
        glyph["target_earth"] = branch
        glyph["runtime_color_switch"] = True
        bpy.context.view_layer.objects.active = glyph
        glyph.select_set(True)
        bpy.ops.object.convert(target="MESH")
        glyph.select_set(False)
        glyph.location.z += 0.00025


def add_month_general_glyphs(heaven, font_path):
    font = bpy.data.fonts.load(str(font_path), check_existing=True)
    for index, month in enumerate(VISUAL_MONTH_ORDER):
        angle = visual_angle(index)
        curve = bpy.data.curves.new(f"month-general/{month}/curve", "FONT")
        curve.body = month
        curve.font = font
        curve.align_x = "CENTER"
        curve.align_y = "CENTER"
        curve.size = 0.032
        curve.extrude = 0.00035
        obj = bpy.data.objects.new(f"month-general/{month}", curve)
        bpy.context.scene.collection.objects.link(obj)
        obj.parent = heaven
        obj.location = (MONTH_GENERAL_RADIUS_M * math.cos(angle), MONTH_GENERAL_RADIUS_M * math.sin(angle), heaven.dimensions.z / 2)
        obj.rotation_euler.z = angle - math.pi / 2
        obj["node_id"] = obj.name
        obj["visual_index"] = index
        obj["material_variant"] = "cinnabar-text"
        obj["text_role"] = "month-general"
        obj["runtime_color_switch"] = True
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.convert(target="MESH")
        obj.select_set(False)
        obj.location.z += 0.00045


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
        (-0.054, 0.036, 0.0),
        (-0.021, 0.056, 0.00015),
        (0.015, 0.030, 0.0),
        (-0.006, -0.008, 0.00012),
        (0.046, -0.041, 0.0),
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


def add_course_trace(core):
    material = bpy.data.materials.get("graybox/trace-dark")
    if material is None:
        material = bpy.data.materials.new("graybox/trace-dark")
        material.diffuse_color = (0.025, 0.030, 0.028, 1.0)

    core_top = core.location.z + core.dimensions.z / 2
    trace = _add_course_curve_mesh("trace/course", core_top + 0.0001, 0.00045)
    world_matrix = trace.matrix_world.copy()
    trace.parent = core
    trace.matrix_world = world_matrix
    trace["node_id"] = "trace/course"
    trace["surface_treatment"] = "raised-inlay"
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
    heaven = add_ring(
        "plate/heaven",
        heaven_diameter / 2,
        0.125,
        heaven_depth,
        (*DIAL_CENTER_OFFSET_M, base_height + DIMENSIONS["earth_plate"][2] + heaven_depth / 2),
        0.002,
    )
    heaven["closed_rotation_euler"] = tuple(heaven.rotation_euler)
    heaven["rotates_independently"] = True
    foundation = add_disc(
        "detail/heaven/dial-foundation", 0.164, 0.006, (0.0, 0.0, 0.0), 0.001
    )
    del foundation["node_id"]
    foundation.parent = heaven
    foundation.location = (0.0, 0.0, -0.0020)
    foundation["material_variant"] = "jade-panel"
    foundation["visual_role"] = "rotating-dial-foundation"
    # Two visual bands share the same parent, so they can never drift apart.
    for ring_index, (outer_radius, inner_radius) in enumerate(
        ((0.165, 0.137), (0.136, 0.096)), start=1
    ):
        band = add_ring(
            f"detail/heaven/linked-ring-{ring_index}",
            outer_radius,
            inner_radius,
            0.0012,
            (0.0, 0.0, 0.0),
        )
        del band["node_id"]
        band.parent = heaven
        # Keep the visible jade band above the dial foundation: a deliberate
        # shallow relief, not a coplanar self-shadowing surface.
        band.location.z = heaven_depth / 2 + 0.0012
        band["ring_index"] = ring_index
        band["material_variant"] = "jade-ring"

    general_diameter, general_depth = DIMENSIONS["general_ring"]
    general_ring = add_ring(
        "plate/generals",
        general_diameter / 2,
        0.063,
        general_depth,
        (*DIAL_CENTER_OFFSET_M, base_height + DIMENSIONS["earth_plate"][2] + 0.0035),
        0.001,
    )
    general_ring["fixed"] = True

    core_diameter, core_depth = DIMENSIONS["fixed_core"]
    core = add_disc(
        "plate/core",
        core_diameter / 2,
        core_depth,
        (*DIAL_CENTER_OFFSET_M, base_height + DIMENSIONS["earth_plate"][2] + 0.0092),
        0.001,
    )
    core["fixed"] = True
    add_historical_ring(radius=0.137, z=base_height + DIMENSIONS["earth_plate"][2] + 0.0102)
    parent_runtime_parts(root)
    repository_root = Path(__file__).parents[2]
    font_path = repository_root / "assets/daliuren/fonts/NotoSerifCJKsc-Regular.otf"
    add_calendar(root, base_height)
    add_lesson_slips(root, earth, base_height)
    add_transmission_slips(root, base, earth, base_height)
    add_generals(general_ring, font_path)
    add_course_trace(core)
    build_fixed_inscriptions(earth, heaven, font_path, roles={"earth-branch"})
    add_month_general_glyphs(heaven, font_path)
    interaction = add_ring(
        "interaction/month-general-ring", 0.170, 0.112, 0.0002, (0.0, 0.0, heaven.dimensions.z / 2 + 0.0002)
    )
    interaction.parent = heaven
    interaction["color_write"] = False
    interaction["depth_write"] = False
    interaction["runtime_visibility"] = "raycast-only"
    interaction["material_variant"] = "interaction-hit-area"
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
