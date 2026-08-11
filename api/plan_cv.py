"""Authenticated deterministic CV endpoint for ULTIDA plan analysis.

The Node API remains responsible for job ownership and Supabase persistence.
This endpoint has one narrow responsibility: run the same wall-tracer used in
local development against already-authorized raster bytes.
"""

import base64
import hmac
import json
import os
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "apps" / "api" / "cv"))
from wall_tracer import trace_walls_bytes  # noqa: E402


def send_json(response, status, value):
    body = json.dumps(value).encode("utf-8")
    response.send_response(status)
    response.send_header("content-type", "application/json; charset=utf-8")
    response.send_header("content-length", str(len(body)))
    response.end_headers()
    response.wfile.write(body)


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path.split("?", 1)[0] not in ("/internal/cv/plan", "/api/plan_cv.py"):
            return send_json(self, 404, {"success": False, "code": "NOT_FOUND"})

        expected_secret = os.environ.get("ULTIDA_WORKER_SHARED_SECRET") or os.environ.get("WORKER_DISPATCH_SECRET")
        supplied_secret = self.headers.get("x-ultida-worker-secret", "")
        if not expected_secret or not hmac.compare_digest(supplied_secret, expected_secret):
            return send_json(self, 401, {"success": False, "code": "UNAUTHORIZED"})

        try:
            length = int(self.headers.get("content-length", "0"))
            if length <= 0 or length > 10 * 1024 * 1024:
                return send_json(self, 413, {"success": False, "code": "PAYLOAD_TOO_LARGE"})
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            encoded = payload.get("imageBase64")
            if not isinstance(encoded, str) or not encoded:
                return send_json(self, 400, {"success": False, "code": "IMAGE_REQUIRED"})
            raw = base64.b64decode(encoded, validate=True)
            if not raw:
                return send_json(self, 400, {"success": False, "code": "IMAGE_REQUIRED"})
            result = trace_walls_bytes(raw)
            return send_json(self, 200, {
                "success": True,
                "result": result,
                "algorithmVersion": "wall-tracer.v1",
            })
        except (ValueError, json.JSONDecodeError, base64.binascii.Error):
            return send_json(self, 400, {"success": False, "code": "INVALID_IMAGE"})
        except Exception as error:
            # Do not return internal paths or stack traces to callers.
            print("ULTIDA CV trace failed:", str(error), file=sys.stderr)
            return send_json(self, 500, {"success": False, "code": "CV_PROCESSING_FAILED"})

    def log_message(self, _format, *_args):
        return
