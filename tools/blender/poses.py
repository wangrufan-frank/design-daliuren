import math

import bpy

from daliuren_contract import NODE_IDS


POSE_PROGRESS = {
    "closed": (0, 0, 0, 0, 0),
    "calendar": (1, 0, 0, 0, 0),
    "plate": (1, 1, 0, 0, 0),
    "lessons": (1, 1, 1, 0, 0),
    "transmissions": (1, 1, 1, 1, 0),
    "generals": (1, 1, 1, 1, 1),
}

LESSON_IDS = ("lesson/first", "lesson/second", "lesson/third", "lesson/fourth")
GENERAL_TURN_RADIANS = math.radians(15.0)


def _validate_pose_inputs(pose_id, plate_offset, general_direction):
    if pose_id not in POSE_PROGRESS:
        raise ValueError(f"Unknown pose_id: {pose_id!r}")
    if isinstance(plate_offset, bool) or not isinstance(plate_offset, int):
        raise TypeError("plate_offset must be an integer from 0 through 11")
    if not 0 <= plate_offset < 12:
        raise ValueError("plate_offset must be from 0 through 11")
    if general_direction not in {"forward", "reverse"}:
        raise ValueError("general_direction must be 'forward' or 'reverse'")


def _set_translation_absolute(node_id, progress):
    obj = bpy.data.objects[node_id]
    closed = obj["closed_location"]
    axis = obj["motion_axis"]
    travel = obj["travel_m"]
    obj.location = tuple(
        closed[coordinate] + axis[coordinate] * travel * progress
        for coordinate in range(3)
    )


def set_calendar_absolute(progress):
    _set_translation_absolute("calendar/slip", progress)


def set_plate_absolute(progress, plate_offset):
    plate = bpy.data.objects["plate/heaven"]
    closed_rotation = plate["closed_rotation_euler"]
    plate.rotation_euler = closed_rotation
    plate.rotation_euler.z = closed_rotation[2] + math.radians(30.0 * plate_offset) * progress


def set_lessons_absolute(progress):
    for node_id in LESSON_IDS:
        _set_translation_absolute(node_id, progress)


def set_transmissions_absolute(progress):
    _set_translation_absolute("transmission/bridge", progress)


def set_generals_absolute(progress, general_direction):
    turn = GENERAL_TURN_RADIANS if general_direction == "forward" else -GENERAL_TURN_RADIANS
    generals = sorted(
        (obj for obj in bpy.data.objects if obj.get("domain") == "general"),
        key=lambda obj: obj["ring_index"],
    )
    for general in generals:
        _set_translation_absolute(general["node_id"], progress)
        closed_rotation = general["closed_rotation_euler"]
        general.rotation_euler = closed_rotation
        general.rotation_euler.z = closed_rotation[2] + turn * progress


def apply_pose(pose_id: str, plate_offset: int = 0, general_direction: str = "forward") -> None:
    _validate_pose_inputs(pose_id, plate_offset, general_direction)
    calendar, plate, lessons, transmissions, generals = POSE_PROGRESS[pose_id]
    set_calendar_absolute(calendar)
    set_plate_absolute(plate, plate_offset)
    set_lessons_absolute(lessons)
    set_transmissions_absolute(transmissions)
    set_generals_absolute(generals, general_direction)
    bpy.context.view_layer.update()


def snapshot_transforms() -> dict[str, tuple[float, ...]]:
    return {
        node_id: tuple(bpy.data.objects[node_id].location)
        + tuple(bpy.data.objects[node_id].rotation_euler)
        + tuple(bpy.data.objects[node_id].scale)
        for node_id in NODE_IDS
    }
