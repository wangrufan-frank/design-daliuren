import sys
import unittest
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).parents[1]))

from build_graybox import build_graybox
from render_graybox_review import build_review_scene


CAMERA_NAMES = {
    "review/overall",
    "review/oblique",
    "review/mechanism",
    "review/top",
}
LIGHT_NAMES = {"light/key", "light/fill", "light/rim"}


class ReviewSceneTest(unittest.TestCase):
    def setUp(self):
        build_graybox()

    def test_review_rig_has_confirmed_camera_and_light_contract(self):
        build_review_scene()

        cameras = {obj.name for obj in bpy.data.objects if obj.type == "CAMERA"}
        lights = {obj.name for obj in bpy.data.objects if obj.type == "LIGHT"}
        self.assertEqual(cameras, CAMERA_NAMES)
        self.assertEqual(lights, LIGHT_NAMES)
        self.assertEqual({camera.name for camera in bpy.data.cameras}, CAMERA_NAMES)
        self.assertEqual({light.name for light in bpy.data.lights}, LIGHT_NAMES)
        self.assertTrue(
            all(50.0 <= bpy.data.cameras[name].lens <= 70.0 for name in CAMERA_NAMES)
        )
        self.assertGreaterEqual(bpy.data.objects["review/top"].location.z, 1.9)

        key = bpy.data.objects["light/key"].data
        fill = bpy.data.objects["light/fill"].data
        rim = bpy.data.objects["light/rim"].data
        self.assertAlmostEqual(key.color[0], 1.0, places=2)
        self.assertGreater(key.color[0], key.color[1])
        self.assertGreater(key.color[1], key.color[2])
        self.assertGreaterEqual(key.energy, 80.0)
        self.assertLessEqual(key.energy, 250.0)
        self.assertGreaterEqual(fill.energy / key.energy, 0.25)
        self.assertLessEqual(fill.energy / key.energy, 0.35)
        self.assertEqual(rim.type, "AREA")
        self.assertLess(rim.shape == "DISK" and rim.size or rim.size, key.size)
        self.assertGreater(rim.energy, fill.energy)

    def test_review_scene_uses_confirmed_render_and_neutral_material_settings(self):
        build_review_scene()

        scene = bpy.context.scene
        self.assertEqual(scene.render.engine, "BLENDER_EEVEE_NEXT")
        self.assertEqual((scene.render.resolution_x, scene.render.resolution_y), (1920, 1080))
        self.assertEqual(scene.render.resolution_percentage, 100)
        background = scene.world.node_tree.nodes["Background"].inputs["Color"].default_value
        self.assertLessEqual(
            scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value,
            0.08,
        )
        self.assertEqual(tuple(round(channel, 5) for channel in background[:3]), (
            round(0x12 / 255, 5),
            round(0x18 / 255, 5),
            round(0x17 / 255, 5),
        ))

        neutral = bpy.data.materials["review/neutral-gray"]
        base_color = neutral.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value
        self.assertAlmostEqual(base_color[0], base_color[1], places=5)
        self.assertAlmostEqual(base_color[1], base_color[2], places=5)
        self.assertGreaterEqual(base_color[0], 0.12)
        self.assertLessEqual(base_color[0], 0.30)
        meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
        self.assertTrue(meshes)
        self.assertTrue(all(tuple(obj.data.materials) == (neutral,) for obj in meshes))

    def test_rebuilding_review_scene_is_deterministic_and_leak_free(self):
        build_review_scene()
        first_counts = (
            len(bpy.data.objects),
            len(bpy.data.cameras),
            len(bpy.data.lights),
            len(bpy.data.materials),
        )

        build_review_scene()

        self.assertEqual(
            (
                len(bpy.data.objects),
                len(bpy.data.cameras),
                len(bpy.data.lights),
                len(bpy.data.materials),
            ),
            first_counts,
        )
        review_names = CAMERA_NAMES | LIGHT_NAMES | {"review/neutral-gray"}
        self.assertFalse(any(name.endswith(".001") for name in review_names))
        self.assertTrue(
            all("node_id" not in bpy.data.objects[name] for name in CAMERA_NAMES | LIGHT_NAMES)
        )


if __name__ == "__main__":
    unittest.main(argv=[__file__])
