import tempfile
import unittest
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector


REPOSITORY_ROOT = Path(__file__).parents[3]
MASTER_PATH = REPOSITORY_ROOT / "assets/daliuren/source/daliuren-artifact-master.blend"

import sys

sys.path.insert(0, str(Path(__file__).parents[1]))

from materials import srgb_hex
from render_lookdev_review import (
    CAMERA_NAMES,
    REVIEW_OUTPUTS,
    build_lookdev_scene,
    configure_material_closeup,
    write_review_manifest,
)


class LookdevSceneTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        bpy.ops.wm.open_mainfile(filepath=str(MASTER_PATH))

    def test_frozen_master_does_not_persist_review_only_rig(self):
        forbidden = set(CAMERA_NAMES) | {
            "light/key",
            "light/fill",
            "light/rim",
            "lookdev/ground",
        }
        self.assertFalse(forbidden.intersection(obj.name for obj in bpy.data.objects))

    def test_museum_rig_contract(self):
        build_lookdev_scene()

        scene = bpy.context.scene
        self.assertEqual(scene.render.engine, "CYCLES")
        self.assertEqual(scene.view_settings.view_transform, "AgX")
        self.assertEqual(scene.view_settings.look, "AgX - Medium High Contrast")
        self.assertEqual((scene.render.resolution_x, scene.render.resolution_y), (2560, 1440))
        self.assertEqual(scene.render.resolution_percentage, 100)
        self.assertEqual(scene.cycles.samples, 64)
        self.assertTrue(scene.cycles.use_denoising)

        background = scene.world.node_tree.nodes["Background"]
        expected_background = srgb_hex("#121817")
        self.assertEqual(
            tuple(round(channel, 6) for channel in background.inputs["Color"].default_value),
            tuple(round(channel, 6) for channel in expected_background),
        )

        cameras = {obj.name for obj in scene.objects if obj.type == "CAMERA"}
        lights = {obj.name for obj in scene.objects if obj.type == "LIGHT"}
        self.assertEqual(cameras, set(CAMERA_NAMES))
        self.assertEqual(lights, {"light/key", "light/fill", "light/rim"})
        for name in CAMERA_NAMES:
            self.assertGreaterEqual(bpy.data.objects[name].data.lens, 50.0)
            self.assertLessEqual(bpy.data.objects[name].data.lens, 70.0)

        key = bpy.data.objects["light/key"].data
        fill = bpy.data.objects["light/fill"].data
        rim = bpy.data.objects["light/rim"].data
        self.assertEqual(key.type, "AREA")
        self.assertTrue(key.use_temperature)
        self.assertEqual(key.temperature, 4300.0)
        self.assertGreaterEqual(fill.energy / key.energy, 0.25)
        self.assertLessEqual(fill.energy / key.energy, 0.35)
        self.assertEqual(rim.type, "AREA")
        self.assertEqual(rim.shape, "RECTANGLE")
        self.assertLess(rim.size_y, rim.size * 0.25)
        self.assertIn("lookdev/ground", bpy.data.objects)

    def test_material_closeup_frames_four_materials_and_a_physical_seam(self):
        build_lookdev_scene()
        configure_material_closeup()

        scene = bpy.context.scene
        camera = bpy.data.objects["camera/material-closeup"]
        self.assertLessEqual(scene.view_settings.exposure, -1.0)
        self.assertLessEqual(bpy.data.objects["light/key"].data.energy, 30.0)
        evidence = {
            "detail/heaven/detent/03": "M_Bronze",
            "detail/heaven/contact-seam/03": "M_Patina",
            "detail/heaven/inlay-bed/03": "M_Celadon",
            "inscription/mechanical-scale/62": "M_OldGold",
            "inscription/historical-month-deity/50": "M_AshText",
        }
        for object_name, material_name in evidence.items():
            obj = bpy.data.objects[object_name]
            projected = world_to_camera_view(scene, camera, obj.matrix_world.translation)
            with self.subTest(object_name=object_name):
                self.assertEqual(obj.data.materials[0].name, material_name)
                self.assertGreater(projected.z, 0.0)
                self.assertGreaterEqual(projected.x, 0.04)
                self.assertLessEqual(projected.x, 0.96)
                self.assertGreaterEqual(projected.y, 0.04)
                self.assertLessEqual(projected.y, 0.96)
        functional = bpy.data.objects["inscription/mechanical-scale/62"]
        projected_corners = [
            world_to_camera_view(scene, camera, functional.matrix_world @ Vector(corner))
            for corner in functional.bound_box
        ]
        projected_size = max(
            max(point.x for point in projected_corners) - min(point.x for point in projected_corners),
            max(point.y for point in projected_corners) - min(point.y for point in projected_corners),
        )
        self.assertGreaterEqual(projected_size, 0.012)
        self.assertEqual(
            bpy.data.objects["detail/heaven/contact-seam/03"].get("detail_id"),
            "structure/bronze-celadon-contact-seam",
        )
        self.assertTrue(camera.data.dof.use_dof)

    def test_review_manifest_records_render_settings_hashes_and_visual_results(self):
        with tempfile.TemporaryDirectory() as temporary:
            output_dir = Path(temporary)
            image_paths = []
            for index, name in enumerate(REVIEW_OUTPUTS):
                path = output_dir / f"{name}.png"
                path.write_bytes(b"lookdev-review-" + bytes([index]))
                image_paths.append(path)
            asset = output_dir / "master.blend"
            asset.write_bytes(b"master-asset")

            manifest = write_review_manifest(
                output_dir,
                image_paths,
                asset_paths=(asset,),
                visual_results={"real edge thickness": "PASS"},
            )

            contents = manifest.read_text(encoding="utf-8")
            self.assertIn(bpy.app.version_string, contents)
            self.assertIn("CYCLES", contents)
            self.assertIn("64", contents)
            self.assertIn("2560 x 1440", contents)
            self.assertIn("SHA-256", contents)
            self.assertIn("master.blend", contents)
            self.assertIn("real edge thickness", contents)
            self.assertIn("PASS", contents)


if __name__ == "__main__":
    unittest.main(argv=[__file__])
