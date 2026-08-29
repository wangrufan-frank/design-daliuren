import math

import bpy

from daliuren_contract import NODE_IDS


LESSON_IDS = ("lesson/first", "lesson/second", "lesson/third", "lesson/fourth")
TRANSMISSION_IDS = (
    "transmission/initial",
    "transmission/middle",
    "transmission/final",
)
GENERAL_IDS = (
    "general/noble",
    "general/snake",
    "general/vermilion-bird",
    "general/harmony",
    "general/hook-array",
    "general/azure-dragon",
    "general/void",
    "general/white-tiger",
    "general/constant",
    "general/black-tortoise",
    "general/yin",
    "general/queen-of-heaven",
)
DYNAMIC_IDS = (
    "calendar/slip",
    *LESSON_IDS,
    *TRANSMISSION_IDS,
    "transmission/method",
    *GENERAL_IDS,
)
POSE_VISIBLE_IDS = {
    "closed": frozenset(),
    "calendar": frozenset({"calendar/slip"}),
    "plate": frozenset({"calendar/slip"}),
    "lessons": frozenset({"calendar/slip", *LESSON_IDS}),
    "transmissions": frozenset({
        "calendar/slip",
        *LESSON_IDS,
        *TRANSMISSION_IDS,
        "transmission/method",
    }),
    "generals": frozenset(DYNAMIC_IDS),
}


def _validate_pose_inputs(pose_id, plate_offset, general_direction):
    if pose_id not in POSE_VISIBLE_IDS:
        raise ValueError(f"Unknown pose_id: {pose_id!r}")
    if isinstance(plate_offset, bool) or not isinstance(plate_offset, int):
        raise TypeError("plate_offset must be an integer from 0 through 11")
    if not 0 <= plate_offset < 12:
        raise ValueError("plate_offset must be from 0 through 11")
    if general_direction not in {"forward", "reverse"}:
        raise ValueError("general_direction must be 'forward' or 'reverse'")


def set_plate_absolute(progress, plate_offset):
    plate = bpy.data.objects["plate/heaven"]
    closed_rotation = plate["closed_rotation_euler"]
    plate.rotation_euler.z = closed_rotation[2] + math.radians(30.0 * plate_offset) * progress


def _set_dynamic_visibility(visible_ids):
    for node_id in DYNAMIC_IDS:
        hidden = node_id not in visible_ids
        root = bpy.data.objects[node_id]
        for obj in (root, *root.children_recursive):
            obj.hide_viewport = hidden
            obj.hide_render = hidden


def apply_pose(pose_id: str, plate_offset: int = 0, general_direction: str = "forward") -> None:
    _validate_pose_inputs(pose_id, plate_offset, general_direction)
    set_plate_absolute(pose_id in {"plate", "lessons", "transmissions", "generals"}, plate_offset)
    _set_dynamic_visibility(POSE_VISIBLE_IDS[pose_id])
    bpy.context.view_layer.update()


def snapshot_transforms() -> dict[str, tuple[float, ...]]:
    return {
        node_id: tuple(bpy.data.objects[node_id].location)
        + tuple(bpy.data.objects[node_id].rotation_euler)
        + tuple(bpy.data.objects[node_id].scale)
        for node_id in NODE_IDS
    }
