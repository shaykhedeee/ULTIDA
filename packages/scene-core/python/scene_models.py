"""Python validation boundary for the canonical ULTIDA scene.v1 JSON contract."""
from pathlib import Path
import json
from pydantic import BaseModel, ConfigDict, Field, model_validator

class PointMm(BaseModel):
    model_config = ConfigDict(extra='forbid')
    xMm: float
    yMm: float

class SceneV1(BaseModel):
    model_config = ConfigDict(extra='forbid')
    schema: str = Field(pattern='^scene\\.v1$')
    units: str = Field(pattern='^mm$')
    coordinateSystem: str = Field(pattern='^right-handed-z-up$')
    projectId: str
    floorPlanVersionId: str
    floors: list[dict]
    spaces: list[dict]
    rooms: list[dict]
    walls: list[dict]
    openings: list[dict]
    fixedFixtures: list[dict]
    modules: list[dict]
    materials: list[dict]
    lighting: list[dict]
    cameras: list[dict]
    constraints: list[dict]
    unresolvedDetections: list[dict]
    metadata: dict

    @model_validator(mode='after')
    def validate_geometry(self):
        ids = set()
        for collection in ('floors','spaces','rooms','walls','openings','fixedFixtures','modules','materials','lighting','cameras','constraints','unresolvedDetections'):
            for item in getattr(self, collection):
                if item['id'] in ids: raise ValueError(f'duplicate entity id: {item["id"]}')
                ids.add(item['id'])
        for room in self.rooms:
            if room['boundary'][0] != room['boundary'][-1]: raise ValueError('room polygon must be closed')
        for wall in self.walls:
            if wall['start'] == wall['end']: raise ValueError('wall length must be positive')
        return self

def load_scene(path: str | Path) -> SceneV1:
    return SceneV1.model_validate_json(Path(path).read_text(encoding='utf-8'))
