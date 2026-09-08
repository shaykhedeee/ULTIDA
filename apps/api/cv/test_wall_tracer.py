"""Resolution-invariance tests for the deterministic wall detector."""

from pathlib import Path
import sys
import unittest

import cv2

sys.path.insert(0, str(Path(__file__).resolve().parent))
import wall_tracer  # noqa: E402


class WallTracerResolutionTests(unittest.TestCase):
    def test_high_and_low_resolution_variants_converge(self):
        proof = (
            Path(__file__).resolve().parents[3]
            / "floorplan analyser"
            / "ultida-flow-kit"
            / "proof"
            / "test_floorplan_input.png"
        )
        source = cv2.imread(str(proof), cv2.IMREAD_COLOR)
        self.assertIsNotNone(source, f"Could not read fixture: {proof}")

        # Treat the proof raster as the low-resolution capture and synthesize a
        # high-resolution scan of the same plan. Both are normalized to the
        # same 2400px working edge inside trace_image().
        low_resolution = source
        high_resolution = cv2.resize(source, None, fx=4, fy=4, interpolation=cv2.INTER_CUBIC)
        low = wall_tracer.trace_image(low_resolution)
        high = wall_tracer.trace_image(high_resolution)

        self.assertGreaterEqual(low["wallCount"], 1)
        self.assertGreaterEqual(high["wallCount"], 1)
        self.assertEqual(low["sourceImageSize"]["widthPx"], source.shape[1])
        self.assertEqual(high["sourceImageSize"]["widthPx"], source.shape[1] * 4)

        low_length = sum(float(w["lengthPx"]) for w in low["walls"])
        high_length = sum(float(w["lengthPx"]) for w in high["walls"])
        print(
            f"resolution convergence: low={low['wallCount']} walls/{low_length:.1f}px, "
            f"high={high['wallCount']} walls/{high_length:.1f}px"
        )
        self.assertLessEqual(
            abs(low["wallCount"] - high["wallCount"]),
            max(2, round(max(low["wallCount"], high["wallCount"]) * 0.25)),
        )
        self.assertGreater(low_length, 0)
        self.assertGreater(high_length, 0)
        self.assertLessEqual(abs(low_length - high_length) / max(low_length, high_length), 0.2)


if __name__ == "__main__":
    unittest.main()
