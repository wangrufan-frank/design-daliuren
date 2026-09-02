import json
import math
from dataclasses import dataclass
from pathlib import Path

import bpy
from mathutils import Vector

from daliuren_contract import DIAL_CENTER_OFFSET_M, VISUAL_ORIENTATION_OFFSET_DEG

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
    "earth-branch": 0.030,
    "heaven-branch": 0.018,
    "historical-beidou": 0.0045,
    "historical-mansion": 0.0048,
    "historical-month-deity": 0.0045,
}
FUNCTIONAL_GLYPH_SPANS = {
    "earth": (0.015, 0.020),
    "heaven": (0.0496, 0.044),
}
BRANCH_BED_SPANS = {
    "earth": (0.052, 0.052),
    "heaven": (0.052, 0.05199),
}
BRANCH_BED_MESH_SPAN = 0.048
HEAVEN_BRANCH_BED_RADIUS_LIMIT = 0.18999
HEAVEN_BRANCH_BED_ARC_SEGMENTS = 16
BRANCH_RECESS = 0.00015
BRANCH_CUTTER_OVERLAP = 0.00010
BRANCH_BED_RECESS = 0.00100
BRANCH_BED_DEPTH = 0.00065
BRANCH_GROOVE_DEPTH = 0.00120
FUNCTIONAL_GLYPH_CARRIER_RELIEF = 0.00010


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

    orientation_offset = VISUAL_ORIENTATION_OFFSET_DEG if item.role == "earth-branch" else 0.0
    angle = math.radians(
        90 + orientation_offset - item.angular_index * 360 / ROLE_ANGLES[item.role]
    )
    center = DIAL_CENTER_OFFSET_M if item.role == "earth-branch" else (0.0, 0.0)
    obj.location = (
        center[0] + item.radius * math.cos(angle),
        center[1] + item.radius * math.sin(angle),
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
        glyph_span, mesh_span = FUNCTIONAL_GLYPH_SPANS[surface]
        for axis in (0, 1):
            minimum = min(vertex.co[axis] for vertex in obj.data.vertices)
            maximum = max(vertex.co[axis] for vertex in obj.data.vertices)
            center = (minimum + maximum) / 2
            scale = mesh_span / (maximum - minimum)
            for vertex in obj.data.vertices:
                vertex.co[axis] = (vertex.co[axis] - center) * scale
        obj.scale.x = glyph_span / mesh_span
        obj.scale.y = glyph_span / mesh_span
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


def _add_heaven_branch_bed(name, radial_center):
    span_x, span_y = BRANCH_BED_SPANS["heaven"]
    half_x = span_x / 2
    outer_y = HEAVEN_BRANCH_BED_RADIUS_LIMIT - radial_center
    inner_y = outer_y - span_y
    outline = [(-half_x, inner_y), (half_x, inner_y)]
    for index in range(HEAVEN_BRANCH_BED_ARC_SEGMENTS + 1):
        x = half_x - span_x * index / HEAVEN_BRANCH_BED_ARC_SEGMENTS
        y = math.sqrt(HEAVEN_BRANCH_BED_RADIUS_LIMIT**2 - x**2) - radial_center
        outline.append((x, y))

    scale_x = span_x / BRANCH_BED_MESH_SPAN
    scale_y = span_y / BRANCH_BED_MESH_SPAN
    half_depth = BRANCH_BED_DEPTH / 2
    vertices = [
        (x / scale_x, y / scale_y, z)
        for z in (-half_depth, half_depth)
        for x, y in outline
    ]
    count = len(outline)
    faces = [
        tuple(reversed(range(count))),
        tuple(range(count, count * 2)),
        *(
            (index, (index + 1) % count, count + (index + 1) % count, count + index)
            for index in range(count)
        ),
    ]
    mesh = bpy.data.meshes.new(f"{name}/mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(clean_customdata=False)
    mesh.update()
    bed = bpy.data.objects.new(name, mesh)
    bed["node_id"] = name
    bpy.context.scene.collection.objects.link(bed)
    return bed


def _cut_branch_recess(parent, inlay):
    cutter = _duplicate_mesh(inlay, f"cutter/{inlay['node_id']}")
    _apply_exact_difference(parent, cutter, inlay["node_id"])

    if inlay["surface"] == "earth":
        _recess_mesh_top(inlay, BRANCH_RECESS)
        return

    bed_name = f"detail/branch-bed/{inlay['surface']}/{inlay['branch']}"
    surface_z = max(corner[2] for corner in parent.bound_box)
    bed = _add_heaven_branch_bed(
        bed_name,
        math.hypot(inlay.location.x, inlay.location.y),
    )
    del bed["node_id"]
    bed.parent = parent
    bed.location = (
        inlay.location.x,
        inlay.location.y,
        surface_z - BRANCH_BED_RECESS - BRANCH_BED_DEPTH / 2,
    )
    bed.rotation_euler.z = inlay.rotation_euler.z
    bed_span_x, bed_span_y = BRANCH_BED_SPANS[inlay["surface"]]
    bed.scale.x = bed_span_x / BRANCH_BED_MESH_SPAN
    bed.scale.y = bed_span_y / BRANCH_BED_MESH_SPAN
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
    earth_glyphs = []
    for obj in objects:
        if obj.get("inscription_role") in FUNCTIONAL_ROLES:
            _cut_branch_recess(obj.parent, obj)
            if obj.get("inscription_role") == "earth-branch":
                earth_glyphs.append(obj)
    bpy.context.view_layer.update()
    if earth_glyphs:
        carriers = [
            heaven_plate,
            *(obj for obj in bpy.data.objects if obj.get("domain") == "general"),
            *(obj for obj in bpy.data.objects if obj.name.startswith("detail/heaven/linked-ring-")),
        ]
        carrier_top = max(
            max((obj.matrix_world @ Vector(corner)).z for corner in obj.bound_box)
            for obj in carriers
        )
        for glyph in earth_glyphs:
            glyph_bottom = min(
                (glyph.matrix_world @ Vector(corner)).z for corner in glyph.bound_box
            )
            glyph.location.z += carrier_top + FUNCTIONAL_GLYPH_CARRIER_RELIEF - glyph_bottom
        bpy.context.view_layer.update()
    return objects
