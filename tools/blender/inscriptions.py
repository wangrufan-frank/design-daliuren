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
    return tuple(
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
        surface_z + item.depth / 2,
    )
    obj.rotation_euler.z = angle - math.pi / 2
    obj["inscription_role"] = item.role
    obj["inscription_text"] = item.text
    obj["angular_index"] = item.angular_index
    obj["inscription_depth"] = item.depth
    obj["contrast_tier"] = item.contrast_tier

    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)
    return obj


def build_fixed_inscriptions(
    parent: bpy.types.Object, font_path: Path | str
) -> list[bpy.types.Object]:
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
