import sys
import tempfile
import unittest
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).parents[1]))

from build_graybox import build_graybox, build_master
from daliuren_contract import BASE_INTERIOR_COLLISION_BOXES, NODE_IDS
from high_detail_geometry import upgrade_to_high_detail
from poses import apply_pose


REQUIRED_BEVELED_ROOTS = (
    "base/body",
    "plate/earth",
    "plate/heaven",
    "transmission/initial",
    "transmission/middle",
    "transmission/final",
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
EXPECTED_DETAIL_COUNTS = {
    "structure/base-shell-thickness": 4,
    "structure/base-bottom-seam": 1,
    "structure/base-corner-transition": 4,
    "structure/heaven-bronze-rim": 1,
    "structure/heaven-support-rib": 4,
    "mechanism/heaven-bearing": 1,
    "mechanism/heaven-detent": 12,
    "structure/heaven-inlay-bed": 12,
    "mechanism/lesson-dovetails": 4,
    "mechanism/lesson-end-stop": 4,
    "mechanism/lesson-readout-bed": 4,
    "mechanism/lesson-general-socket": 4,
    "structure/bridge-support": 1,
    "mechanism/transmission-tenon": 3,
    "mechanism/bridge-stops": 1,
    "mechanism/general-track": 1,
    "mechanism/general-seal-interface": 12,
    "structure/bronze-celadon-contact-seam": 12,
}
MOTION_KEYS = (
    "closed_location",
    "open_location",
    "motion_axis",
    "travel_m",
    "closed_rotation_euler",
    "open_location_forward",
    "open_location_reverse",
)
MOVING_RUNTIME_IDS = {
    "calendar/slip",
    "lesson/first",
    "lesson/second",
    "lesson/third",
    "lesson/fourth",
    "transmission/bridge",
    *(node_id for node_id in NODE_IDS if node_id.startswith("general/")),
}
FORBIDDEN_DYNAMIC_TEXT = {"贵人", "初传", "中传", "末传", "父母", "官鬼"}


def rounded(values):
    return tuple(round(float(value), 7) for value in values)


def runtime_contract_snapshot():
    result = {}
    for obj in bpy.data.objects:
        node_id = obj.get("node_id")
        if not node_id:
            continue
        motion = {}
        for key in MOTION_KEYS:
            if key not in obj:
                continue
            value = obj[key]
            motion[key] = rounded(value) if hasattr(value, "__len__") else float(value)
        result[node_id] = {
            "parent": obj.parent.get("node_id") if obj.parent else None,
            "location": rounded(obj.location),
            "rotation": rounded(obj.rotation_euler),
            "scale": rounded(obj.scale),
            "dimensions": rounded(obj.dimensions),
            "motion": motion,
        }
    return result


def details(detail_id):
    return [obj for obj in bpy.data.objects if obj.get("detail_id") == detail_id]


def local_axis_bounds(obj, axis):
    values = [obj.location[axis] + corner[axis] for corner in obj.bound_box]
    return min(values), max(values)


def world_bounds(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        tuple(min(corner[axis] for corner in corners) for axis in range(3)),
        tuple(max(corner[axis] for corner in corners) for axis in range(3)),
    )


def local_bounds(obj):
    return (
        tuple(min(corner[axis] for corner in obj.bound_box) for axis in range(3)),
        tuple(max(corner[axis] for corner in obj.bound_box) for axis in range(3)),
    )


def boxes_overlap(first, second):
    first_min, first_max = first
    second_min, second_max = second
    return all(
        first_min[axis] < second_max[axis]
        and first_max[axis] > second_min[axis]
        for axis in range(3)
    )


def contains(outer, inner, tolerance=0.0000001):
    outer_min, outer_max = outer
    inner_min, inner_max = inner
    return all(
        inner_min[axis] >= outer_min[axis] - tolerance
        and inner_max[axis] <= outer_max[axis] + tolerance
        for axis in range(3)
    )


def moving_group(obj):
    current = obj
    while current is not None:
        node_id = current.get("node_id")
        if node_id in MOVING_RUNTIME_IDS:
            return node_id
        current = current.parent
    return None


def evaluated_bvh(obj, dependency_graph):
    evaluated = obj.evaluated_get(dependency_graph)
    mesh = evaluated.to_mesh()
    matrix = evaluated.matrix_world
    vertices = [matrix @ vertex.co for vertex in mesh.vertices]
    polygons = [tuple(polygon.vertices) for polygon in mesh.polygons]
    tree = BVHTree.FromPolygons(vertices, polygons, all_triangles=False)
    evaluated.to_mesh_clear()
    return tree


def evaluated_world_vertices(obj, dependency_graph):
    evaluated = obj.evaluated_get(dependency_graph)
    mesh = evaluated.to_mesh()
    matrix = evaluated.matrix_world
    vertices = [matrix @ vertex.co for vertex in mesh.vertices]
    evaluated.to_mesh_clear()
    return vertices


def point_inside_solid(tree, point):
    direction = Vector((1.0, 0.371, 0.127)).normalized()
    origin = point.copy()
    remaining = 10.0
    crossings = 0
    for _ in range(256):
        location, _, _, distance = tree.ray_cast(origin, direction, remaining)
        if location is None:
            break
        crossings += 1
        step = max(distance, 0.0) + 0.0000001
        origin = origin + direction * step
        remaining -= step
        if remaining <= 0:
            break
    return crossings % 2 == 1


def meshes_intersect(first, second):
    if not boxes_overlap(world_bounds(first), world_bounds(second)):
        return False
    dependency_graph = bpy.context.evaluated_depsgraph_get()
    return bool(
        evaluated_bvh(first, dependency_graph).overlap(
            evaluated_bvh(second, dependency_graph)
        )
    )


def cross_runtime_collisions():
    dependency_graph = bpy.context.evaluated_depsgraph_get()
    meshes = [
        obj
        for obj in bpy.context.scene.objects
        if obj.type == "MESH" and moving_group(obj) is not None
    ]
    bounds = {obj.name: world_bounds(obj) for obj in meshes}
    trees = {}
    collisions = []
    for index, first in enumerate(meshes):
        for second in meshes[index + 1 :]:
            if moving_group(first) == moving_group(second):
                continue
            if not (first.get("detail_id") or second.get("detail_id")):
                continue
            if not boxes_overlap(bounds[first.name], bounds[second.name]):
                continue
            if first.name not in trees:
                trees[first.name] = evaluated_bvh(first, dependency_graph)
            if second.name not in trees:
                trees[second.name] = evaluated_bvh(second, dependency_graph)
            surface_crossing = bool(trees[first.name].overlap(trees[second.name]))
            first_vertices = evaluated_world_vertices(first, dependency_graph)
            second_vertices = evaluated_world_vertices(second, dependency_graph)
            first_inside = any(
                point_inside_solid(trees[second.name], vertex)
                for vertex in first_vertices[:: max(1, len(first_vertices) // 24)]
            )
            second_inside = any(
                point_inside_solid(trees[first.name], vertex)
                for vertex in second_vertices[:: max(1, len(second_vertices) // 24)]
            )
            if surface_crossing or first_inside or second_inside:
                collisions.append((first.name, second.name))
    return collisions


def downward_hit_z(obj, x, y, start_z):
    hit, location, _, _ = obj.ray_cast(
        Vector((x, y, start_z)), Vector((0.0, 0.0, -1.0))
    )
    if not hit:
        raise AssertionError(f"No downward surface hit on {obj.name} at {(x, y)}")
    return location.z


def descendant_meshes(root):
    meshes = []
    pending = list(root.children)
    while pending:
        current = pending.pop()
        if current.type == "MESH":
            meshes.append(current)
        pending.extend(current.children)
    return meshes


class HighDetailGeometryTest(unittest.TestCase):
    def setUp(self):
        self.root = build_graybox()

    def test_upgrade_preserves_every_frozen_runtime_value(self):
        before = runtime_contract_snapshot()

        returned = upgrade_to_high_detail(self.root)

        self.assertIs(returned, self.root)
        self.assertEqual(set(before), set(NODE_IDS))
        self.assertEqual(runtime_contract_snapshot(), before)

    def test_visible_runtime_meshes_have_evaluated_bevel_geometry(self):
        upgrade_to_high_detail(self.root)
        dependency_graph = bpy.context.evaluated_depsgraph_get()

        for node_id in REQUIRED_BEVELED_ROOTS:
            obj = bpy.data.objects[node_id]
            modifiers = [modifier for modifier in obj.modifiers if modifier.type == "BEVEL"]
            with self.subTest(node_id=node_id):
                self.assertTrue(modifiers)
                self.assertGreaterEqual(max(modifier.width for modifier in modifiers), 0.0004)
                evaluated_mesh = obj.evaluated_get(dependency_graph).to_mesh()
                try:
                    self.assertGreater(len(evaluated_mesh.vertices), len(obj.data.vertices))
                finally:
                    obj.evaluated_get(dependency_graph).to_mesh_clear()

    def test_evaluated_heaven_bevel_has_no_sub_micrometric_sliver_faces(self):
        upgrade_to_high_detail(self.root)
        heaven = bpy.data.objects["plate/heaven"]
        evaluated = heaven.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = evaluated.to_mesh()
        try:
            slivers = [polygon.area for polygon in mesh.polygons if polygon.area < 1e-10]
            self.assertEqual(slivers, [])
        finally:
            evaluated.to_mesh_clear()

    def test_required_structural_and_mechanism_parts_are_owned_real_meshes(self):
        upgrade_to_high_detail(self.root)

        actual_counts = {
            detail_id: len(details(detail_id)) for detail_id in EXPECTED_DETAIL_COUNTS
        }
        self.assertEqual(actual_counts, EXPECTED_DETAIL_COUNTS)
        for detail_id, expected_count in EXPECTED_DETAIL_COUNTS.items():
            group = details(detail_id)
            self.assertEqual(len(group), expected_count)
            for obj in group:
                with self.subTest(detail_id=detail_id, object=obj.name):
                    self.assertEqual(obj.type, "MESH")
                    self.assertGreater(len(obj.data.vertices), 0)
                    self.assertGreater(len(obj.data.polygons), 0)
                    self.assertGreater(min(obj.dimensions), 0.00035)
                    self.assertNotIn("node_id", obj)
                    self.assertIsNotNone(obj.parent)
                    self.assertIn("node_id", obj.parent)
                    self.assertEqual(obj.parent["node_id"], obj["owner_node_id"])

    def test_counted_mechanisms_have_independent_mesh_objects_and_correct_owners(self):
        upgrade_to_high_detail(self.root)

        expected_owners = {
            "mechanism/heaven-detent": {"plate/heaven"},
            "mechanism/lesson-dovetails": {
                "lesson/first", "lesson/second", "lesson/third", "lesson/fourth"
            },
            "mechanism/lesson-end-stop": {
                "lesson/first", "lesson/second", "lesson/third", "lesson/fourth"
            },
            "mechanism/lesson-readout-bed": {
                "lesson/first", "lesson/second", "lesson/third", "lesson/fourth"
            },
            "mechanism/transmission-tenon": {"transmission/bridge"},
            "mechanism/general-seal-interface": {
                node_id for node_id in NODE_IDS if node_id.startswith("general/")
            },
        }
        for detail_id, owners in expected_owners.items():
            group = details(detail_id)
            with self.subTest(detail_id=detail_id):
                self.assertEqual({obj["owner_node_id"] for obj in group}, owners)
                self.assertEqual(len({obj.data.as_pointer() for obj in group}), len(group))

    def test_base_shell_seam_and_corner_details_are_exposed_and_attached(self):
        upgrade_to_high_detail(self.root)
        base = bpy.data.objects["base/body"]
        base_box = world_bounds(base)

        for detail_id in (
            "structure/base-shell-thickness",
            "structure/base-bottom-seam",
            "structure/base-corner-transition",
        ):
            for obj in details(detail_id):
                detail_box = world_bounds(obj)
                with self.subTest(detail_id=detail_id, object=obj.name):
                    self.assertFalse(contains(base_box, detail_box))
                    self.assertTrue(boxes_overlap(base_box, detail_box))

    def test_heaven_detents_beds_and_contact_seams_are_cut_below_surface(self):
        upgrade_to_high_detail(self.root)
        heaven = bpy.data.objects["plate/heaven"]
        heaven_top = local_bounds(heaven)[1][2]

        for detail_id in (
            "mechanism/heaven-detent",
            "structure/heaven-inlay-bed",
            "structure/bronze-celadon-contact-seam",
        ):
            for obj in details(detail_id):
                detail_top = obj.location.z + local_bounds(obj)[1][2]
                with self.subTest(detail_id=detail_id, object=obj.name):
                    self.assertLessEqual(detail_top, heaven_top - 0.00015)

        self.assertLessEqual(downward_hit_z(heaven, 0.0, 0.178, 0.030), 0.0112)
        self.assertLessEqual(downward_hit_z(heaven, 0.0, 0.158, 0.030), 0.0112)
        self.assertLessEqual(downward_hit_z(heaven, 0.008, 0.158, 0.030), 0.0114)

    def test_recessed_general_track_is_cut_into_earth_plate(self):
        upgrade_to_high_detail(self.root)
        earth = bpy.data.objects["plate/earth"]
        earth_top = local_bounds(earth)[1][2]
        track = details("mechanism/general-track")[0]
        track_top = track.location.z + local_bounds(track)[1][2]

        self.assertLessEqual(track_top, earth_top - 0.00015)
        self.assertLessEqual(downward_hit_z(earth, 0.0, 0.218, 0.020), 0.0044)

    def test_lesson_rails_and_sockets_are_attached_and_readout_beds_are_clear(self):
        upgrade_to_high_detail(self.root)

        for lesson in ("first", "second", "third", "fourth"):
            body = bpy.data.objects[f"lesson/{lesson}/body"]
            rail = next(
                obj
                for obj in details("mechanism/lesson-dovetails")
                if obj["owner_node_id"] == f"lesson/{lesson}"
            )
            stop = next(
                obj
                for obj in details("mechanism/lesson-end-stop")
                if obj["owner_node_id"] == f"lesson/{lesson}"
            )
            socket = next(
                obj
                for obj in details("mechanism/lesson-general-socket")
                if obj["owner_node_id"] == f"lesson/{lesson}"
            )
            bed = next(
                obj
                for obj in details("mechanism/lesson-readout-bed")
                if obj["owner_node_id"] == f"lesson/{lesson}"
            )
            body_top = local_axis_bounds(body, 2)[1]
            rail_bottom, rail_top = local_axis_bounds(rail, 2)
            socket_bottom, socket_top = local_axis_bounds(socket, 2)
            with self.subTest(lesson=lesson, detail="rail"):
                self.assertGreater(
                    local_axis_bounds(rail, 1)[1],
                    local_axis_bounds(body, 1)[1] + 0.002,
                )
                self.assertLess(rail_bottom, body_top)
                self.assertGreater(rail_top, body_top)
                self.assertGreaterEqual(body_top - rail_bottom, 0.0003)
            with self.subTest(lesson=lesson, detail="stop"):
                self.assertGreater(
                    stop.location.z + stop.dimensions.z / 2,
                    body_top,
                )
            with self.subTest(lesson=lesson, detail="socket"):
                self.assertLess(socket_bottom, body_top)
                self.assertGreater(socket_top, body_top)
                self.assertGreaterEqual(body_top - socket_bottom, 0.0003)
            for readout in ("upper", "lower"):
                readout_obj = bpy.data.objects[f"lesson/{lesson}/readout/{readout}"]
                with self.subTest(lesson=lesson, detail="bed", readout=readout):
                    self.assertFalse(
                        boxes_overlap(world_bounds(bed), world_bounds(readout_obj))
                    )
                    self.assertFalse(meshes_intersect(bed, readout_obj))

    def test_high_detail_closed_envelope_and_deployed_keep_outs_remain_clear(self):
        upgrade_to_high_detail(self.root)
        apply_pose("closed")
        for obj in bpy.data.objects:
            if obj.type != "MESH":
                continue
            minimum, maximum = world_bounds(obj)
            with self.subTest(pose="closed", object=obj.name):
                self.assertGreaterEqual(minimum[0], -0.2605)
                self.assertLessEqual(maximum[0], 0.2605)
                self.assertGreaterEqual(minimum[1], -0.2605)
                self.assertLessEqual(maximum[1], 0.2605)

        apply_pose("generals", plate_offset=5, general_direction="reverse")
        moving_roots = (
            "calendar/slip",
            "lesson/first",
            "lesson/second",
            "lesson/third",
            "lesson/fourth",
            "transmission/bridge",
            *(node_id for node_id in NODE_IDS if node_id.startswith("general/")),
        )
        for node_id in moving_roots:
            for mesh in descendant_meshes(bpy.data.objects[node_id]):
                for box_name, minimum, maximum in BASE_INTERIOR_COLLISION_BOXES:
                    with self.subTest(
                        pose="generals", node_id=node_id, mesh=mesh.name, box=box_name
                    ):
                        self.assertFalse(
                            boxes_overlap(world_bounds(mesh), (minimum, maximum))
                        )

    def test_all_covered_pose_cross_runtime_meshes_are_collision_free(self):
        upgrade_to_high_detail(self.root)

        cases = (
            ("closed", "closed", 0, "forward"),
            ("lessons", "lessons", 0, "forward"),
            ("transmissions", "transmissions", 0, "forward"),
            ("generals-forward", "generals", 5, "forward"),
            ("generals-reverse", "generals", 5, "reverse"),
        )
        for label, pose_id, plate_offset, direction in cases:
            apply_pose(pose_id, plate_offset, direction)
            bpy.context.view_layer.update()
            with self.subTest(pose=label):
                self.assertEqual(cross_runtime_collisions(), [])

    def test_saved_master_reopens_with_frozen_counts_and_no_dynamic_text(self):
        build_master()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "daliuren-artifact-master.blend"
            bpy.ops.wm.save_as_mainfile(filepath=str(path))
            bpy.ops.wm.open_mainfile(filepath=str(path))

            runtime = [obj for obj in bpy.data.objects if "node_id" in obj]
            persisted_details = [obj for obj in bpy.data.objects if "detail_id" in obj]
            inscriptions = [
                obj for obj in bpy.data.objects if "inscription_role" in obj
            ]
            self.assertEqual(len(runtime), 28)
            self.assertEqual({obj["node_id"] for obj in runtime}, set(NODE_IDS))
            self.assertEqual(len(persisted_details), 85)
            self.assertEqual(len(inscriptions), 71)
            self.assertTrue(
                FORBIDDEN_DYNAMIC_TEXT.isdisjoint(
                    {obj.get("inscription_text") for obj in inscriptions}
                )
            )
            plate = bpy.data.objects["plate/heaven"]
            plate_top = world_bounds(plate)[1][2]
            support_roles = {
                "earth-branch": "structure/heaven-inlay-bed",
                "mechanical-scale": "mechanism/heaven-detent",
            }
            for role, detail_id in support_roles.items():
                role_inscriptions = sorted(
                    (obj for obj in inscriptions if obj["inscription_role"] == role),
                    key=lambda obj: obj["angular_index"],
                )
                role_supports = sorted(
                    (obj for obj in persisted_details if obj["detail_id"] == detail_id),
                    key=lambda obj: obj["detail_index"],
                )
                self.assertEqual(len(role_inscriptions), 12)
                self.assertEqual(len(role_supports), 12)
                for angular_index, (inscription, support) in enumerate(
                    zip(role_inscriptions, role_supports)
                ):
                    with self.subTest(
                        role=role,
                        angular_index=angular_index,
                        stage="reopened-blend",
                    ):
                        self.assertEqual(inscription["angular_index"], angular_index)
                        self.assertEqual(support["detail_index"], angular_index)
                        self.assertAlmostEqual(
                            world_bounds(inscription)[1][2], plate_top, places=6
                        )
                        self.assertTrue(meshes_intersect(inscription, support))

            glb_path = Path(directory) / "daliuren-artifact-master.glb"
            bpy.ops.export_scene.gltf(
                filepath=str(glb_path),
                export_format="GLB",
                export_apply=True,
                export_extras=True,
                export_animations=False,
            )
            bpy.ops.wm.read_factory_settings(use_empty=True)
            bpy.ops.import_scene.gltf(filepath=str(glb_path))
            imported_runtime = [obj for obj in bpy.data.objects if "node_id" in obj]
            imported_details = [obj for obj in bpy.data.objects if "detail_id" in obj]
            imported_inscriptions = [
                obj for obj in bpy.data.objects if "inscription_role" in obj
            ]
            self.assertEqual(len(imported_runtime), 28)
            self.assertEqual(len(imported_details), 85)
            self.assertEqual(len(imported_inscriptions), 71)
            imported_heaven = next(
                obj for obj in imported_runtime if obj["node_id"] == "plate/heaven"
            )
            self.assertEqual(
                tuple(round(value, 6) for value in imported_heaven.dimensions),
                (0.38, 0.38, 0.024),
            )
            evaluated = imported_heaven.evaluated_get(
                bpy.context.evaluated_depsgraph_get()
            )
            mesh = evaluated.to_mesh()
            try:
                slivers = [
                    polygon.area for polygon in mesh.polygons if polygon.area < 1e-10
                ]
                self.assertEqual(slivers, [])
            finally:
                evaluated.to_mesh_clear()

    def test_second_upgrade_is_rejected_without_duplicate_geometry_or_modifiers(self):
        upgrade_to_high_detail(self.root)
        detail_count = sum("detail_id" in obj for obj in bpy.data.objects)
        modifier_counts = {
            node_id: len(bpy.data.objects[node_id].modifiers)
            for node_id in REQUIRED_BEVELED_ROOTS
        }

        with self.assertRaisesRegex(RuntimeError, "already upgraded"):
            upgrade_to_high_detail(self.root)

        self.assertEqual(sum("detail_id" in obj for obj in bpy.data.objects), detail_count)
        self.assertEqual(
            {
                node_id: len(bpy.data.objects[node_id].modifiers)
                for node_id in REQUIRED_BEVELED_ROOTS
            },
            modifier_counts,
        )


if __name__ == "__main__":
    unittest.main(argv=[__file__])
