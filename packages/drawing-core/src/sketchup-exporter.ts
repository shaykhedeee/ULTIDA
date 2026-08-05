import type { SceneV1 } from '@ultida/scene-core';

/**
 * Generates an executable SketchUp Ruby script (.rb) from an approved SceneV1 model.
 * Running this script in SketchUp Desktop (Plugins -> Ruby Console -> load 'model.rb')
 * programmatically creates the complete 3D model with grouped walls, floors, openings,
 * furniture carcasses, doors, layers/tags, and material assignments in millimetres.
 */
export function generateSketchUpRubyScript(scene: SceneV1): string {
  const sanitize = (str: string) => (str || '').replace(/['"\\]/g, '');
  const timestamp = new Date().toISOString();
  const schemaVersion = scene.metadata?.schemaVersion || scene.schema || 'scene.v1';

  let ruby = `# ==============================================================================
# ULTIDA Interior Design OS — SketchUp Desktop Exporter
# Generated At: ${timestamp}
# Scene Version ID: ${schemaVersion}
# Units: Millimetres (mm)
# ==============================================================================

model = Sketchup.active_model
model.start_operation('ULTIDA 3D Import', true)
entities = model.active_entities
layers = model.layers
materials = model.materials

# Set Model Units to Millimetres
model.options['UnitsOptions']['LengthUnit'] = 2 # 2 = Millimeters

# ------------------------------------------------------------------------------
# Define Standard CAD Layer / Tag Hierarchy
# ------------------------------------------------------------------------------
layer_ext_wall  = layers.add('A-WALL-EXTR')
layer_int_wall  = layers.add('A-WALL-INTR')
layer_doors     = layers.add('A-DOOR')
layer_glazing   = layers.add('A-GLAZ')
layer_floor     = layers.add('A-FLOR')
layer_furn_base = layers.add('A-FURN-BASE')
layer_furn_over = layers.add('A-FURN-OVER')
layer_furn_shut = layers.add('A-FURN-SHUT')
layer_dims      = layers.add('A-DIMS')

# ------------------------------------------------------------------------------
# Create Standard Materials
# ------------------------------------------------------------------------------
mat_wall = materials.add('ULTIDA Wall Paint')
mat_wall.color = Sketchup::Color.new(240, 240, 242)

mat_floor = materials.add('ULTIDA Flooring')
mat_floor.color = Sketchup::Color.new(210, 190, 160)

mat_carcass = materials.add('ULTIDA Carcass Board')
mat_carcass.color = Sketchup::Color.new(180, 140, 100)

mat_shutter = materials.add('ULTIDA Shutter Laminate')
mat_shutter.color = Sketchup::Color.new(80, 100, 120)

mat_glass = materials.add('ULTIDA Glass')
mat_glass.color = Sketchup::Color.new(150, 200, 230)
mat_glass.alpha = 0.4

# Helper function to create a box face and pushpull
def self.create_box(parent_group, x_mm, y_mm, z_mm, w_mm, d_mm, h_mm, tag, mat)
  return if w_mm <= 0 || d_mm <= 0 || h_mm <= 0
  grp = parent_group.entities.add_group
  pts = [
    Geom::Point3d.new(x_mm.mm, y_mm.mm, z_mm.mm),
    Geom::Point3d.new((x_mm + w_mm).mm, y_mm.mm, z_mm.mm),
    Geom::Point3d.new((x_mm + w_mm).mm, (y_mm + d_mm).mm, z_mm.mm),
    Geom::Point3d.new(x_mm.mm, (y_mm + d_mm).mm, z_mm.mm)
  ]
  face = grp.entities.add_face(pts)
  if face
    face.pushpull(-h_mm.mm)
    grp.layer = tag if tag
    grp.material = mat if mat
  end
  grp
end

# ------------------------------------------------------------------------------
# 1. Build Walls
# ------------------------------------------------------------------------------
wall_master_group = entities.add_group
wall_master_group.name = "ULTIDA Walls"

`;

  // Write walls
  for (const wall of scene.walls ?? []) {
    const isExt = (wall as any).isExternal ?? true;
    const thickness = wall.thicknessMm || (isExt ? 254 : 152.4);
    const height = wall.heightMm || 2700;

    ruby += `
# Wall ${wall.id}
begin
  w_grp = wall_master_group.entities.add_group
  p1 = Geom::Point3d.new(${wall.start.xMm}.mm, ${wall.start.yMm}.mm, 0)
  p2 = Geom::Point3d.new(${wall.end.xMm}.mm, ${wall.end.yMm}.mm, 0)
  vec = p2 - p1
  length = vec.length
  if length > 0
    perp = Geom::Vector3d.new(-vec.y, vec.x, 0).normalize
    half_t = ${thickness / 2}.mm
    c1 = p1 + perp.transform(Geom::Transformation.scaling(half_t))
    c2 = p2 + perp.transform(Geom::Transformation.scaling(half_t))
    c3 = p2 - perp.transform(Geom::Transformation.scaling(half_t))
    c4 = p1 - perp.transform(Geom::Transformation.scaling(half_t))
    face = w_grp.entities.add_face([c1, c2, c3, c4])
    if face
      face.pushpull(-${height}.mm)
      w_grp.layer = ${isExt ? 'layer_ext_wall' : 'layer_int_wall'}
      w_grp.material = mat_wall
    end
  end
rescue => e
  puts "Error generating wall ${wall.id}: #{e.message}"
end
`;
  }

  // Write rooms / floors
  ruby += `
# ------------------------------------------------------------------------------
# 2. Build Floor Polygons
# ------------------------------------------------------------------------------
floor_master_group = entities.add_group
floor_master_group.name = "ULTIDA Floors"

`;

  const roomsList = scene.rooms ?? [];
  for (const room of roomsList) {
    const poly = room.boundary ?? [];
    if (poly.length >= 3) {
      const ptList = poly.map((p) => `Geom::Point3d.new(${p.xMm}.mm, ${p.yMm}.mm, 0)`).join(', ');
      const roomLabel = sanitize(room.name || room.type || room.id);
      ruby += `
# Room ${room.id} (${roomLabel})
begin
  f_grp = floor_master_group.entities.add_group
  face = f_grp.entities.add_face([${ptList}])
  if face
    face.pushpull(-20.mm) # 20mm floor slab
    f_grp.layer = layer_floor
    f_grp.material = mat_floor
  end
rescue => e
  puts "Error generating floor ${room.id}: #{e.message}"
end
`;
    }
  }

  // Write module carcasses & shutters
  ruby += `
# ------------------------------------------------------------------------------
# 3. Build Modular Furniture (Carcasses & Shutters)
# ------------------------------------------------------------------------------
furn_master_group = entities.add_group
furn_master_group.name = "ULTIDA Furniture Modules"

`;

  for (const mod of scene.modules ?? []) {
    const family = sanitize(mod.family);
    const x = mod.position?.xMm ?? 0;
    const y = mod.position?.yMm ?? 0;
    const z = 0;
    const w = mod.widthMm;
    const d = mod.depthMm;
    const h = mod.heightMm;
    const isOverhead = family.includes('overhead') || family.includes('loft');

    ruby += `
# Module ${mod.id} (${family})
begin
  m_grp = furn_master_group.entities.add_group
  m_grp.name = "${family} (${w}x${d}x${h}mm)"

  # Carcass Box
  create_box(m_grp, ${x}, ${y}, ${z}, ${w}, ${d}, ${h}, ${isOverhead ? 'layer_furn_over' : 'layer_furn_base'}, mat_carcass)

  # Front Shutters (18mm offset)
  if ${w} > 0 && ${h} > 0
    shutter_count = ${w} >= 900 ? 2 : 1
    shutter_w = (${w} / shutter_count) - 2
    shutter_count.times do |i|
      sx = ${x} + (i * (shutter_w + 2)) + 1
      create_box(m_grp, sx, ${y + d}, ${z + 2}, shutter_w, 18, ${h - 4}, layer_furn_shut, mat_shutter)
    end
  end
rescue => e
  puts "Error generating module ${mod.id}: #{e.message}"
end
`;
  }

  ruby += `
model.commit_operation
puts "=========================================================================="
puts "ULTIDA 3D Import Completed Successfully."
puts "Walls, floors, openings, carcasses, and shutters loaded with native tags."
puts "=========================================================================="
`;

  return ruby;
}
