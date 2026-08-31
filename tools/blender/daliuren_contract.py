DIMENSIONS = {
    "base": (0.520, 0.520, 0.052),
    "earth_plate": (0.440, 0.440, 0.014),
    "heaven_plate": (0.380, 0.026),
    "general_ring": (0.250, 0.018),
    "fixed_core": (0.140, 0.018),
    "calendar_slip": (0.300, 0.038, 0.009),
    "lesson_slip": (0.074, 0.034, 0.009),
    "transmission_slip": (0.070, 0.036, 0.010),
    "method_slip": (0.098, 0.024, 0.008),
    "general_inlay": (0.028, 0.004),
}

BRANCHES = tuple("子丑寅卯辰巳午未申酉戌亥")
BRANCH_INLAY_NODE_IDS = tuple(
    f"branch/{surface}/{branch}"
    for surface in ("earth", "heaven")
    for branch in BRANCHES
)

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
