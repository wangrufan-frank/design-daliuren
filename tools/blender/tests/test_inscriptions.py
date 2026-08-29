import copy
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

import bpy
from mathutils import Vector


BLENDER_DIR = Path(__file__).parents[1]
REPOSITORY_ROOT = Path(__file__).parents[3]
FIXTURE = REPOSITORY_ROOT / "assets/daliuren/inscriptions/fixed-inscriptions.json"
FONT = REPOSITORY_ROOT / "assets/daliuren/fonts/NotoSerifCJKsc-Regular.otf"
OFL = REPOSITORY_ROOT / "assets/daliuren/fonts/OFL.txt"
FONT_RELEASE_URL = (
    "https://github.com/notofonts/noto-cjk/releases/download/Serif2.003/"
    "09_NotoSerifCJKsc.zip"
)
ZIP_SHA256 = "4bcdbff95cedfb6a4c0640403f0de8b69480d869331c24c8eff91f7bb834df04"
FONT_SHA256 = "2a2eae2628df83556c54018c41e20fa532c1b862c5256ae8b3f23feb918d12ca"
OFL_SHA256 = "88f117575237307bdd86a17ef15e21790fc9a662fe4dfb103ca1ca077f0d9982"
BRANCHES = tuple("子丑寅卯辰巳午未申酉戌亥")

sys.path.insert(0, str(BLENDER_DIR))

from build_graybox import build_graybox, build_master
import inscriptions
from inscriptions import (
    FUNCTIONAL_ROLES,
    HISTORICAL_ROLES,
    ROLE_ANGLES,
    TEXT_SIZES,
    build_fixed_inscriptions,
    load_fixed_inscriptions,
)


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def world_z_bounds(obj):
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return min(point.z for point in points), max(point.z for point in points)


def top_face_sample(obj):
    obj.data.calc_loop_triangles()
    triangle = next(
        triangle
        for triangle in obj.data.loop_triangles
        if obj.data.polygons[triangle.polygon_index].normal.z > 0.99
    )
    center = sum((obj.data.vertices[index].co for index in triangle.vertices), Vector()) / 3
    return obj.matrix_world @ center


class InscriptionTest(unittest.TestCase):
    def tearDown(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def test_fixed_inscriptions_define_two_complete_branch_rings(self):
        items = load_fixed_inscriptions(FIXTURE)

        self.assertEqual(len(items), 71)
        for role, radius in (("earth-branch", 0.202), ("heaven-branch", 0.164)):
            ring = tuple(item for item in items if item.role == role)
            with self.subTest(role=role):
                self.assertEqual(tuple(item.text for item in ring), BRANCHES)
                self.assertEqual(tuple(item.angular_index for item in ring), tuple(range(12)))
                self.assertEqual({item.radius for item in ring}, {radius})
                self.assertEqual({item.depth for item in ring}, {0.0012})
                self.assertEqual({item.contrast_tier for item in ring}, {"functional-high"})

    def test_role_geometry_routes_branch_rings_to_matching_plates(self):
        self.assertEqual(
            ROLE_ANGLES,
            {
                "earth-branch": 12,
                "heaven-branch": 12,
                "historical-beidou": 7,
                "historical-mansion": 28,
                "historical-month-deity": 12,
            },
        )
        self.assertEqual(
            TEXT_SIZES,
            {
                "earth-branch": 0.020,
                "heaven-branch": 0.018,
                "historical-beidou": 0.0045,
                "historical-mansion": 0.0048,
                "historical-month-deity": 0.0045,
            },
        )
        role_parents = getattr(inscriptions, "ROLE_PARENTS", {})
        self.assertEqual(role_parents.get("earth-branch"), "earth")
        self.assertTrue(
            all(
                role_parents.get(role) == "heaven"
                for role in ROLE_ANGLES
                if role != "earth-branch"
            )
        )

    def test_contract_records_explicit_geometry_and_pinned_font_source(self):
        payload = json.loads(FIXTURE.read_text(encoding="utf-8"))

        self.assertEqual(payload["font"]["releaseUrl"], FONT_RELEASE_URL)
        self.assertEqual(payload["font"]["zipSha256"], ZIP_SHA256)
        self.assertEqual(sha256(FONT), FONT_SHA256)
        self.assertEqual(sha256(OFL), OFL_SHA256)
        for item in payload["inscriptions"]:
            with self.subTest(text=item.get("text"), role=item.get("role")):
                self.assertEqual(
                    set(item),
                    {"role", "text", "angularIndex", "radius", "depth", "contrastTier"},
                )
                self.assertIsInstance(item["text"], str)
                self.assertTrue(item["text"])
                self.assertGreater(item["radius"], 0)
                self.assertGreater(item["depth"], 0)

    def test_loader_rejects_corrupt_fixed_contracts(self):
        payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
        corruptions = (
            ("unknown role", 0, "role", "dynamic-label"),
            ("non-string text", 0, "text", 42),
            ("unknown contrast", 0, "contrastTier", "raised-relief"),
            ("duplicate angular index", 1, "angularIndex", 0),
            ("duplicate fixed text", 1, "text", "子"),
        )
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fixed-inscriptions.json"
            for label, item_index, key, value in corruptions:
                corrupt = copy.deepcopy(payload)
                corrupt["inscriptions"][item_index][key] = value
                path.write_text(json.dumps(corrupt, ensure_ascii=False), encoding="utf-8")
                with self.subTest(label=label):
                    with self.assertRaises((TypeError, ValueError)):
                        load_fixed_inscriptions(path)

    def test_graybox_replaces_placeholder_discs_with_runtime_addressable_glyphs(self):
        build_graybox()

        branch_objects = [
            obj
            for obj in bpy.data.objects
            if isinstance(obj.get("node_id"), str)
            and obj["node_id"].startswith("branch/")
        ]
        self.assertEqual(len(branch_objects), 24)
        self.assertEqual(len({obj.data.as_pointer() for obj in branch_objects}), 24)
        for surface in ("earth", "heaven"):
            plate = bpy.data.objects[f"plate/{surface}"]
            for index, branch in enumerate(BRANCHES):
                node_id = f"branch/{surface}/{branch}"
                obj = bpy.data.objects[node_id]
                with self.subTest(node_id=node_id):
                    self.assertEqual(obj.type, "MESH")
                    self.assertGreater(len(obj.data.polygons), 4)
                    self.assertIs(obj.parent, plate)
                    self.assertEqual(obj["node_id"], node_id)
                    self.assertEqual(obj["surface"], surface)
                    self.assertEqual(obj["branch"], branch)
                    self.assertEqual(obj["ring_index"], index)
                    self.assertEqual(obj["angular_index"], index)
                    self.assertEqual(obj["surface_treatment"], "recessed-inlay")

    def test_graybox_contains_only_the_twenty_four_functional_inscriptions(self):
        build_graybox()

        inscriptions_by_role = [
            obj.get("inscription_role")
            for obj in bpy.data.objects
            if obj.get("inscription_role") is not None
        ]
        self.assertEqual(len(inscriptions_by_role), 24)
        self.assertEqual(set(inscriptions_by_role), FUNCTIONAL_ROLES)

    def test_master_adds_all_forty_seven_historical_inscriptions(self):
        build_master()

        inscriptions_by_role = [
            obj.get("inscription_role")
            for obj in bpy.data.objects
            if obj.get("inscription_role") is not None
        ]
        self.assertEqual(len(inscriptions_by_role), 71)
        self.assertEqual(
            sum(role in FUNCTIONAL_ROLES for role in inscriptions_by_role),
            24,
        )
        self.assertEqual(
            sum(role in HISTORICAL_ROLES for role in inscriptions_by_role),
            47,
        )

    def test_branch_glyphs_are_recessed_and_plate_faces_are_boolean_cut_away(self):
        build_graybox()

        for surface in ("earth", "heaven"):
            plate = bpy.data.objects[f"plate/{surface}"]
            plate_top = world_z_bounds(plate)[1]
            inverse = plate.matrix_world.inverted()
            for branch in BRANCHES:
                inlay = bpy.data.objects[f"branch/{surface}/{branch}"]
                minimum_z, maximum_z = world_z_bounds(inlay)
                local_sample = inverse @ top_face_sample(inlay)
                hit, location, _, _ = plate.ray_cast(
                    Vector(
                        (
                            local_sample.x,
                            local_sample.y,
                            max(corner[2] for corner in plate.bound_box) + 0.01,
                        )
                    ),
                    Vector((0.0, 0.0, -1.0)),
                )
                with self.subTest(surface=surface, branch=branch):
                    self.assertLessEqual(maximum_z, plate_top - 0.0001)
                    self.assertGreater(maximum_z, plate_top - 0.0003)
                    self.assertGreater(maximum_z - minimum_z, 0.0009)
                    self.assertTrue(hit)
                    hit_world = plate.matrix_world @ location
                    self.assertLess(hit_world.z, minimum_z + 0.0001)

    def test_branch_glyphs_have_recessed_non_coplanar_dark_beds(self):
        build_graybox()

        beds = [
            obj
            for obj in bpy.data.objects
            if obj.get("detail_id") == "structure/bronze-inlay-branch-bed"
        ]
        self.assertEqual(len(beds), 24)
        for surface in ("earth", "heaven"):
            plate = bpy.data.objects[f"plate/{surface}"]
            for branch in BRANCHES:
                glyph = bpy.data.objects[f"branch/{surface}/{branch}"]
                bed = bpy.data.objects[f"detail/branch-bed/{surface}/{branch}"]
                glyph_bottom, glyph_top = world_z_bounds(glyph)
                _, bed_top = world_z_bounds(bed)
                with self.subTest(surface=surface, branch=branch):
                    self.assertIs(bed.parent, plate)
                    self.assertEqual(bed["owner_node_id"], f"plate/{surface}")
                    self.assertEqual(bed["surface_treatment"], "recessed-bed")
                    self.assertGreater(bed.dimensions.x, glyph.dimensions.x)
                    self.assertGreater(bed.dimensions.y, glyph.dimensions.y)
                    self.assertLessEqual(bed_top, glyph_top - 0.0001)
                    self.assertLessEqual(glyph_bottom, bed_top - 0.00005)

    def test_builder_rejects_dynamic_parent_without_side_effects(self):
        build_graybox()
        count_before = len(bpy.data.objects)
        with self.assertRaises(ValueError):
            build_fixed_inscriptions(
                bpy.data.objects["lesson/first"],
                bpy.data.objects["plate/heaven"],
                FONT,
            )
        self.assertEqual(len(bpy.data.objects), count_before)


if __name__ == "__main__":
    unittest.main(argv=[__file__])
