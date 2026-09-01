import math


GENERAL_SECTOR_INNER_RADIUS = 0.064
GENERAL_SECTOR_OUTER_RADIUS = 0.108
GENERAL_SECTOR_ANGLE_DEG = 30.0
GENERAL_RADIAL_CLEARANCE_M = 0.00008
GENERAL_ANGULAR_CLEARANCE_DEG = 0.12
GENERAL_INLAY_DEPTH_M = 0.004
GENERAL_INLAY_HALF_ANGLE_RAD = math.radians(
    (GENERAL_SECTOR_ANGLE_DEG - 2 * GENERAL_ANGULAR_CLEARANCE_DEG) / 2
)
GENERAL_INLAY_DIMENSIONS = (
    2 * (GENERAL_SECTOR_OUTER_RADIUS - GENERAL_RADIAL_CLEARANCE_M) * math.sin(GENERAL_INLAY_HALF_ANGLE_RAD),
    (GENERAL_SECTOR_OUTER_RADIUS - GENERAL_RADIAL_CLEARANCE_M)
    - (GENERAL_SECTOR_INNER_RADIUS + GENERAL_RADIAL_CLEARANCE_M) * math.cos(GENERAL_INLAY_HALF_ANGLE_RAD),
    GENERAL_INLAY_DEPTH_M,
)

MONTH_GENERAL_RADIUS_M = 0.118
FIXED_CORE_DIAMETER_M = 0.112
DIAL_CENTER_OFFSET_M = (-0.0078, -0.0237)


DIMENSIONS = {
    "base": (0.520, 0.520, 0.028),
    "earth_plate": (0.500, 0.500, 0.006),
    "heaven_plate": (0.332, 0.010),
    "general_ring": (0.218, 0.007),
    "fixed_core": (FIXED_CORE_DIAMETER_M, 0.006),
    "calendar_slip": (0.300, 0.038, 0.009),
    "lesson_slip": (0.074, 0.034, 0.009),
    "transmission_slip": (0.070, 0.036, 0.010),
    "method_slip": (0.098, 0.024, 0.008),
    "general_inlay": GENERAL_INLAY_DIMENSIONS,
}

BRANCHES = tuple("子丑寅卯辰巳午未申酉戌亥")
VISUAL_EARTH_ORDER = tuple("午未申酉戌亥子丑寅卯辰巳")
VISUAL_MONTH_ORDER = (
    "胜光", "小吉", "传送", "从魁", "河魁", "登明",
    "神后", "大吉", "功曹", "太冲", "天罡", "太乙",
)
BRANCH_INLAY_NODE_IDS = tuple(f"branch/earth/{branch}" for branch in BRANCHES)


def visual_angle(index):
    return math.radians(90 - index * 30)

NODE_IDS = (
    "artifact/root", "base/body", "plate/earth", "plate/heaven",
    "plate/generals", "plate/core",
    "calendar/slip", "lesson/first", "lesson/second",
    "lesson/third", "lesson/fourth", "transmission/initial",
    "transmission/middle", "transmission/final", "transmission/method",
    "general/noble", "general/snake", "general/vermilion-bird",
    "general/harmony", "general/hook-array", "general/azure-dragon",
    "general/void", "general/white-tiger", "general/constant",
    "general/black-tortoise", "general/yin", "general/queen-of-heaven",
    *BRANCH_INLAY_NODE_IDS,
    *(f"general-slot/{branch}" for branch in BRANCHES),
    *(f"month-general/{month}" for month in VISUAL_MONTH_ORDER),
    "interaction/month-general-ring",
    "trace/course",
)

POSE_IDS = ("closed", "calendar", "plate", "lessons", "transmissions", "generals")

# Fixed interior keep-out volumes used by the graybox's coarse AABB clearance gate.
BASE_INTERIOR_COLLISION_BOXES = (
    ("base/interior-core", (-0.080, -0.080, 0.052), (0.080, 0.080, 0.095)),
    ("base/interior-north-channel", (-0.035, 0.080, 0.052), (0.035, 0.160, 0.095)),
    ("base/interior-south-channel", (-0.035, -0.160, 0.052), (0.035, -0.080, 0.095)),
    ("base/interior-east-channel", (0.080, -0.035, 0.052), (0.160, 0.035, 0.095)),
    ("base/interior-west-channel", (-0.160, -0.035, 0.052), (-0.080, 0.035, 0.095)),
)
