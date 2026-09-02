"""Deterministic camera fit to daliuren-heaven-plate-translucent-jade-generals-v10."""

import math

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

from daliuren_contract import VISUAL_ORIENTATION_OFFSET_DEG


REFERENCE_SIZE = (1254, 1253)
REFERENCE_SOURCE_SIZE = (1286, 1223)
# Pixel anchors recorded from the v10 reference at REFERENCE_SIZE.  The board
# anchors are the visible upper rim corners; pearls and blue constellation dots
# are the centers of their corresponding modeled details.
REFERENCE_SOURCE_ANCHORS = {
    "board/sw": (61.0, 924.0),
    "board/nw": (310.0, 176.0),
    "board/se": (1112.0, 1100.0),
    "board/ne": (1211.0, 274.0),
    "dial/center": (651.0, 609.0),
    "pearl/00": (470.0, 361.0),
    "pearl/01": (926.0, 425.0),
    "pearl/02": (378.0, 747.0),
    "pearl/03": (829.0, 828.0),
    "beidou/00": (617.0, 554.0),
    "beidou/01": (607.0, 582.0),
    "beidou/02": (635.0, 588.0),
    "beidou/03": (607.0, 623.0),
    "beidou/04": (640.0, 646.0),
    "beidou/05": (704.0, 625.0),
    "beidou/06": (718.0, 566.0),
    "rim/north": (658.0, 343.0),
    "rim/east": (966.0, 597.0),
    "rim/south": (659.0, 857.0),
    "rim/west": (362.0, 597.0),
    **dict(zip(
        (f"branch/{name}" for name in "午未申酉戌亥子丑寅卯辰巳"),
        ((658.0, 376.0), (793.0, 410.0), (894.0, 489.0), (927.0, 598.0),
         (892.0, 708.0), (795.0, 792.0), (659.0, 825.0), (526.0, 789.0),
         (431.0, 707.0), (399.0, 598.0), (434.0, 489.0), (527.0, 412.0)),
    )),
    **dict(zip(
        (f"month/{name}" for name in ("胜光", "小吉", "传送", "从魁", "河魁", "登明", "神后", "大吉", "功曹", "太冲", "天罡", "太乙")),
        ((657.0, 425.0), (762.0, 449.0), (838.0, 514.0), (868.0, 594.0),
         (836.0, 678.0), (759.0, 744.0), (654.0, 773.0), (549.0, 744.0),
         (474.0, 678.0), (449.0, 593.0), (477.0, 515.0), (551.0, 450.0)),
    )),
    **dict(zip(
        (f"general/{name}" for name in ("noble", "snake", "vermilion-bird", "harmony", "hook-array", "azure-dragon", "void", "white-tiger", "constant", "black-tortoise", "yin", "queen-of-heaven")),
        ((658.0, 486.0), (731.0, 501.0), (787.0, 539.0), (805.0, 596.0),
         (782.0, 649.0), (728.0, 690.0), (656.0, 708.0), (583.0, 686.0),
         (529.0, 648.0), (512.0, 592.0), (533.0, 541.0), (586.0, 500.0)),
    )),
}
_REFERENCE_COVER_SCALE = max(
    REFERENCE_SOURCE_SIZE[0] / REFERENCE_SIZE[0],
    REFERENCE_SOURCE_SIZE[1] / REFERENCE_SIZE[1],
)
_REFERENCE_COVER_CROP = (
    (REFERENCE_SIZE[0] * _REFERENCE_COVER_SCALE - REFERENCE_SOURCE_SIZE[0]) / 2,
    (REFERENCE_SIZE[1] * _REFERENCE_COVER_SCALE - REFERENCE_SOURCE_SIZE[1]) / 2,
)
REFERENCE_ANCHORS = {
    name: (
        (x + _REFERENCE_COVER_CROP[0]) / _REFERENCE_COVER_SCALE,
        (y + _REFERENCE_COVER_CROP[1]) / _REFERENCE_COVER_SCALE,
    )
    for name, (x, y) in REFERENCE_SOURCE_ANCHORS.items()
}

_SEED = (0.200, -0.950, 1.500, 0.000, 0.000, 0.040, 95.0, -0.007, -0.040)
_STEPS = (0.045, 0.045, 0.080, 0.018, 0.018, 0.020, 7.0, 0.018, 0.018)


def _world_points():
    base = bpy.data.objects["base/body"]
    points = {
        "board/sw": base.matrix_world @ Vector((-0.260, -0.260, 0.014)),
        "board/nw": base.matrix_world @ Vector((-0.260, 0.260, 0.014)),
        "board/se": base.matrix_world @ Vector((0.260, -0.260, 0.014)),
        "board/ne": base.matrix_world @ Vector((0.260, 0.260, 0.014)),
        "dial/center": bpy.data.objects["plate/core"].matrix_world.translation.copy(),
    }
    for index in range(4):
        points[f"pearl/{index:02d}"] = bpy.data.objects[
            f"detail/earth/corner-pearl-{index:02d}"
        ].matrix_world.translation.copy()
    for index in range(7):
        points[f"beidou/{index:02d}"] = bpy.data.objects[
            f"constellation/star-{index:02d}"
        ].matrix_world.translation.copy()
    heaven = bpy.data.objects["plate/heaven"]
    rim_z = 0.0068
    for name, degrees in {"north": 90, "east": 0, "south": -90, "west": 180}.items():
        angle = math.radians(degrees + VISUAL_ORIENTATION_OFFSET_DEG)
        points[f"rim/{name}"] = heaven.matrix_world @ Vector(
            (0.159 * math.cos(angle), 0.159 * math.sin(angle), rim_z)
        )
    for name in "午未申酉戌亥子丑寅卯辰巳":
        points[f"branch/{name}"] = bpy.data.objects[f"branch/earth/{name}"].matrix_world.translation.copy()
    for name in ("胜光", "小吉", "传送", "从魁", "河魁", "登明", "神后", "大吉", "功曹", "太冲", "天罡", "太乙"):
        points[f"month/{name}"] = bpy.data.objects[f"month-general/{name}"].matrix_world.translation.copy()
    for name in ("noble", "snake", "vermilion-bird", "harmony", "hook-array", "azure-dragon", "void", "white-tiger", "constant", "black-tortoise", "yin", "queen-of-heaven"):
        points[f"general/{name}"] = bpy.data.objects[f"general/{name}"].matrix_world.translation.copy()
    return points


def _configure(camera, parameters):
    x, y, z, tx, ty, tz, lens, shift_x, shift_y = parameters
    camera.location = (x, y, z)
    camera.rotation_euler = (Vector((tx, ty, tz)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = lens
    camera.data.shift_x = shift_x
    camera.data.shift_y = shift_y
    bpy.context.view_layer.update()


def _pixel(scene, camera, point):
    projected = world_to_camera_view(scene, camera, point)
    return (projected.x * REFERENCE_SIZE[0], (1.0 - projected.y) * REFERENCE_SIZE[1])


def _cost(scene, camera, points):
    weights = {
        "board": 3.0,
        "dial": 5.0,
        "pearl": 3.0,
        "beidou": 3.0,
        "rim": 4.0,
        "branch": 1.5,
        "month": 1.5,
        "general": 1.5,
    }
    total = 0.0
    weight_total = 0.0
    for name, point in points.items():
        dx, dy = (value - target for value, target in zip(_pixel(scene, camera, point), REFERENCE_ANCHORS[name]))
        weight = weights[name.split("/", 1)[0]]
        total += weight * (dx * dx + dy * dy)
        weight_total += weight
    return total / weight_total


def calibrate_v10_camera(scene=None):
    """Nelder-Mead fit of the review camera against recorded v10 anchors."""
    scene = scene or bpy.context.scene
    scene.render.resolution_x, scene.render.resolution_y = REFERENCE_SIZE
    scene.render.resolution_percentage = 100
    camera = bpy.data.objects["camera/overall"]
    points = _world_points()
    def evaluate(normalized):
        values = [seed + offset * scale for seed, offset, scale in zip(_SEED, normalized, _STEPS)]
        _configure(camera, values)
        return _cost(scene, camera, points)

    simplex = [[0.0] * len(_SEED)]
    simplex.extend(
        [1.0 if index == axis else 0.0 for index in range(len(_SEED))]
        for axis in range(len(_SEED))
    )
    scores = [evaluate(point) for point in simplex]
    for _ in range(360):
        order = sorted(range(len(simplex)), key=lambda index: scores[index])
        simplex = [simplex[index] for index in order]
        scores = [scores[index] for index in order]
        centroid = [
            sum(point[index] for point in simplex[:-1]) / len(_SEED)
            for index in range(len(_SEED))
        ]
        worst = simplex[-1]
        reflected = [2 * center - value for center, value in zip(centroid, worst)]
        reflected_score = evaluate(reflected)
        if reflected_score < scores[0]:
            expanded = [3 * center - 2 * value for center, value in zip(centroid, worst)]
            expanded_score = evaluate(expanded)
            simplex[-1], scores[-1] = (
                (expanded, expanded_score) if expanded_score < reflected_score else (reflected, reflected_score)
            )
        elif reflected_score < scores[-2]:
            simplex[-1], scores[-1] = reflected, reflected_score
        else:
            contracted = [0.5 * (center + value) for center, value in zip(centroid, worst)]
            contracted_score = evaluate(contracted)
            if contracted_score < scores[-1]:
                simplex[-1], scores[-1] = contracted, contracted_score
            else:
                for index in range(1, len(simplex)):
                    simplex[index] = [
                        best + 0.5 * (value - best)
                        for best, value in zip(simplex[0], simplex[index])
                    ]
                    scores[index] = evaluate(simplex[index])
        if max(scores) - min(scores) < 0.0001:
            break
    best_index = min(range(len(simplex)), key=lambda index: scores[index])
    values = [
        seed + offset * scale
        for seed, offset, scale in zip(_SEED, simplex[best_index], _STEPS)
    ]
    best = scores[best_index]
    _configure(camera, values)
    camera["v10_calibration_parameters"] = tuple(round(value, 8) for value in values)
    camera["v10_calibration_cost_px2"] = round(best, 6)
    return camera


def projection_metrics(scene=None):
    scene = scene or bpy.context.scene
    camera = bpy.data.objects["camera/overall"]
    points = _world_points()
    errors = {}
    for name, point in points.items():
        predicted = _pixel(scene, camera, point)
        target = REFERENCE_ANCHORS[name]
        errors[name] = math.hypot(predicted[0] - target[0], predicted[1] - target[1])

    def rms(prefix):
        selected = [value * value for name, value in errors.items() if name.startswith(prefix)]
        return math.sqrt(sum(selected) / len(selected))

    return {
        "board_rms_px": rms("board/"),
        "dial_center_error_px": errors["dial/center"],
        "pearl_rms_px": rms("pearl/"),
        "beidou_rms_px": rms("beidou/"),
        "rim_rms_px": rms("rim/"),
        "branch_rms_px": rms("branch/"),
        "month_rms_px": rms("month/"),
        "general_rms_px": rms("general/"),
        "rms_px": math.sqrt(sum(value * value for value in errors.values()) / len(errors)),
        "errors_px": errors,
    }
