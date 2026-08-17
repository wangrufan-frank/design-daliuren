DIMENSIONS = {
    "base": (0.520, 0.520, 0.052),
    "heaven_plate": (0.380, 0.024),
    "lesson": (0.152, 0.100),
    "bridge_width": 0.420,
    "slip_rise": 0.012,
    "lesson_travel": 0.092,
    "lesson_readout_rise": 0.008,
    "bridge_travel": 0.118,
    "general_rise": 0.007,
}

NODE_IDS = (
    "artifact/root", "base/body", "plate/earth", "plate/heaven",
    "calendar/slip", "lesson/first", "lesson/second",
    "lesson/third", "lesson/fourth", "transmission/bridge",
    "transmission/initial", "transmission/middle", "transmission/final",
    "general/noble", "general/snake", "general/vermilion-bird",
    "general/harmony", "general/hook-array", "general/azure-dragon",
    "general/void", "general/white-tiger", "general/constant",
    "general/black-tortoise", "general/yin", "general/queen-of-heaven",
    "anchor/course-copy/lessons", "anchor/course-copy/transmissions",
    "anchor/course-copy/generals",
)

POSE_IDS = ("closed", "calendar", "plate", "lessons", "transmissions", "generals")

# Fixed interior keep-out volumes used by the graybox's coarse AABB clearance gate.
BASE_INTERIOR_COLLISION_BOXES = (
    ("base/interior-core", (-0.080, -0.080, 0.052), (0.080, 0.080, 0.095)),
    ("base/interior-north-rail", (-0.035, 0.080, 0.052), (0.035, 0.160, 0.095)),
    ("base/interior-south-rail", (-0.035, -0.160, 0.052), (0.035, -0.080, 0.095)),
    ("base/interior-east-rail", (0.080, -0.035, 0.052), (0.160, 0.035, 0.095)),
    ("base/interior-west-rail", (-0.160, -0.035, 0.052), (-0.080, 0.035, 0.095)),
)
