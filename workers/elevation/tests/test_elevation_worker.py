import json
from pathlib import Path
import ezdxf
from elevation_worker import export

FIXTURE = {
    "schema":"scene.v1", "units":"mm", "metadata":{"status":"approved"},
    "walls":[{"id":"wall-a","start":{"xMm":0,"yMm":0},"end":{"xMm":4000,"yMm":0},"thicknessMm":150,"heightMm":2800}],
    "openings":[{"id":"window-a","wallId":"wall-a","kind":"window","offsetMm":1000,"widthMm":1200,"heightMm":1200,"sillHeightMm":900}],
    "modules":[{"id":"wardrobe-a","wallId":"wall-a","family":"wardrobe","position":{"xMm":2500,"yMm":0},"widthMm":1400,"depthMm":650,"heightMm":2400}],
}

def test_fixture_exports_shared_dimensions_and_layers(tmp_path):
    result = export(FIXTURE, "wall-a", {"sheetSize":"A4-landscape", "scale":0.1}, str(tmp_path))
    assert result["wall"]["lengthMm"] == 4000
    assert "A-ELEV-OPENING" in result["layers"] and "A-ELEV-DIM" in result["layers"]
    assert '1400 x 2400 mm' in (tmp_path / 'wall-a.svg').read_text()
    doc = ezdxf.readfile(tmp_path / 'wall-a.dxf')
    assert {layer.dxf.name for layer in doc.layers}.issuperset(result["layers"])
    assert all(entity.dxf.start != entity.dxf.end for entity in doc.modelspace() if entity.dxftype() == 'LINE')
