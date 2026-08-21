import json
import math
from dataclasses import dataclass
from pathlib import Path

import bpy


REPOSITORY_ROOT = Path(__file__).parents[2]
FIXED_INSCRIPTIONS_PATH = (
    REPOSITORY_ROOT / "assets/daliuren/inscriptions/fixed-inscriptions.json"
)
ROLE_ANGLES = {
    "earth-branch": 12,
    "historical-beidou": 7,
    "historical-mansion": 28,
    "historical-month-deity": 12,
    "mechanical-scale": 12,
}
HISTORICAL_ROLES = {
    "historical-beidou",
    "historical-mansion",
    "historical-month-deity",
}
FUNCTIONAL_ROLES = {"earth-branch", "mechanical-scale"}
ROLE_CONTRASTS = {
    **{role: "historical-low" for role in HISTORICAL_ROLES},
    **{role: "functional-high" for role in FUNCTIONAL_ROLES},
}
DYNAMIC_PARENT_PREFIXES = (
    "calendar/slip",
    "lesson/",
    "transmission/",
    "general/",
)
TEXT_SIZES = {
    "earth-branch": 0.010,
    "historical-beidou": 0.0045,
    "historical-mansion": 0.0048,
    "historical-month-deity": 0.0045,
    "mechanical-scale": 0.0055,
}


@dataclass(frozen=True, slots=True)
class Inscription:
    role: str
    text: str
    angular_index: int
    radius: float
    depth: float
    contrast_tier: str


def load_fixed_inscriptions(path: Path | str) -> tuple[Inscription, ...]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    items = tuple(
        Inscription(
            role=item["role"],
            text=item["text"],
            angular_index=item["angularIndex"],
            radius=item["radius"],
            depth=item["depth"],
            contrast_tier=item["contrastTier"],
        )
        for item in payload["inscriptions"]
    )
    seen_texts = {role: set() for role in ROLE_ANGLES}
    seen_indices = {role: set() for role in ROLE_ANGLES}
    for item in items:
        if not isinstance(item.role, str) or item.role not in ROLE_ANGLES:
            raise ValueError(f"Unknown fixed inscription role: {item.role!r}")
        if not isinstance(item.text, str) or not item.text:
            raise TypeError(f"Fixed inscription text must be a non-empty string: {item.text!r}")
        if not isinstance(item.contrast_tier, str):
            raise TypeError("Fixed inscription contrast tier must be a string")
        if item.contrast_tier != ROLE_CONTRASTS[item.role]:
            raise ValueError(
                f"Invalid contrast tier for {item.role}: {item.contrast_tier!r}"
            )
        if not isinstance(item.angular_index, int) or isinstance(item.angular_index, bool):
            raise TypeError("Fixed inscription angular index must be an integer")
        if item.text in seen_texts[item.role]:
            raise ValueError(f"Duplicate {item.role} text: {item.text}")
        if item.angular_index in seen_indices[item.role]:
            raise ValueError(
                f"Duplicate {item.role} angular index: {item.angular_index}"
            )
        seen_texts[item.role].add(item.text)
        seen_indices[item.role].add(item.angular_index)

    for role, count in ROLE_ANGLES.items():
        if seen_indices[role] != set(range(count)):
            raise ValueError(f"Incomplete or unordered angular indices for {role}")
    return items


def _add_mesh_text(
    item: Inscription,
    index: int,
    parent: bpy.types.Object,
    font: bpy.types.VectorFont,
    surface_z: float,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(
        name=f"inscription/{item.role}/{index:02d}/curve",
        type="FONT",
    )
    curve.body = item.text
    curve.font = font
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.size = TEXT_SIZES[item.role]
    curve.extrude = item.depth / 2
    curve.resolution_u = 4

    object_name = f"inscription/{item.role}/{index:02d}"
    obj = bpy.data.objects.new(object_name, curve)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent

    angle = math.radians(90 - item.angular_index * 360 / ROLE_ANGLES[item.role])
    obj.location = (
        item.radius * math.cos(angle),
        item.radius * math.sin(angle),
        surface_z - item.depth / 2,
    )
    obj.rotation_euler.z = angle - math.pi / 2
    obj["inscription_role"] = item.role
    obj["inscription_text"] = item.text
    obj["angular_index"] = item.angular_index
    obj["inscription_depth"] = item.depth
    obj["contrast_tier"] = item.contrast_tier
    obj["surface_treatment"] = (
        "engraving-cutter" if item.role in HISTORICAL_ROLES else "flush-inlay"
    )

    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)
    return obj


def build_fixed_inscriptions(
    parent: bpy.types.Object, font_path: Path | str
) -> list[bpy.types.Object]:
    current = parent
    while current is not None:
        identities = (current.name, current.get("node_id"))
        for identity in identities:
            if not isinstance(identity, str):
                continue
            if identity == "calendar/slip" or identity.startswith(
                DYNAMIC_PARENT_PREFIXES
            ):
                raise ValueError(
                    f"Fixed inscriptions cannot be parented under dynamic node {identity}"
                )
        current = current.parent

    font_path = Path(font_path).resolve()
    if not font_path.is_file():
        raise FileNotFoundError(font_path)

    items = load_fixed_inscriptions(FIXED_INSCRIPTIONS_PATH)
    font = bpy.data.fonts.load(str(font_path), check_existing=True)
    surface_z = max(corner[2] for corner in parent.bound_box)
    return [
        _add_mesh_text(item, index, parent, font, surface_z)
        for index, item in enumerate(items)
    ]
