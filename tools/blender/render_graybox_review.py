import sys
import tempfile
from array import array
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).parent))

from build_graybox import build_graybox
from daliuren_contract import POSE_IDS
from poses import apply_pose


CAMERAS = {
    "review/overall": ((0.78, -0.90, 0.68), (0.0, -0.02, 0.065), 58.0),
    "review/oblique": ((-0.76, -0.82, 0.55), (0.0, -0.03, 0.070), 58.0),
    "review/mechanism": ((0.0, -1.25, 0.44), (0.0, -0.10, 0.055), 54.0),
    "review/top": ((0.0, 0.0, 2.15), (0.0, -0.03, 0.055), 60.0),
}
LIGHTS = {
    "light/key": ((0.62, -0.52, 0.86), 120.0, 0.52, (1.0, 0.78, 0.62)),
    "light/fill": ((-0.58, -0.30, 0.50), 36.0, 0.78, (0.78, 0.86, 1.0)),
    "light/rim": ((0.08, 0.64, 0.72), 84.0, 0.16, (1.0, 0.86, 0.72)),
}
REVIEW_OUTPUTS = ("overall", "oblique", "mechanism", "top")
STAGE_PREVIEW_OUTPUTS = tuple(f"stage-{pose_id}" for pose_id in POSE_IDS)


def _look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def _remove_review_rig():
    for obj in list(bpy.data.objects):
        if obj.type in {"CAMERA", "LIGHT"} or obj.name == "review/ground":
            bpy.data.objects.remove(obj, do_unlink=True)
    for camera in list(bpy.data.cameras):
        bpy.data.cameras.remove(camera)
    for light in list(bpy.data.lights):
        bpy.data.lights.remove(light)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0 and mesh.name.startswith("review/ground"):
            bpy.data.meshes.remove(mesh)


def _configure_world_and_render():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.render.use_file_extension = True
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -1.0

    world = scene.world or bpy.data.worlds.new("review/world")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (
        0x12 / 255,
        0x18 / 255,
        0x17 / 255,
        1.0,
    )
    background.inputs["Strength"].default_value = 0.12


def _neutral_material():
    material = bpy.data.materials.get("review/neutral-gray")
    if material is None:
        material = bpy.data.materials.new("review/neutral-gray")
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (0.10, 0.10, 0.10, 1.0)
    principled.inputs["Metallic"].default_value = 0.0
    principled.inputs["Roughness"].default_value = 0.62
    return material


def _recess_material():
    material = bpy.data.materials.get("review/recess-gray")
    if material is None:
        material = bpy.data.materials.new("review/recess-gray")
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (0.025, 0.025, 0.025, 1.0)
    principled.inputs["Metallic"].default_value = 0.0
    principled.inputs["Roughness"].default_value = 0.70
    return material


def _ground_material():
    material = bpy.data.materials.get("review/ground-gray")
    if material is None:
        material = bpy.data.materials.new("review/ground-gray")
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (0.045, 0.045, 0.045, 1.0)
    principled.inputs["Metallic"].default_value = 0.0
    principled.inputs["Roughness"].default_value = 0.82
    return material


def _add_camera(name, location, target, lens):
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.sensor_fit = "HORIZONTAL"
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    _look_at(obj, target)
    return obj


def _add_light(name, location, energy, size, color):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    _look_at(obj, (0.0, 0.0, 0.055))
    return obj


def build_review_scene():
    _remove_review_rig()
    _configure_world_and_render()
    neutral = _neutral_material()
    recess = _recess_material()
    ground_material = _ground_material()

    bpy.ops.mesh.primitive_plane_add(size=4.0, location=(0.0, 0.0, -0.004))
    ground = bpy.context.object
    ground.name = "review/ground"
    ground.data.name = "review/ground"

    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        obj.data.materials.clear()
        if obj == ground:
            obj.data.materials.append(ground_material)
        elif obj.name.startswith("detail/branch-bed/"):
            obj.data.materials.append(recess)
        else:
            obj.data.materials.append(neutral)

    for name, (location, target, lens) in CAMERAS.items():
        _add_camera(name, location, target, lens)
    for name, (location, energy, size, color) in LIGHTS.items():
        _add_light(name, location, energy, size, color)

    bpy.context.scene.camera = bpy.data.objects["review/overall"]
    bpy.context.view_layer.update()
    return bpy.context.scene


def _set_stamp(label):
    render = bpy.context.scene.render
    render.use_stamp = bool(label)
    render.use_stamp_note = bool(label)
    render.stamp_note_text = label or ""
    render.use_stamp_date = False
    render.use_stamp_time = False
    render.use_stamp_render_time = False
    render.use_stamp_frame = False
    render.use_stamp_frame_range = False
    render.use_stamp_memory = False
    render.use_stamp_hostname = False
    render.use_stamp_camera = False
    render.use_stamp_lens = False
    render.use_stamp_scene = False
    render.use_stamp_marker = False
    render.use_stamp_filename = False
    render.use_stamp_sequencer_strip = False
    render.stamp_font_size = 28
    render.stamp_foreground = (0.94, 0.94, 0.92, 1.0)
    render.stamp_background = (0.02, 0.03, 0.03, 0.82)


def _render(camera_name, output, width=1920, label=None):
    scene = bpy.context.scene
    scene.camera = bpy.data.objects[camera_name]
    scene.render.resolution_x = width
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.filepath = str(output)
    _set_stamp(label)
    bpy.ops.render.render(write_still=True)


def _combine_halves(left_path, right_path, output_path):
    left = bpy.data.images.load(str(left_path), check_existing=False)
    right = bpy.data.images.load(str(right_path), check_existing=False)
    try:
        half_width, height = left.size[:]
        if (half_width, height) != (960, 1080) or tuple(right.size[:]) != (960, 1080):
            raise RuntimeError("Split-screen sources must both be 960x1080")
        channels = 4
        half_row = half_width * channels
        full_row = half_row * 2
        left_pixels = array("f", [0.0]) * (half_row * height)
        right_pixels = array("f", [0.0]) * (half_row * height)
        combined_pixels = array("f", [0.0]) * (full_row * height)
        left.pixels.foreach_get(left_pixels)
        right.pixels.foreach_get(right_pixels)
        for row in range(height):
            half_offset = row * half_row
            full_offset = row * full_row
            combined_pixels[full_offset : full_offset + half_row] = left_pixels[
                half_offset : half_offset + half_row
            ]
            combined_pixels[full_offset + half_row : full_offset + full_row] = right_pixels[
                half_offset : half_offset + half_row
            ]

        combined = bpy.data.images.new(
            "review/overall-split",
            width=half_width * 2,
            height=height,
            alpha=True,
        )
        try:
            combined.pixels.foreach_set(combined_pixels)
            combined.file_format = "PNG"
            combined.filepath_raw = str(output_path)
            combined.save()
        finally:
            bpy.data.images.remove(combined)
    finally:
        bpy.data.images.remove(left)
        bpy.data.images.remove(right)


def render_review_images(output_dir=None):
    output_dir = Path(output_dir or Path(__file__).resolve().parents[2] / "docs" / "asset-reviews" / "graybox")
    output_dir.mkdir(parents=True, exist_ok=True)
    build_graybox()
    build_review_scene()

    with tempfile.TemporaryDirectory(prefix="daliuren-graybox-") as temporary:
        temporary = Path(temporary)
        apply_pose("closed")
        _render("review/overall", temporary / "closed.png", width=960, label="CLOSED")
        apply_pose("generals", plate_offset=5, general_direction="reverse")
        _render("review/overall", temporary / "generals.png", width=960, label="GENERALS")
        _combine_halves(
            temporary / "closed.png",
            temporary / "generals.png",
            output_dir / "overall.png",
        )

    apply_pose("generals", plate_offset=5, general_direction="reverse")
    for name in ("oblique", "mechanism", "top"):
        _render(f"review/{name}", output_dir / f"{name}.png")

    for pose_id, output_name in zip(POSE_IDS, STAGE_PREVIEW_OUTPUTS):
        plate_offset = 0 if pose_id in {"closed", "calendar"} else 5
        apply_pose(pose_id, plate_offset=plate_offset, general_direction="reverse")
        _render(
            "review/oblique",
            output_dir / f"{output_name}.png",
            label=pose_id.upper(),
        )

    _set_stamp(None)
    bpy.context.scene.render.resolution_x = 1920
    return tuple(
        output_dir / f"{name}.png"
        for name in (*REVIEW_OUTPUTS, *STAGE_PREVIEW_OUTPUTS)
    )


if __name__ == "__main__":
    for rendered_path in render_review_images():
        print(f"Rendered graybox review: {rendered_path}")
