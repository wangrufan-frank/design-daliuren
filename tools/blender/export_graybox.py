import argparse
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).parent))

from build_graybox import build_graybox, build_pose_previews
from build_lods import build_lod
from poses import apply_pose


def parse_args(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("--lod", type=int, choices=(0, 1, 2))
    parser.add_argument(
        "--output",
        type=Path,
    )
    return parser.parse_args(argv)


def runtime_hierarchy(root):
    return (root, *root.children_recursive)


def _export_objects(objects, output_path, apply_modifiers=False):
    objects = tuple(objects)
    visibility = {
        obj: (obj.hide_viewport, obj.hide_render, obj.hide_get())
        for obj in objects
    }
    bpy.ops.object.select_all(action="DESELECT")
    try:
        for obj in objects:
            obj.hide_viewport = False
            obj.hide_render = False
            obj.hide_set(False)
            obj.select_set(True)
        root = next(obj for obj in objects if obj.get("node_id") == "artifact/root")
        bpy.context.view_layer.objects.active = root
        bpy.context.view_layer.update()

        output_path = output_path.resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.export_scene.gltf(
            filepath=str(output_path),
            export_format="GLB",
            use_selection=True,
            export_extras=True,
            export_apply=apply_modifiers,
            export_tangents=True,
            export_animations=False,
        )
    finally:
        for obj, (hide_viewport, hide_render, hidden) in visibility.items():
            obj.select_set(False)
            obj.hide_viewport = hide_viewport
            obj.hide_render = hide_render
            obj.hide_set(hidden)
    return output_path


def export_graybox(output_path):
    root = build_graybox()
    build_pose_previews()
    apply_pose("closed")

    output_path = _export_objects(runtime_hierarchy(root), output_path)

    print(f"Exported graybox: {output_path}")


def export_lod(level, output_path):
    collection = build_lod(level)
    output_path = _export_objects(collection.all_objects, output_path, apply_modifiers=True)
    print(f"Exported LOD{level}: {output_path}")


def main():
    args = parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])
    if args.lod is None:
        export_graybox(args.output or Path("public/models/daliuren/daliuren-graybox.glb"))
    else:
        output = args.output or Path(
            f"public/models/daliuren/daliuren-artifact-lod{args.lod}.glb"
        )
        export_lod(args.lod, output)


if __name__ == "__main__":
    main()
