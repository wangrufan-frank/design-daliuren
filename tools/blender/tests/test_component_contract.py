import math
import sys
import unittest
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).parents[1]))

from build_graybox import build_graybox
from daliuren_contract import BRANCHES, DIMENSIONS, NODE_IDS, VISUAL_EARTH_ORDER, VISUAL_MONTH_ORDER


GENERAL_KEYS = (
    "noble",
    "snake",
    "vermilion-bird",
    "harmony",
    "hook-array",
    "azure-dragon",
    "void",
    "white-tiger",
    "constant",
    "black-tortoise",
    "yin",
    "queen-of-heaven",
)


class ComponentContractTest(unittest.TestCase):
    def setUp(self):
        self.root = build_graybox()

    def assertVectorAlmostEqual(self, actual, expected):
        self.assertEqual(len(actual), len(expected))
        for actual_value, expected_value in zip(actual, expected):
            self.assertAlmostEqual(actual_value, expected_value, places=4)

    def test_every_runtime_node_exists_once(self):
        runtime_objects = [obj for obj in bpy.data.objects if "node_id" in obj]
        self.assertEqual(len(runtime_objects), len(NODE_IDS))
        self.assertEqual({obj["node_id"] for obj in runtime_objects}, set(NODE_IDS))
        for node_id in NODE_IDS:
            matches = [obj for obj in runtime_objects if obj["node_id"] == node_id]
            self.assertEqual(len(matches), 1, node_id)

    def test_calendar_keeps_its_rear_pivot_contract_while_parked(self):
        calendar = bpy.data.objects["calendar/slip"]
        earth = bpy.data.objects["plate/earth"]
        self.assertEqual(calendar.type, "EMPTY")
        self.assertGreater(calendar.location.y, 0.0)
        self.assertEqual(calendar.parent, self.root)
        self.assertGreater(math.degrees(calendar.rotation_euler.x), 5.0)
        self.assertLess(math.degrees(calendar.rotation_euler.x), 15.0)
        self.assertEqual(
            {child.name for child in calendar.children},
            {"calendar/slip/body", "calendar/slip/readout"},
        )
        readout = bpy.data.objects["calendar/slip/readout"]
        self.assertEqual(readout.type, "MESH")
        self.assertNotIn("node_id", readout)
        seats = [
            bpy.data.objects[f"detail/calendar/seat-{side}"]
            for side in ("left", "right")
        ]
        self.assertEqual([round(seat.location.x, 3) for seat in seats], [-0.110, 0.110])
        for seat in seats:
            self.assertNotIn("node_id", seat)
            self.assertEqual(seat.parent, bpy.data.objects["base/body"])
            self.assertEqual(seat["surface_treatment"], "rear-slip-seat")
        earth_bottom = earth.location.z - earth.dimensions.z / 2
        calendar_bottom = min(
            (child.matrix_world @ Vector(corner)).z
            for child in calendar.children
            if child.type == "MESH"
            for corner in child.bound_box
        )
        calendar_top = max(
            (child.matrix_world @ Vector(corner)).z
            for child in calendar.children
            if child.type == "MESH"
            for corner in child.bound_box
        )
        self.assertLess(calendar.location.z, earth_bottom)
        self.assertLess(calendar_bottom, earth_bottom)
        self.assertLess(calendar_top, earth_bottom)

    def test_four_lessons_are_independent_slips_at_settled_positions(self):
        expected = {
            "fourth": (-0.181, 0.167),
            "third": (-0.181, -0.167),
            "second": (0.181, -0.167),
            "first": (0.181, 0.167),
        }
        slips = []
        for visual_order, (lesson, xy) in enumerate(expected.items()):
            slip = bpy.data.objects[f"lesson/{lesson}"]
            slips.append(slip)
            self.assertEqual(slip.type, "MESH")
            self.assertEqual(slip.parent, self.root)
            self.assertEqual(slip["visual_order"], visual_order)
            self.assertVectorAlmostEqual(slip.dimensions, DIMENSIONS["lesson_slip"])
            self.assertVectorAlmostEqual(slip.location[:2], xy)
            self.assertVectorAlmostEqual(slip["settled_location"], slip.location)
            self.assertEqual(len(slip.children), 0)
            self.assertLessEqual(slip.dimensions.x, 0.075)
            self.assertLessEqual(slip.dimensions.y, 0.036)
            self.assertGreaterEqual(slip.dimensions.z, 0.008)
            self.assert_shallow_seat(f"detail/slip-seat/lesson/{lesson}", slip)
        self.assert_no_plan_overlap(slips)

    def test_transmissions_are_independent_slips_with_compact_method_tablet(self):
        slips = []
        for module_order, (module, x) in enumerate(
            (("initial", -0.096), ("middle", 0.0), ("final", 0.096))
        ):
            slip = bpy.data.objects[f"transmission/{module}"]
            slips.append(slip)
            self.assertEqual(slip.parent, self.root)
            self.assertEqual(slip.type, "MESH")
            self.assertEqual(slip["module_order"], module_order)
            self.assertVectorAlmostEqual(slip.dimensions, DIMENSIONS["transmission_slip"])
            self.assertVectorAlmostEqual(slip.location[:2], (x, -0.194))
            self.assertVectorAlmostEqual(slip["settled_location"], slip.location)
            self.assertLessEqual(slip.dimensions.x, 0.075)
            self.assertLessEqual(slip.dimensions.y, 0.036)
            self.assertGreaterEqual(slip.dimensions.z, 0.008)
            self.assert_shallow_seat(f"detail/slip-seat/transmission/{module}", slip)
        self.assert_no_plan_overlap(slips)
        method = bpy.data.objects["transmission/method"]
        self.assertEqual(method.parent, self.root)
        self.assertEqual(method.type, "MESH")
        self.assertVectorAlmostEqual(method.dimensions, DIMENSIONS["method_slip"])
        self.assertVectorAlmostEqual(method.location[:2], (0.0, -0.238))
        self.assertLess(method.dimensions.x / method.dimensions.y, 4.5)
        self.assert_shallow_seat("detail/slip-seat/transmission/method", method)

    def assert_shallow_seat(self, seat_name, slip):
        seat = bpy.data.objects[seat_name]
        self.assertNotIn("node_id", seat)
        self.assertEqual(seat["surface_treatment"], "shallow-slot")
        self.assertVectorAlmostEqual(seat.location[:2], slip.location[:2])
        self.assertAlmostEqual(seat.dimensions.x - slip.dimensions.x, 0.008, places=4)
        self.assertAlmostEqual(seat.dimensions.y - slip.dimensions.y, 0.008, places=4)
        self.assertAlmostEqual(seat.dimensions.z, 0.001, places=6)
        seat_top = seat.matrix_world.translation.z + seat.dimensions.z / 2
        slip_bottom = slip.matrix_world.translation.z - slip.dimensions.z / 2
        self.assertLess(slip_bottom, seat_top)

    def assert_no_plan_overlap(self, slips):
        for index, first in enumerate(slips):
            for second in slips[index + 1:]:
                separated_x = abs(first.location.x - second.location.x) > (
                    first.dimensions.x + second.dimensions.x
                ) / 2
                separated_y = abs(first.location.y - second.location.y) > (
                    first.dimensions.y + second.dimensions.y
                ) / 2
                self.assertTrue(separated_x or separated_y, f"{first.name} overlaps {second.name}")

    def test_general_inlays_match_their_sector_slots(self):
        generals = [obj for obj in bpy.data.objects if obj.get("domain") == "general"]
        general_ring = bpy.data.objects["plate/generals"]
        self.assertEqual(len(generals), 12)
        self.assertEqual({obj["general_key"] for obj in generals}, set(GENERAL_KEYS))
        self.assertEqual(len({obj.name for obj in generals}), 12)
        self.assertEqual(len({obj.data.name for obj in generals}), 12)
        self.assertEqual(len({obj.data.as_pointer() for obj in generals}), 12)
        self.assertEqual(len({id(obj) for obj in generals}), 12)
        for branch in BRANCHES:
            slot = bpy.data.objects[f"general-slot/{branch}"]
            general = next(obj for obj in generals if obj["target_earth"] == branch)
            self.assertEqual(general.parent, general_ring)
            self.assertEqual(slot.parent, general_ring)
            self.assertAlmostEqual(general.dimensions.z, 0.004)
            self.assertEqual(general["sector_inner_radius_m"], slot["sector_inner_radius_m"])
            self.assertEqual(general["sector_outer_radius_m"], slot["sector_outer_radius_m"])
            self.assertEqual(general["sector_angle_deg"], 30.0)
            self.assertEqual(general["radial_clearance_m"], 0.00008)
            self.assertEqual(general["angular_clearance_deg"], 0.12)
            self.assertAlmostEqual(general["settled_z_m"], slot["seat_z_m"], places=6)

    def test_slots_are_distinct_palace_transforms_with_flush_inlays(self):
        seat = bpy.data.objects["plate/generals"]
        seat_top = seat.matrix_world.translation.z + seat.dimensions.z / 2
        locations = set()
        rotations = set()
        for index, branch in enumerate(VISUAL_EARTH_ORDER):
            angle = math.radians(90 - index * 30)
            slot = bpy.data.objects[f"general-slot/{branch}"]
            general = next(obj for obj in bpy.data.objects if obj.get("target_earth") == branch)
            recess = bpy.data.objects[f"detail/general-recess/{branch}"]
            self.assertEqual(slot.parent, seat)
            self.assertAlmostEqual(
                math.atan2(math.sin(math.atan2(slot.location.y, slot.location.x) - angle), math.cos(math.atan2(slot.location.y, slot.location.x) - angle)),
                0.0,
                places=6,
            )
            self.assertAlmostEqual(slot.rotation_euler.z, angle - math.pi / 2, places=6)
            self.assertGreater(math.hypot(slot.location.x, slot.location.y), 0.08)
            self.assertVectorAlmostEqual(general.location, slot.location)
            self.assertVectorAlmostEqual(general.rotation_euler, slot.rotation_euler)
            general_top = max((general.matrix_world @ Vector(corner)).z for corner in general.bound_box)
            recess_top = max((recess.matrix_world @ Vector(corner)).z for corner in recess.bound_box)
            self.assertAlmostEqual(general_top, seat_top, places=6)
            self.assertAlmostEqual(recess_top, seat_top, places=6)
            locations.add(tuple(round(value, 6) for value in slot.location))
            rotations.add(round(slot.rotation_euler.z, 6))
        self.assertEqual(len(locations), 12)
        self.assertEqual(len(rotations), 12)

    def test_direct_general_can_use_any_slot_as_its_single_world_transform(self):
        seat = bpy.data.objects["plate/generals"]
        general = bpy.data.objects["general/noble"]
        self.assertEqual(general.parent, seat)
        for branch in (VISUAL_EARTH_ORDER[0], VISUAL_EARTH_ORDER[4]):
            target = bpy.data.objects[f"general-slot/{branch}"]
            general.location = target.location
            general.rotation_euler = target.rotation_euler
            bpy.context.view_layer.update()
            self.assertVectorAlmostEqual(general.matrix_world.translation, target.matrix_world.translation)
            self.assertAlmostEqual(
                general.matrix_world.to_quaternion().rotation_difference(target.matrix_world.to_quaternion()).angle,
                0.0,
                places=6,
            )

    def test_slots_month_glyphs_and_interaction_ring_follow_reference_order(self):
        seat = bpy.data.objects["plate/generals"]
        heaven = bpy.data.objects["plate/heaven"]
        self.assertEqual(
            [bpy.data.objects[f"general-slot/{branch}"]["visual_index"] for branch in VISUAL_EARTH_ORDER],
            list(range(12)),
        )
        for month in VISUAL_MONTH_ORDER:
            self.assertEqual(bpy.data.objects[f"month-general/{month}"].parent, heaven)
        interaction = bpy.data.objects["interaction/month-general-ring"]
        self.assertEqual(interaction.parent, heaven)
        self.assertFalse(interaction["color_write"])
        self.assertEqual(seat["fixed"], True)

    def test_fixed_black_earth_branch_inlays_form_the_only_branch_ring(self):
        parent = bpy.data.objects["plate/earth"]
        heaven = bpy.data.objects["plate/heaven"]
        heaven_top = max((heaven.matrix_world @ Vector(corner)).z for corner in heaven.bound_box)
        node_ids = [f"branch/earth/{branch}" for branch in VISUAL_EARTH_ORDER]
        ring = [bpy.data.objects[node_id] for node_id in node_ids]
        self.assertEqual(len(ring), 12)
        for index, inlay in enumerate(ring):
            self.assertEqual(inlay.parent, parent)
            self.assertEqual(inlay["branch"], VISUAL_EARTH_ORDER[index])
            self.assertEqual(inlay["ring_index"], index)
            self.assertAlmostEqual(math.hypot(inlay.location.x, inlay.location.y), 0.145, places=4)
            self.assertAlmostEqual(inlay.location.x, 0.145 * math.cos(math.radians(90 - index * 30)), places=4)
            self.assertAlmostEqual(inlay.location.y, 0.145 * math.sin(math.radians(90 - index * 30)), places=4)
            self.assertGreater(max(inlay.dimensions.x, inlay.dimensions.y), 0.018)
            self.assertLess(max(inlay.dimensions.x, inlay.dimensions.y), 0.022)
            inlay_top = max((inlay.matrix_world @ Vector(corner)).z for corner in inlay.bound_box)
            self.assertGreater(inlay_top, heaven_top)
            self.assertNotIn(f"detail/branch-bed/earth/{VISUAL_EARTH_ORDER[index]}", bpy.data.objects)
            self.assertNotIn(f"branch/heaven/{VISUAL_EARTH_ORDER[index]}", bpy.data.objects)

    def test_reference_plate_has_two_linked_outer_rings_fixed_general_ring_and_fixed_core(self):
        heaven = bpy.data.objects["plate/heaven"]
        general_ring = bpy.data.objects["plate/generals"]
        core = bpy.data.objects["plate/core"]

        self.assertEqual(heaven.parent, self.root)
        self.assertEqual(general_ring.parent, self.root)
        self.assertEqual(core.parent, self.root)
        self.assertTrue(heaven["rotates_independently"])
        self.assertTrue(general_ring["fixed"])
        self.assertTrue(core["fixed"])
        self.assertEqual(
            {
                child.get("ring_index")
                for child in heaven.children
                if child.name.startswith("detail/heaven/linked-ring-")
            },
            {1, 2},
        )
        self.assertTrue(all(general.parent == general_ring for general in (
            bpy.data.objects[f"general/{key}"] for key in GENERAL_KEYS
        )))
        self.assertFalse(any(child.parent == core for child in (heaven, general_ring)))

    def test_general_sector_top_faces_are_upward_for_pale_jade_lighting(self):
        for key in GENERAL_KEYS:
            sector = bpy.data.objects[f"general/{key}"]
            top_faces = [face for face in sector.data.polygons if face.center.z >= 0.001999]
            with self.subTest(general=key):
                self.assertTrue(top_faces)
                self.assertTrue(all(face.normal.z > 0.95 for face in top_faces))

    def test_general_names_are_legible_within_their_pale_sector_inlays(self):
        for key in GENERAL_KEYS:
            glyph = bpy.data.objects[f"general/{key}/name"]
            with self.subTest(general=key):
                self.assertGreater(max(glyph.dimensions.x, glyph.dimensions.y), 0.010)

    def test_helper_children_do_not_claim_runtime_ids(self):
        for obj in bpy.data.objects:
            if obj.name not in NODE_IDS:
                self.assertNotIn("node_id", obj, obj.name)


if __name__ == "__main__":
    unittest.main(argv=[__file__])
