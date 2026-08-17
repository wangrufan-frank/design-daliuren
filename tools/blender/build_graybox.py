import argparse
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).parent))

from daliuren_contract import DIMENSIONS
from geometry import add_beveled_box, add_disc


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


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
    add_disc(
        "plate/heaven",
        heaven_diameter / 2,
        heaven_depth,
        (0.0, 0.0, 0.074),
        0.002,
    )
    add_historical_ring(radius=0.145, z=0.087)
    parent_runtime_parts(root)
    return root


def parse_args(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("--save", type=Path)
    return parser.parse_args(argv)


def main():
    args = parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])
    build_graybox()
    if args.save:
        output = args.save.resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(output))
        print(f"Saved graybox: {output}")


if __name__ == "__main__":
    main()
