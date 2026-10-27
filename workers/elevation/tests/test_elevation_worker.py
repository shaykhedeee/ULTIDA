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

import copy
import pytest
import xml.etree.ElementTree as ET
from elevation_worker import project_wall

def test_wall_cabinet_keeps_mounting_height_without_invented_division():
    scene = copy.deepcopy(FIXTURE)
    scene['modules'][0].update(heightMm=600)
    scene['modules'][0]['position']['zMm'] = 1500
    _, primitives = project_wall(scene, 'wall-a')
    envelope = next(p for p in primitives if p.id == 'wardrobe-a')
    assert min(p[1] for p in envelope.points) == 1500
    assert max(p[1] for p in envelope.points) == 2100
    assert not any(p.id.endswith('-division') for p in primitives)

@pytest.mark.parametrize('field,value', [('heightMm',0),('widthMm',-10)])
def test_invalid_module_dimensions_are_rejected(field,value):
    scene=copy.deepcopy(FIXTURE)
    scene['modules'][0][field]=value
    with pytest.raises(ValueError): project_wall(scene,'wall-a')

def test_opening_cannot_extend_above_wall():
    scene=copy.deepcopy(FIXTURE)
    scene['openings'][0]['sillHeightMm']=2400
    with pytest.raises(ValueError): project_wall(scene,'wall-a')

def test_svg_escapes_unicode_labels_and_ids(tmp_path):
    scene=copy.deepcopy(FIXTURE)
    scene['modules'][0]['family']='Kitchen & café <test>'
    scene['modules'][0]['id']='id"<&'
    export(scene,'wall-a',{},str(tmp_path))
    root=ET.parse(tmp_path/'wall-a.svg').getroot()
    assert any('Kitchen & café <test>' in (e.text or '') for e in root.iter())
