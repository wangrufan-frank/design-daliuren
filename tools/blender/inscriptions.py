import json
import math
from dataclasses import dataclass
from pathlib import Path

import bpy

from geometry import add_beveled_box


REPOSITORY_ROOT = Path(__file__).parents[2]
FIXED_INSCRIPTIONS_PATH = (
    REPOSITORY_ROOT / "assets/daliuren/inscriptions/fixed-inscriptions.json"
)
ROLE_ANGLES = {
    "earth-branch": 12,
    "heaven-branch": 12,
    "historical-beidou": 7,
    "historical-mansion": 28,
    "historical-month-deity": 12,
}
HISTORICAL_ROLES = {
    "historical-beidou",
    "historical-mansion",
    "historical-month-deity",
}
FUNCTIONAL_ROLES = {"earth-branch", "heaven-branch"}
ROLE_CONTRASTS = {
    **{role: "historical-low" for role in HISTORICAL_ROLES},
    **{role: "functional-high" for role in FUNCTIONAL_ROLES},
}
ROLE_PARENTS = {
    "earth-branch": "earth",
    "heaven-branch": "heaven",
    **{role: "heaven" for role in HISTORICAL_ROLES},
}
DYNAMIC_PARENT_PREFIXES = (
    "calendar/slip",
    "lesson/",
    "transmission/",
    "general/",
)
TEXT_SIZES = {
    "earth-branch": 0.020,
    "heaven-branch": 0.018,
    "historical-beidou": 0.0045,
    "historical-mansion": 0.0048,
    "historical-month-deity": 0.0045,
}
FUNCTIONAL_GLYPH_SPAN = 0.0496
FUNCTIONAL_GLYPH_MESH_SPAN = 0.044
BRANCH_BED_SPAN = 0.052
BRANCH_BED_MESH_SPAN = 0.048
BRANCH_RECESS = 0.00015
BRANCH_CUTTER_OVERLAP = 0.00010
BRANCH_BED_RECESS = 0.00100
BRANCH_BED_DEPTH = 0.00065
BRANCH_GROOVE_DEPTH = 0.00120


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
            raise TypeError(
                f"Fixed inscription text must be a non-empty string: {item.text!r}"
            )
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


def _validate_fixed_parent(parent: bpy.types.Object):
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


def _add_mesh_text(
    item: Inscription,
    index: int,
    parent: bpy.types.Object,
    font: bpy.types.VectorFont,
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

    surface = ROLE_PARENTS[item.role]
    object_name = (
        f"branch/{surface}/{item.text}"
        if item.role in FUNCTIONAL_ROLES
        else f"inscription/{item.role}/{index:02d}"
    )
    obj = bpy.data.objects.new(object_name, curve)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent

    angle = math.radians(90 - item.angular_index * 360 / ROLE_ANGLES[item.role])
    obj.location = (
        item.radius * math.cos(angle),
        item.radius * math.sin(angle),
        0.0,
    )
    obj.rotation_euler.z = angle - math.pi / 2
    obj["inscription_role"] = item.role
    obj["inscription_text"] = item.text
    obj["angular_index"] = item.angular_index
    obj["inscription_depth"] = item.depth
    obj["contrast_tier"] = item.contrast_tier
    obj["surface_treatment"] = (
        "engraving-cutter" if item.role in HISTORICAL_ROLES else "recessed-inlay"
    )
    if item.role in FUNCTIONAL_ROLES:
        obj["node_id"] = object_name
        obj["surface"] = surface
        obj["branch"] = item.text
        obj["ring_index"] = item.angular_index

    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)
    if item.role in FUNCTIONAL_ROLES:
        for axis in (0, 1):
            minimum = min(vertex.co[axis] for vertex in obj.data.vertices)
            maximum = max(vertex.co[axis] for vertex in obj.data.vertices)
            center = (minimum + maximum) / 2
            scale = FUNCTIONAL_GLYPH_MESH_SPAN / (maximum - minimum)
            for vertex in obj.data.vertices:
                vertex.co[axis] = (vertex.co[axis] - center) * scale
        obj.scale.x = FUNCTIONAL_GLYPH_SPAN / FUNCTIONAL_GLYPH_MESH_SPAN
        obj.scale.y = FUNCTIONAL_GLYPH_SPAN / FUNCTIONAL_GLYPH_MESH_SPAN
        obj.data.update()
    surface_z = max(corner[2] for corner in parent.bound_box)
    local_top = max(vertex.co.z for vertex in obj.data.vertices)
    obj.location.z = surface_z - local_top
    if item.role in FUNCTIONAL_ROLES:
        obj.location.z += BRANCH_CUTTER_OVERLAP
    return obj


def _duplicate_mesh(source, name, copy_data=False):
    duplicate = source.copy()
    duplicate.data = source.data.copy() if copy_data else source.data
    duplicate.name = name
    for key in list(duplicate.keys()):
        del duplicate[key]
    bpy.context.scene.collection.objects.link(duplicate)
    return duplicate


def _apply_exact_difference(parent, cutter, label):
    bpy.ops.object.select_all(action="DESELECT")
    parent.select_set(True)
    bpy.context.view_layer.objects.active = parent
    modifier = parent.modifiers.new(name=f"cut {label}", type="BOOLEAN")
    modifier.operation = "DIFFERENCE"
    modifier.solver = "EXACT"
    modifier.object = cutter
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def _recess_mesh_top(obj, depth):
    minimum_z = min(vertex.co.z for vertex in obj.data.vertices)
    maximum_z = max(vertex.co.z for vertex in obj.data.vertices)
    removed_height = BRANCH_CUTTER_OVERLAP + depth
    scale = (maximum_z - minimum_z - removed_height) / (maximum_z - minimum_z)
    for vertex in obj.data.vertices:
        vertex.co.z = minimum_z + (vertex.co.z - minimum_z) * scale
    obj.data.update()


def _cut_branch_recess(parent, inlay):
    cutter = _duplicate_mesh(inlay, f"cutter/{inlay['node_id']}")
    _apply_exact_difference(parent, cutter, inlay["node_id"])

    bed_name = f"detail/branch-bed/{inlay['surface']}/{inlay['branch']}"
    surface_z = max(corner[2] for corner in parent.bound_box)
    bed = add_beveled_box(
        bed_name,
        (BRANCH_BED_MESH_SPAN, BRANCH_BED_MESH_SPAN, BRANCH_BED_DEPTH),
        (0.0, 0.0, 0.0),
        0.0012,
    )
    del bed["node_id"]
    bed.parent = parent
    bed.location = (
        inlay.location.x,
        inlay.location.y,
        surface_z - BRANCH_BED_RECESS - BRANCH_BED_DEPTH / 2,
    )
    bed.rotation_euler.z = inlay.rotation_euler.z
    bed.scale.x = BRANCH_BED_SPAN / BRANCH_BED_MESH_SPAN
    bed.scale.y = BRANCH_BED_SPAN / BRANCH_BED_MESH_SPAN
    if inlay["surface"] == "heaven":
        angle = bed.rotation_euler.z
        cosine = math.cos(angle)
        sine = math.sin(angle)
        radius_limit = parent.dimensions.x / 2 - 1e-6
        for vertex in bed.data.vertices:
            scaled_x = vertex.co.x * bed.scale.x
            scaled_y = vertex.co.y * bed.scale.y
            parent_x = bed.location.x + cosine * scaled_x - sine * scaled_y
            parent_y = bed.location.y + sine * scaled_x + cosine * scaled_y
            radius = math.hypot(parent_x, parent_y)
            if radius <= radius_limit:
                continue
            parent_x *= radius_limit / radius
            parent_y *= radius_limit / radius
            delta_x = parent_x - bed.location.x
            delta_y = parent_y - bed.location.y
            vertex.co.x = (cosine * delta_x + sine * delta_y) / bed.scale.x
            vertex.co.y = (-sine * delta_x + cosine * delta_y) / bed.scale.y
        bed.data.update()
    bed["detail_id"] = "structure/bronze-inlay-branch-bed"
    bed["detail_index"] = inlay["ring_index"]
    bed["owner_node_id"] = parent["node_id"]
    bed["surface_treatment"] = "recessed-bed"
    bed["material_variant"] = "ink-bronze"

    bed_cutter = _duplicate_mesh(bed, f"cutter/{bed_name}")
    bed_cutter.location.z = (
        surface_z + BRANCH_CUTTER_OVERLAP - BRANCH_GROOVE_DEPTH / 2
    )
    bed_cutter.scale.z = BRANCH_GROOVE_DEPTH / BRANCH_BED_DEPTH
    _apply_exact_difference(parent, bed_cutter, bed_name)

    _recess_mesh_top(inlay, BRANCH_RECESS)


def build_fixed_inscriptions(
    earth_plate: bpy.types.Object,
    heaven_plate: bpy.types.Object,
    font_path: Path | str,
    roles=None,
) -> list[bpy.types.Object]:
    _validate_fixed_parent(earth_plate)
    _validate_fixed_parent(heaven_plate)
    if earth_plate.get("node_id") != "plate/earth":
        raise ValueError("Earth inscriptions require plate/earth")
    if heaven_plate.get("node_id") != "plate/heaven":
        raise ValueError("Heaven inscriptions require plate/heaven")

    font_path = Path(font_path).resolve()
    if not font_path.is_file():
        raise FileNotFoundError(font_path)

    indexed_items = tuple(enumerate(load_fixed_inscriptions(FIXED_INSCRIPTIONS_PATH)))
    if roles is not None:
        indexed_items = tuple(
            (index, item) for index, item in indexed_items if item.role in roles
        )
    for _, item in indexed_items:
        if item.role in FUNCTIONAL_ROLES:
            node_id = f"branch/{ROLE_PARENTS[item.role]}/{item.text}"
            if bpy.data.objects.get(node_id) is not None:
                raise RuntimeError(f"Fixed inscription already exists: {node_id}")

    font = bpy.data.fonts.load(str(font_path), check_existing=True)
    parents = {"earth": earth_plate, "heaven": heaven_plate}
    objects = [
        _add_mesh_text(item, index, parents[ROLE_PARENTS[item.role]], font)
        for index, item in indexed_items
    ]
    for obj in objects:
        if obj.get("inscription_role") in FUNCTIONAL_ROLES:
            _cut_branch_recess(obj.parent, obj)
    bpy.context.view_layer.update()
    return objects
