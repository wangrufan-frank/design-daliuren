import argparse
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).parent))

from build_graybox import build_graybox, build_pose_previews
from poses import apply_pose


def parse_args(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("public/models/daliuren/daliuren-graybox.glb"),
    )
    return parser.parse_args(argv)


def runtime_hierarchy(root):
    return (root, *root.children_recursive)


def export_graybox(output_path):
    root = build_graybox()
    build_pose_previews()
    apply_pose("closed")

    runtime_objects = runtime_hierarchy(root)
    visibility = {
        obj: (obj.hide_viewport, obj.hide_render, obj.hide_get())
        for obj in runtime_objects
    }
    bpy.ops.object.select_all(action="DESELECT")
    try:
        for obj in runtime_objects:
            obj.hide_viewport = False
            obj.hide_render = False
            obj.hide_set(False)
            obj.select_set(True)
        bpy.context.view_layer.objects.active = root
        bpy.context.view_layer.update()

        output_path = output_path.resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.export_scene.gltf(
            filepath=str(output_path),
            export_format="GLB",
            use_selection=True,
            export_extras=True,
            export_apply=False,
            export_animations=False,
        )
    finally:
        for obj, (hide_viewport, hide_render, hidden) in visibility.items():
            obj.select_set(False)
            obj.hide_viewport = hide_viewport
            obj.hide_render = hide_render
            obj.hide_set(hidden)

    print(f"Exported graybox: {output_path}")


def main():
    args = parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])
    export_graybox(args.output)


if __name__ == "__main__":
    main()
