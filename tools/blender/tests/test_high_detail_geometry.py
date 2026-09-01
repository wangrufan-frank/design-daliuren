import math
import tempfile
import unittest
from pathlib import Path
import sys

import bpy
from mathutils.bvhtree import BVHTree
from mathutils import Vector


sys.path.insert(0, str(Path(__file__).parents[1]))

from build_graybox import build_graybox, build_master
from daliuren_contract import NODE_IDS
from high_detail_geometry import upgrade_to_high_detail


ALLOWED_DETAIL_PREFIXES = (
    "structure/base-",
    "structure/heaven-",
    "structure/plate-",
    "structure/slip-slot-",
    "structure/bronze-inlay-",
    "wear/contact-",
)
EXPECTED_DETAIL_COUNTS = {
    "structure/base-shell-thickness": 4,
    "structure/base-bottom-seam": 1,
    "structure/base-corner-transition": 4,
    "structure/heaven-bronze-rim": 1,
}
FORBIDDEN_TOKENS = (
    "dovetail",
    "tenon",
    "bridge",
    "general-track",
    "pillar",
    "socket",
    "cutter/",
)


def rounded(values):
    return tuple(round(float(value), 7) for value in values)


def runtime_contract_snapshot():
    result = {}
    for obj in bpy.data.objects:
        node_id = obj.get("node_id")
        if not node_id:
            continue
        result[node_id] = {
            "parent": obj.parent.get("node_id") if obj.parent else None,
            "location": rounded(obj.location),
            "rotation": rounded(obj.rotation_euler),
            "scale": rounded(obj.scale),
            "dimensions": rounded(obj.dimensions),
        }
    return result


def world_bounds(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        tuple(min(corner[axis] for corner in corners) for axis in range(3)),
        tuple(max(corner[axis] for corner in corners) for axis in range(3)),
    )


def xy_overlap(first, second):
    first_min, first_max = first
    second_min, second_max = second
    return all(
        first_min[axis] < second_max[axis]
        and first_max[axis] > second_min[axis]
        for axis in (0, 1)
    )


def world_mesh_bvh(obj):
    obj.data.calc_loop_triangles()
    vertices = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    triangles = [tuple(triangle.vertices) for triangle in obj.data.loop_triangles]
    return BVHTree.FromPolygons(vertices, triangles, all_triangles=True)


class HighDetailGeometryTest(unittest.TestCase):
    def setUp(self):
        self.root = build_graybox()

    def tearDown(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def test_reference_surface_is_not_runtime_geometry(self):
        upgrade_to_high_detail(self.root)

        self.assertIsNone(bpy.data.objects.get("detail/reference/surface"))
        self.assertIsNone(bpy.data.objects.get("detail/reference/center-disc"))

        zodiac = [
            obj for obj in bpy.data.objects
            if obj.get("visual_role") == "zodiac-animal-relief"
        ]
        clouds = [
            obj for obj in bpy.data.objects
            if obj.get("visual_role") == "zodiac-cloud-relief"
        ]
        pearls = [
            obj for obj in bpy.data.objects
            if obj.get("visual_role") == "corner-pearl"
        ]
        self.assertEqual(len(zodiac), 12)
        self.assertTrue(all(obj.type == "MESH" for obj in zodiac))
        self.assertEqual(
            [glyph["zodiac_animal"] for glyph in zodiac],
            ["snake", "horse", "goat", "monkey", "rooster", "dog", "pig", "rat", "ox", "tiger", "rabbit", "dragon"],
        )
        self.assertEqual(
            [tuple(round(value, 3) for value in glyph.location.xy) for glyph in zodiac],
            [(-0.140, 0.210), (0.000, 0.210), (0.140, 0.210), (0.210, 0.105),
             (0.210, 0.000), (0.210, -0.105), (0.140, -0.210), (0.000, -0.210),
             (-0.140, -0.210), (-0.210, -0.105), (-0.210, 0.000), (-0.210, 0.105)],
        )
        board_top = max(
            (bpy.data.objects["plate/earth"].matrix_world @ Vector(corner)).z
            for corner in bpy.data.objects["plate/earth"].bound_box
        )
        self.assertTrue(all(
            max((glyph.matrix_world @ Vector(corner)).z for corner in glyph.bound_box) <= board_top + 0.00005
            for glyph in zodiac
        ))
        self.assertEqual(len(clouds), 12)
        self.assertTrue(all(cloud.parent == bpy.data.objects["plate/earth"] for cloud in clouds))
        self.assertTrue(all(
            max((cloud.matrix_world @ Vector(corner)).z for corner in cloud.bound_box) <= board_top + 0.00055
            for cloud in clouds
        ))
        self.assertFalse(any(obj.get("visual_role") == "zodiac-glyph" for obj in bpy.data.objects))
        self.assertFalse(any(obj.name.endswith("/glyph") and obj.name.startswith("zodiac/") for obj in bpy.data.objects))
        self.assertEqual(len(pearls), 4)
        self.assertTrue(all(obj.type == "MESH" for obj in pearls))
        self.assertEqual(
            {tuple(round(value, 4) for value in pearl.location.xy) for pearl in pearls},
            {(-0.1346, 0.1191), (0.1170, 0.1206), (-0.1273, -0.1377), (0.1040, -0.1436)},
        )

    def test_colored_connected_beidou_is_real_center_geometry(self):
        upgrade_to_high_detail(self.root)

        core = bpy.data.objects["plate/core"]
        stars = [obj for obj in bpy.data.objects if obj.get("visual_role") == "beidou-star"]
        links = [obj for obj in bpy.data.objects if obj.get("visual_role") == "beidou-link"]
        self.assertEqual(len(stars), 7)
        self.assertEqual(len(links), 6)
        self.assertTrue(all(obj.parent == core for obj in (*stars, *links)))
        self.assertTrue(all(obj.get("material_variant") == "beidou-blue" for obj in stars))
        self.assertTrue(all(obj.get("material_variant") == "gold" for obj in links))

    def test_unapproved_motion_parts_are_parked_below_the_reference_face(self):
        upgrade_to_high_detail(self.root)
        surface_z = max(
            (bpy.data.objects["plate/earth"].matrix_world @ Vector(corner)).z
            for corner in bpy.data.objects["plate/earth"].bound_box
        )
        parked = (
            "calendar/slip",
            "lesson/first", "lesson/second", "lesson/third", "lesson/fourth",
            "transmission/initial", "transmission/middle", "transmission/final",
            "transmission/method",
        )
        for node_id in parked:
            top = max(
                (bpy.data.objects[node_id].matrix_world @ Vector(corner)).z
                for corner in bpy.data.objects[node_id].bound_box
            )
            self.assertLess(top, surface_z, node_id)

    def test_upgrade_preserves_every_runtime_value(self):
        before = runtime_contract_snapshot()

        returned = upgrade_to_high_detail(self.root)

        self.assertIs(returned, self.root)
        self.assertEqual(set(before), set(NODE_IDS))
        self.assertEqual(runtime_contract_snapshot(), before)

    def test_only_permitted_non_mechanical_detail_families_remain(self):
        upgrade_to_high_detail(self.root)

        details = [obj for obj in bpy.data.objects if obj.get("detail_id")]
        self.assertEqual(
            {detail_id: sum(obj.get("detail_id") == detail_id for obj in details)
             for detail_id in EXPECTED_DETAIL_COUNTS},
            EXPECTED_DETAIL_COUNTS,
        )
        self.assertEqual(len(details), sum(EXPECTED_DETAIL_COUNTS.values()))
        for obj in bpy.data.objects:
            searchable = f'{obj.name} {obj.get("detail_id", "")}'.lower()
            with self.subTest(object=obj.name):
                for token in FORBIDDEN_TOKENS:
                    self.assertNotIn(token, searchable)
                if obj.get("detail_id"):
                    self.assertTrue(obj["detail_id"].startswith(ALLOWED_DETAIL_PREFIXES))
                    self.assertEqual(obj.type, "MESH")
                    self.assertGreater(len(obj.data.polygons), 0)
                    self.assertNotIn("node_id", obj)
                    self.assertEqual(obj["owner_node_id"], obj.parent["node_id"])

    def test_exposed_detail_meshes_do_not_overlap_at_nearly_equal_z(self):
        upgrade_to_high_detail(self.root)
        exposed = [
            obj
            for obj in bpy.data.objects
            if obj.type == "MESH"
            and (
                obj.get("detail_id")
                or obj.get("surface_treatment") in {
                    "recessed-inlay",
                    "recessed-bed",
                    "recessed-groove",
                }
            )
        ]
        bounds = {obj.name: world_bounds(obj) for obj in exposed}
        bvhs = {obj.name: world_mesh_bvh(obj) for obj in exposed}
        conflicts = []
        for index, first in enumerate(exposed):
            for second in exposed[index + 1:]:
                if not xy_overlap(bounds[first.name], bounds[second.name]):
                    continue
                first_top = bounds[first.name][1][2]
                second_top = bounds[second.name][1][2]
                if (
                    abs(first_top - second_top) < 0.0001
                    and bvhs[first.name].overlap(bvhs[second.name])
                ):
                    conflicts.append((first.name, second.name, first_top, second_top))
        self.assertEqual(conflicts, [])

    def test_high_detail_stays_within_fixed_scene_height(self):
        upgrade_to_high_detail(self.root)
        minimum_z = min(
            (obj.matrix_world @ Vector(corner)).z
            for obj in bpy.data.objects
            if obj.type == "MESH"
            for corner in obj.bound_box
        )
        maximum_z = max(
            (obj.matrix_world @ Vector(corner)).z
            for obj in bpy.data.objects
            if obj.type == "MESH"
            for corner in obj.bound_box
        )
        self.assertGreaterEqual(minimum_z, -0.00005)
        self.assertLessEqual(maximum_z, 0.10205)
        self.assertGreater(maximum_z - minimum_z, 0.055)
        self.assertLess(maximum_z - minimum_z, 0.061)

    def test_saved_master_reopens_with_recessed_branch_nodes_and_no_cutters(self):
        build_master()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "daliuren-artifact-master.blend"
            bpy.ops.wm.save_as_mainfile(filepath=str(path))
            bpy.ops.wm.open_mainfile(filepath=str(path))

            runtime = [obj for obj in bpy.data.objects if "node_id" in obj]
            branches = [
                obj for obj in runtime if obj["node_id"].startswith("branch/")
            ]
            inscriptions = [
                obj for obj in bpy.data.objects if "inscription_role" in obj
            ]
            self.assertEqual({obj["node_id"] for obj in runtime}, set(NODE_IDS))
            self.assertEqual(len(branches), 12)
            self.assertEqual(len(inscriptions), 59)
            self.assertTrue(
                all(obj["surface_treatment"] == "recessed-inlay" for obj in branches)
            )
            self.assertFalse(any(obj.name.startswith("cutter/") for obj in bpy.data.objects))

    def test_second_upgrade_is_rejected_without_duplicate_geometry(self):
        upgrade_to_high_detail(self.root)
        detail_count = sum("detail_id" in obj for obj in bpy.data.objects)

        with self.assertRaisesRegex(RuntimeError, "already upgraded"):
            upgrade_to_high_detail(self.root)

        self.assertEqual(sum("detail_id" in obj for obj in bpy.data.objects), detail_count)


if __name__ == "__main__":
    unittest.main(argv=[__file__])
