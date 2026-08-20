import hashlib
import sys
import tempfile
from array import array
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).parent))

from materials import srgb_hex
from poses import apply_pose


REPOSITORY_ROOT = Path(__file__).parents[2]
MASTER_PATH = REPOSITORY_ROOT / "assets/daliuren/source/daliuren-artifact-master.blend"
OUTPUT_DIR = REPOSITORY_ROOT / "docs/asset-reviews/lookdev"
REVIEW_OUTPUTS = (
    "overall",
    "oblique",
    "material-closeup",
    "rotation-evidence",
)
CAMERAS = {
    "camera/overall": ((0.78, -0.96, 0.68), (0.0, 0.0, 0.055), 58.0),
    "camera/oblique": ((-0.72, -0.82, 0.40), (0.0, -0.01, 0.055), 62.0),
    "camera/material-closeup": ((0.27, -0.18, 0.19), (0.155, 0.0, 0.085), 70.0),
    "camera/rotation-evidence": ((0.75, -0.94, 0.63), (0.0, 0.0, 0.065), 62.0),
}
CAMERA_NAMES = tuple(CAMERAS)
VISUAL_EVIDENCE = (
    ("real edge thickness", "overall / oblique"),
    ("continuous moving highlight", "rotation-evidence"),
    ("bronze/celadon reflection difference", "material-closeup"),
    ("contact-driven wear", "oblique / material-closeup"),
    ("recess oxidation", "oblique / material-closeup"),
    ("readable functional inscription", "overall / material-closeup"),
    ("lower-contrast historical inscription", "overall / material-closeup"),
    ("grounded contact shadow", "overall / oblique"),
)


def _look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def _remove_lookdev_rig():
    names = set(CAMERA_NAMES) | {"light/key", "light/fill", "light/rim", "lookdev/ground"}
    for name in names:
        obj = bpy.data.objects.get(name)
        if obj is not None:
            bpy.data.objects.remove(obj, do_unlink=True)
    for name in CAMERA_NAMES:
        data = bpy.data.cameras.get(name)
        if data is not None and data.users == 0:
            bpy.data.cameras.remove(data)
    for name in ("light/key", "light/fill", "light/rim"):
        data = bpy.data.lights.get(name)
        if data is not None and data.users == 0:
            bpy.data.lights.remove(data)
    ground_mesh = bpy.data.meshes.get("lookdev/ground")
    if ground_mesh is not None and ground_mesh.users == 0:
        bpy.data.meshes.remove(ground_mesh)
    ground_material = bpy.data.materials.get("lookdev/ground-material")
    if ground_material is not None and ground_material.users == 0:
        bpy.data.materials.remove(ground_material)


def _configure_render():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.max_bounces = 6
    scene.cycles.diffuse_bounces = 3
    scene.cycles.glossy_bounces = 4
    scene.render.resolution_x = 2560
    scene.render.resolution_y = 1440
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.render.use_file_extension = True
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    scene.use_nodes = False

    world = scene.world or bpy.data.worlds.new("lookdev/world")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = srgb_hex("#121817")
    background.inputs["Strength"].default_value = 0.04


def _ground_material():
    material = bpy.data.materials.get("lookdev/ground-material")
    if material is None:
        material = bpy.data.materials.new("lookdev/ground-material")
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = srgb_hex("#1B2321")
    shader.inputs["Metallic"].default_value = 0.0
    shader.inputs["Roughness"].default_value = 0.62
    return material


def _add_ground():
    bpy.ops.mesh.primitive_plane_add(size=20.0, location=(0.0, 0.0, -0.001))
    ground = bpy.context.object
    ground.name = "lookdev/ground"
    ground.data.name = "lookdev/ground"
    ground.data.materials.append(_ground_material())
    return ground


def _add_camera(name, location, target, lens):
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.sensor_fit = "HORIZONTAL"
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    _look_at(obj, target)
    obj["lookdev_target"] = target
    if name == "camera/material-closeup":
        data.dof.use_dof = True
        data.dof.focus_distance = (Vector(target) - obj.location).length
        data.dof.aperture_fstop = 11.0
    return obj


def _add_area_light(name, location, target, energy, shape, size, size_y=None):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = shape
    data.size = size
    if size_y is not None:
        data.size_y = size_y
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    _look_at(obj, target)
    return obj


def _add_museum_lights():
    target = (0.0, 0.0, 0.06)
    key = _add_area_light(
        "light/key",
        (-0.55, -0.58, 0.72),
        target,
        55.0,
        "DISK",
        0.45,
    )
    key.data.use_temperature = True
    key.data.temperature = 4300.0

    fill = _add_area_light(
        "light/fill",
        (0.48, -0.28, 0.36),
        target,
        16.5,
        "DISK",
        0.68,
    )
    fill.data.use_temperature = True
    fill.data.temperature = 5200.0

    rim = _add_area_light(
        "light/rim",
        (0.0, 0.52, 0.40),
        target,
        40.0,
        "RECTANGLE",
        0.46,
        0.07,
    )
    rim.data.use_temperature = True
    rim.data.temperature = 5000.0


def build_lookdev_scene():
    _remove_lookdev_rig()
    _configure_render()
    _add_ground()
    for name, (location, target, lens) in CAMERAS.items():
        _add_camera(name, location, target, lens)
    _add_museum_lights()
    bpy.context.scene.camera = bpy.data.objects["camera/overall"]
    bpy.context.view_layer.update()
    return bpy.context.scene


def _render(camera_name, output_path, width=2560, height=1440):
    scene = bpy.context.scene
    scene.camera = bpy.data.objects[camera_name]
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.filepath = str(output_path)
    bpy.ops.render.render(write_still=True)


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
    render.stamp_font_size = 30
    render.stamp_foreground = (0.90, 0.91, 0.86, 1.0)
    render.stamp_background = (0.02, 0.03, 0.03, 0.78)


def _combine_halves(left_path, right_path, output_path):
    left = bpy.data.images.load(str(left_path), check_existing=False)
    right = bpy.data.images.load(str(right_path), check_existing=False)
    try:
        half_width, height = left.size[:]
        if (half_width, height) != (1280, 1440) or tuple(right.size[:]) != (1280, 1440):
            raise RuntimeError("Rotation evidence sources must both be 1280x1440")
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
            "lookdev/rotation-evidence-combined",
            width=2560,
            height=1440,
            alpha=False,
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


def _sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _display_path(path):
    path = Path(path).resolve()
    try:
        return path.relative_to(REPOSITORY_ROOT).as_posix()
    except ValueError:
        return path.name


def write_review_manifest(
    output_dir,
    image_paths,
    asset_paths=None,
    visual_results=None,
):
    output_dir = Path(output_dir)
    asset_paths = tuple(
        asset_paths
        or (
            MASTER_PATH,
            *(REPOSITORY_ROOT / f"public/models/daliuren/daliuren-artifact-lod{level}.glb" for level in range(3)),
        )
    )
    visual_results = dict(visual_results or {})
    lines = [
        "# Daliuren Artifact Lookdev Review",
        "",
        "## Render manifest",
        "",
        f"- Blender: `{bpy.app.version_string}`",
        "- Engine: `CYCLES`",
        "- Samples: `64`, Cycles denoising enabled",
        "- Color management: `AgX`, `AgX - Medium High Contrast`",
        "- Lighting: `4300 K` key, `30%` fill, narrow rectangular rim",
        "- Resolution: `2560 x 1440` PNG, opaque background, bloom disabled",
        "",
        "## Review frames",
        "",
    ]
    for path in image_paths:
        path = Path(path)
        lines.extend((f"### {path.stem}", "", f"![{path.stem}](./{path.name})", ""))

    lines.extend(("## Visual evidence", "", "| Evidence | Frame | Result |", "| --- | --- | --- |"))
    for evidence, frame in VISUAL_EVIDENCE:
        lines.append(f"| {evidence} | {frame} | {visual_results.get(evidence, 'PENDING')} |")

    lines.extend(("", "## SHA-256", "", "| Artifact | SHA-256 |", "| --- | --- |"))
    for path in (*asset_paths, *tuple(image_paths)):
        path = Path(path)
        lines.append(f"| `{_display_path(path)}` | `{_sha256(path)}` |")
    lines.append("")
    manifest = output_dir / "README.md"
    manifest.write_text("\n".join(lines), encoding="utf-8")
    return manifest


def render_lookdev_images(output_dir=None):
    output_dir = Path(output_dir or OUTPUT_DIR)
    output_dir.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(MASTER_PATH))
    build_lookdev_scene()

    apply_pose("closed")
    _render("camera/overall", output_dir / "overall.png")

    apply_pose("generals", plate_offset=5, general_direction="reverse")
    _render("camera/oblique", output_dir / "oblique.png")

    apply_pose("plate", plate_offset=0)
    _render("camera/material-closeup", output_dir / "material-closeup.png")

    with tempfile.TemporaryDirectory(prefix="daliuren-lookdev-") as temporary:
        temporary = Path(temporary)
        apply_pose("plate", plate_offset=0)
        _set_stamp("HEAVEN PLATE 0 DEGREES")
        _render(
            "camera/rotation-evidence",
            temporary / "rotation-0.png",
            width=1280,
        )
        apply_pose("plate", plate_offset=2)
        _set_stamp("HEAVEN PLATE 60 DEGREES")
        _render(
            "camera/rotation-evidence",
            temporary / "rotation-60.png",
            width=1280,
        )
        _combine_halves(
            temporary / "rotation-0.png",
            temporary / "rotation-60.png",
            output_dir / "rotation-evidence.png",
        )
    _set_stamp(None)

    image_paths = tuple(output_dir / f"{name}.png" for name in REVIEW_OUTPUTS)
    write_review_manifest(output_dir, image_paths)
    bpy.context.scene.render.resolution_x = 2560
    bpy.context.scene.render.resolution_y = 1440
    return image_paths


if __name__ == "__main__":
    for rendered_path in render_lookdev_images():
        print(f"Rendered lookdev review: {rendered_path}")
    print(f"Wrote lookdev manifest: {OUTPUT_DIR / 'README.md'}")
