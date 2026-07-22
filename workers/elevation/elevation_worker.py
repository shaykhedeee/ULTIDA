"""Deterministic Altera wall-elevation exporter.

The worker consumes approved scene JSON and emits all formats from the same
primitive list. It never reads or measures rendered images.
"""
from __future__ import annotations
import json, math
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any
from shapely.geometry import LineString, Polygon
import ezdxf
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape

LAYERS = {"visible": "A-ELEV-VISIBLE", "hidden": "A-ELEV-HIDDEN", "lighting": "A-ELEV-LIGHTING", "hardware": "A-ELEV-HARDWARE", "dimensions": "A-ELEV-DIM", "labels": "A-ELEV-LABEL", "openings": "A-ELEV-OPENING"}

@dataclass(frozen=True)
class Primitive:
    kind: str
    layer: str
    id: str
    points: tuple[tuple[float, float], ...]
    text: str = ""

def _num(value: Any) -> float:
    value = float(value)
    if not math.isfinite(value): raise ValueError("non-finite measurement")
    return value

def _wall(scene: dict, wall_id: str) -> dict:
    for wall in scene.get("walls", []):
        if wall["id"] == wall_id: return wall
    raise ValueError(f"wall not found: {wall_id}")

def project_wall(scene: dict, wall_id: str) -> tuple[dict, list[Primitive]]:
    wall = _wall(scene, wall_id)
    sx, sy = _num(wall["start"]["xMm"]), _num(wall["start"]["yMm"])
    ex, ey = _num(wall["end"]["xMm"]), _num(wall["end"]["yMm"])
    length = math.hypot(ex - sx, ey - sy)
    if length <= 0: raise ValueError("wall length must be positive")
    ux, uy = (ex - sx) / length, (ey - sy) / length
    # Wall-local coordinates: X follows wall start -> end, Z is vertical.
    wall_data = {"id": wall_id, "lengthMm": length, "heightMm": _num(wall["heightMm"]), "thicknessMm": _num(wall["thicknessMm"])}
    primitives: list[Primitive] = [Primitive("line", LAYERS["visible"], wall_id, ((0, 0), (length, 0))), Primitive("line", LAYERS["visible"], f"{wall_id}-top", ((0, wall_data["heightMm"]), (length, wall_data["heightMm"]))) ]
    for opening in scene.get("openings", []):
        if opening["wallId"] != wall_id: continue
        offset, width, height = _num(opening["offsetMm"]), _num(opening["widthMm"]), _num(opening["heightMm"])
        if offset < 0 or offset + width > length + 0.01: raise ValueError(f"opening {opening['id']} outside wall")
        sill = _num(opening.get("sillHeightMm", 0))
        primitives.append(Primitive("rect", LAYERS["openings"], opening["id"], ((offset,sill),(offset+width,sill),(offset+width,sill+height),(offset,sill+height))))
    for module in scene.get("modules", []):
        if module.get("wallId") not in (None, wall_id): continue
        mx, my = _num(module["position"]["xMm"]), _num(module["position"]["yMm"])
        offset = (mx - sx) * ux + (my - sy) * uy
        distance = abs((mx - sx) * uy - (my - sy) * ux)
        if module.get("wallId") != wall_id and distance > max(50, _num(wall["thicknessMm"])): continue
        width, height = _num(module["widthMm"]), _num(module["heightMm"])
        if offset < 0 or offset + width > length + 0.01: raise ValueError(f"module {module['id']} outside wall")
        primitives.append(Primitive("rect", LAYERS["visible"], module["id"], ((offset,0),(offset+width,0),(offset+width,height),(offset,height))))
        primitives.append(Primitive("line", LAYERS["hardware"], f"{module['id']}-division", ((offset+width/2,0),(offset+width/2,height))))
        primitives.append(Primitive("text", LAYERS["labels"], f"{module['id']}-label", ((offset+10,height-30),), f"{module['family']} | {width:.0f} x {height:.0f} mm"))
    primitives.extend([Primitive("line", LAYERS["dimensions"], f"{wall_id}-dim-h", ((0,-120),(length,-120)), f"{length:.0f} mm"), Primitive("line", LAYERS["dimensions"], f"{wall_id}-dim-v", ((-120,0),(-120,wall_data["heightMm"])), f"{wall_data['heightMm']:.0f} mm")])
    return wall_data, validate_primitives(primitives)

def validate_primitives(primitives: list[Primitive]) -> list[Primitive]:
    for primitive in primitives:
        if len(primitive.points) < 1 or any(not math.isfinite(v) for point in primitive.points for v in point): raise ValueError(f"invalid primitive {primitive.id}")
        if primitive.kind == "line" and primitive.points[0] == primitive.points[-1]: raise ValueError(f"zero-length entity {primitive.id}")
        if primitive.kind == "rect" and not Polygon(primitive.points).is_valid: raise ValueError(f"invalid rectangle {primitive.id}")
    return primitives

def _write_svg(path: Path, wall: dict, primitives: list[Primitive], scale: float, title: str):
    width, height = wall["lengthMm"] * scale + 240, wall["heightMm"] * scale + 260
    def p(point): return (point[0]*scale+150, height-150-point[1]*scale)
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width:.2f}mm" height="{height:.2f}mm" viewBox="0 0 {width:.2f} {height:.2f}"><title>{title}</title>']
    for item in primitives:
        pts = [p(x) for x in item.points]; style = f'data-layer="{item.layer}" data-id="{item.id}" fill="none" stroke="#38291f" stroke-width="1"'
        if item.kind == "line": out.append(f'<line {style} x1="{pts[0][0]}" y1="{pts[0][1]}" x2="{pts[-1][0]}" y2="{pts[-1][1]}"/>')
        elif item.kind == "rect": out.append(f'<polygon {style} points="{" ".join(f"{x},{y}" for x,y in pts)}"/>')
        elif item.kind == "text": out.append(f'<text {style} x="{pts[0][0]}" y="{pts[0][1]}" font-size="8">{item.text}</text>')
    path.write_text("".join(out)+"</svg>", encoding="ascii")

def _write_dxf(path: Path, wall: dict, primitives: list[Primitive], title: str):
    doc = ezdxf.new("R2018", setup=True); doc.header["$INSUNITS"] = 4; doc.header["$MEASUREMENT"] = 1
    for layer in LAYERS.values(): doc.layers.add(layer)
    msp = doc.modelspace()
    for item in primitives:
        if item.kind == "line": msp.add_line(item.points[0], item.points[-1], dxfattribs={"layer":item.layer})
        elif item.kind == "rect": msp.add_lwpolyline(item.points, close=True, dxfattribs={"layer":item.layer})
        elif item.kind == "text": msp.add_text(item.text, dxfattribs={"layer":item.layer, "height":25}).set_placement(item.points[0])
    doc.saveas(path)

def _write_pdf(path: Path, wall: dict, primitives: list[Primitive], settings: dict, title: str):
    page = landscape(A4) if settings.get("sheetSize", "A4-landscape") == "A4-landscape" else landscape(A4)
    c = canvas.Canvas(str(path), pagesize=page); pw, ph = page; scale = min((pw-90)/wall["lengthMm"], (ph-110)/wall["heightMm"]); ox, oy = 45, 45
    c.setTitle(title); c.setFont("Helvetica-Bold", 11); c.drawString(45, ph-32, title)
    for item in primitives:
        pts = [(ox+x*scale, oy+y*scale) for x,y in item.points]
        if item.kind == "line": c.line(*pts[0], *pts[-1])
        elif item.kind == "rect": c.lines([(pts[i][0],pts[i][1],pts[(i+1)%len(pts)][0],pts[(i+1)%len(pts)][1]) for i in range(len(pts))])
        elif item.kind == "text": c.setFont("Helvetica", 6); c.drawString(*pts[0], item.text)
    c.setFont("Helvetica", 7); c.drawRightString(pw-45, 25, f"UNITS: mm | SCALE: 1:{1/scale*1000:.0f}"); c.save()

def export(scene: dict, wall_id: str, settings: dict, output_dir: str) -> dict:
    if scene.get("metadata", {}).get("status") not in ("approved", "locked"): raise ValueError("only approved scenes can export")
    wall, primitives = project_wall(scene, wall_id); out = Path(output_dir); out.mkdir(parents=True, exist_ok=True); title = f"Altera Wall Elevation {wall_id}"
    scale = float(settings.get("scale", 0.1)); paths = {"svg":out/f"{wall_id}.svg", "pdf":out/f"{wall_id}.pdf", "dxf":out/f"{wall_id}.dxf"}
    _write_svg(paths["svg"], wall, primitives, scale, title); _write_pdf(paths["pdf"], wall, primitives, settings, title); _write_dxf(paths["dxf"], wall, primitives, title)
    return {"wall": wall, "primitiveCount": len(primitives), "layers": sorted({p.layer for p in primitives}), "paths": {k:str(v) for k,v in paths.items()}}

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(); parser.add_argument("scene"); parser.add_argument("wall_id"); parser.add_argument("output_dir"); parser.add_argument("--settings", default="{}")
    args = parser.parse_args(); print(json.dumps(export(json.loads(Path(args.scene).read_text()), args.wall_id, json.loads(args.settings), args.output_dir), indent=2))
