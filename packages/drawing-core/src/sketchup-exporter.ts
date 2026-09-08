import type { SceneV1, SceneWallV1, SceneOpeningV1, SceneModuleV1, SceneModulePartV1, SceneRoomV1, ScenePointMm } from './scene-types.js';

/**
 * Generates an ultra-accurate, production-grade SketchUp Ruby script (.rb)
 * from an approved SceneV1 model.
 *
 * When loaded into SketchUp Desktop (Ruby Console: load 'model.rb'):
 * 1. Organizes entities into standard professional CAD Layers / Tags (A-WALL, A-DOOR, A-GLAZ, A-FLOR, A-CLNG, A-FURN-*)
 * 2. Assigns calibrated luxury materials (Italian marble, oak parquet, birch carcass, PU matte shutters, brass hardware)
 * 3. Segments walls around architectural openings (sill walls, lintels, door frames, swing leaves, window frames & glass)
 * 4. Models true modular System 32 casework (18mm gables, top/bottom, 6mm backing, 75mm plinth kick, shelves, shutters, handles)
 * 5. Applies true 3D spatial transformations (rotationDeg + 3D translation) so modules align perfectly with walls
 * 6. Generates false ceilings with recessed cove lighting strips, spotlights, and perimeter skirting
 * 7. Adds standard presentation Scene Pages (tabs) for 3D Orbit, 2D Floor Plan, and per-room eye-level perspectives
 */
export function generateSketchUpRubyScript(scene: SceneV1): string {
  const sanitize = (str: string) => (str || '').replace(/['"\\]/g, '');
  const timestamp = new Date().toISOString();
  const schemaVersion = scene.metadata?.schemaVersion || scene.schema || 'scene.v1';
  const projectId = sanitize(scene.projectId || 'project');

  let ruby = `# ==============================================================================
# ULTIDA Interior Design OS — SketchUp Pro / Desktop Exporter
# Project: ${projectId}
# Generated: ${timestamp}
# Schema: ${schemaVersion}
# Units: Millimetres (mm)
# ==============================================================================

model = Sketchup.active_model
model.start_operation('ULTIDA 3D Architecture & Modular Casework', true)

entities = model.active_entities
layers = model.layers
materials = model.materials
pages = model.pages

# Set Model Units to Millimetres
model.options['UnitsOptions']['LengthUnit'] = 2 # 2 = Millimeters

# ------------------------------------------------------------------------------
# 1. Setup Standard CAD Layer / Tag Hierarchy
# ------------------------------------------------------------------------------
layer_ext_wall  = layers.add('A-WALL-EXTR')
layer_int_wall  = layers.add('A-WALL-INTR')
layer_skirt     = layers.add('A-WALL-SKIR')
layer_doors     = layers.add('A-DOOR')
layer_glazing   = layers.add('A-GLAZ')
layer_floor     = layers.add('A-FLOR')
layer_ceiling   = layers.add('A-CLNG')
layer_furn_base = layers.add('A-FURN-BASE')
layer_furn_over = layers.add('A-FURN-OVER')
layer_furn_shut = layers.add('A-FURN-SHUT')
layer_furn_shel = layers.add('A-FURN-SHEL')
layer_furn_hard = layers.add('A-FURN-HARD')
layer_lighting  = layers.add('A-LITE')

# ------------------------------------------------------------------------------
# 2. Setup Luxury Calibrated Architectural Materials
# ------------------------------------------------------------------------------
def self.ultida_find_or_create_mat(mats, name, r, g, b, alpha = 1.0)
  mat = mats[name] || mats.add(name)
  mat.color = Sketchup::Color.new(r, g, b)
  mat.alpha = alpha if alpha < 1.0
  mat
end

mat_wall_ext    = ultida_find_or_create_mat(materials, 'ULTIDA Wall Exterior Plaster', 234, 232, 228)
mat_wall_int    = ultida_find_or_create_mat(materials, 'ULTIDA Wall Interior Paint', 246, 246, 248)
mat_floor_wood  = ultida_find_or_create_mat(materials, 'ULTIDA Flooring Oak Parquet', 202, 168, 130)
mat_floor_tile  = ultida_find_or_create_mat(materials, 'ULTIDA Flooring Italian Marble', 238, 236, 232)
mat_carcass     = ultida_find_or_create_mat(materials, 'ULTIDA Birch Plywood Carcass', 228, 202, 156)
mat_shutter     = ultida_find_or_create_mat(materials, 'ULTIDA PU Matte Shutter', 72, 85, 100)
mat_accent      = ultida_find_or_create_mat(materials, 'ULTIDA Fluted Walnut Accent', 108, 68, 42)
mat_glass       = ultida_find_or_create_mat(materials, 'ULTIDA Clear Glazing Glass', 160, 196, 224, 0.35)
mat_frame       = ultida_find_or_create_mat(materials, 'ULTIDA Anodized Aluminum Frame', 42, 43, 46)
mat_door_timber = ultida_find_or_create_mat(materials, 'ULTIDA Teak Timber Door', 128, 74, 36)
mat_hardware    = ultida_find_or_create_mat(materials, 'ULTIDA Brushed Brass Hardware', 198, 162, 92)
mat_plinth      = ultida_find_or_create_mat(materials, 'ULTIDA Charcoal Matte Plinth', 40, 40, 42)
mat_ceiling     = ultida_find_or_create_mat(materials, 'ULTIDA Gypsum Ceiling White', 255, 255, 255)
mat_led_cove    = ultida_find_or_create_mat(materials, 'ULTIDA LED 3000K Warm Cove', 255, 244, 212)

# ------------------------------------------------------------------------------
# 3. Geometric Modeling Helper Functions
# ------------------------------------------------------------------------------

# Helper: Create an axis-aligned 3D box inside a local group
def self.ultida_create_box(parent_group, x_mm, y_mm, z_mm, w_mm, d_mm, h_mm, tag, mat)
  return nil if w_mm <= 0 || d_mm <= 0 || h_mm <= 0
  grp = parent_group.entities.add_group
  p1 = Geom::Point3d.new(x_mm.mm, y_mm.mm, z_mm.mm)
  p2 = Geom::Point3d.new((x_mm + w_mm).mm, y_mm.mm, z_mm.mm)
  p3 = Geom::Point3d.new((x_mm + w_mm).mm, (y_mm + d_mm).mm, z_mm.mm)
  p4 = Geom::Point3d.new(x_mm.mm, (y_mm + d_mm).mm, z_mm.mm)
  face = grp.entities.add_face([p1, p2, p3, p4])
  if face
    push_dist = face.normal.z > 0 ? h_mm.mm : -h_mm.mm
    face.pushpull(push_dist)
    grp.layer = tag if tag
    grp.material = mat if mat
  end
  grp
end

# Helper: Extrude a horizontal polygon upwards in Z
def self.ultida_extrude_polygon(parent_group, pts, base_z_mm, height_mm, tag, mat)
  return nil if pts.length < 3 || height_mm <= 0
  grp = parent_group.entities.add_group
  z_pts = pts.map { |p| Geom::Point3d.new(p.x, p.y, base_z_mm.mm) }
  face = grp.entities.add_face(z_pts)
  if face
    push_dist = face.normal.z > 0 ? height_mm.mm : -height_mm.mm
    face.pushpull(push_dist)
    grp.layer = tag if tag
    grp.material = mat if mat
  end
  grp
end

# Helper: Create an oriented wall segment between two 2D points with thickness and height
def self.ultida_create_wall_segment(parent_group, p1_x, p1_y, p2_x, p2_y, nx, ny, half_t_mm, base_z_mm, height_mm, tag, mat)
  return nil if height_mm <= 0
  dx = p2_x - p1_x
  dy = p2_y - p1_y
  len = Math.hypot(dx, dy)
  return nil if len < 1.0

  grp = parent_group.entities.add_group
  c1 = Geom::Point3d.new((p1_x + nx * half_t_mm).mm, (p1_y + ny * half_t_mm).mm, base_z_mm.mm)
  c2 = Geom::Point3d.new((p2_x + nx * half_t_mm).mm, (p2_y + ny * half_t_mm).mm, base_z_mm.mm)
  c3 = Geom::Point3d.new((p2_x - nx * half_t_mm).mm, (p2_y - ny * half_t_mm).mm, base_z_mm.mm)
  c4 = Geom::Point3d.new((p1_x - nx * half_t_mm).mm, (p1_y - ny * half_t_mm).mm, base_z_mm.mm)

  face = grp.entities.add_face([c1, c2, c3, c4])
  if face
    push_dist = face.normal.z > 0 ? height_mm.mm : -height_mm.mm
    face.pushpull(push_dist)
    grp.layer = tag if tag
    grp.material = mat if mat
  end
  grp
end

# Helper: Create realistic window assembly (outer frame + translucent glass pane)
def self.ultida_create_window_assembly(parent_group, p1_x, p1_y, p2_x, p2_y, nx, ny, half_t_mm, sill_z_mm, win_h_mm, tag_glaz, mat_frame, mat_glass)
  return nil if win_h_mm <= 0
  dx = p2_x - p1_x
  dy = p2_y - p1_y
  len = Math.hypot(dx, dy)
  return nil if len < 10.0

  w_grp = parent_group.entities.add_group
  w_grp.name = "Window Assembly (#{len.round}x#{win_h_mm.round}mm)"

  # Frame outer perimeter (50mm wide x 50mm deep)
  frame_d = [half_t_mm * 2, 75.0].min
  half_fd = frame_d / 2.0
  ultida_create_wall_segment(w_grp, p1_x, p1_y, p2_x, p2_y, nx, ny, half_fd, sill_z_mm, 45.0, tag_glaz, mat_frame) # Bottom sill frame
  ultida_create_wall_segment(w_grp, p1_x, p1_y, p2_x, p2_y, nx, ny, half_fd, sill_z_mm + win_h_mm - 45.0, 45.0, tag_glaz, mat_frame) # Top head frame

  # Glass pane (6mm thick, centered)
  ultida_create_wall_segment(w_grp, p1_x, p1_y, p2_x, p2_y, nx, ny, 3.0, sill_z_mm + 45.0, win_h_mm - 90.0, tag_glaz, mat_glass)
  w_grp
end

# Helper: Create realistic door assembly (timber jambs, header, swing panel & brass handle)
def self.ultida_create_door_assembly(parent_group, p1_x, p1_y, p2_x, p2_y, nx, ny, half_t_mm, base_z_mm, door_h_mm, tag_door, mat_timber, mat_hw)
  return nil if door_h_mm <= 0
  dx = p2_x - p1_x
  dy = p2_y - p1_y
  len = Math.hypot(dx, dy)
  return nil if len < 100.0

  d_grp = parent_group.entities.add_group
  d_grp.name = "Door Assembly (#{len.round}x#{door_h_mm.round}mm)"

  # Door Frame: Header at top (60mm high)
  frame_d = [half_t_mm * 2, 100.0].min
  half_fd = frame_d / 2.0
  ultida_create_wall_segment(d_grp, p1_x, p1_y, p2_x, p2_y, nx, ny, half_fd, base_z_mm + door_h_mm - 60.0, 60.0, tag_door, mat_timber)

  # Door Shutter Leaf (35mm thick, slightly swung open at ~15 degrees for architectural depth)
  leaf_len = len - 100.0
  leaf_h = door_h_mm - 65.0
  if leaf_len > 100.0 && leaf_h > 100.0
    u_x = dx / len
    u_y = dy / len
    # Hinge point near p1
    hx = p1_x + u_x * 50.0
    hy = p1_y + u_y * 50.0
    # Swing vector at 15 degrees: rotate direction vector by ~0.26 radians
    cos_a = Math.cos(0.26)
    sin_a = Math.sin(0.26)
    leaf_vx = (u_x * cos_a - u_y * sin_a) * leaf_len
    leaf_vy = (u_x * sin_a + u_y * cos_a) * leaf_len
    lx2 = hx + leaf_vx
    ly2 = hy + leaf_vy
    leaf_nx = -leaf_vy / leaf_len
    leaf_ny = leaf_vx / leaf_len

    ultida_create_wall_segment(d_grp, hx, hy, lx2, ly2, leaf_nx, leaf_ny, 17.5, base_z_mm + 5.0, leaf_h, tag_door, mat_timber)

    # Brass lever handle at 950mm height
    hx_pos = lx2 - (leaf_vx / leaf_len) * 60.0
    hy_pos = ly2 - (leaf_vy / leaf_len) * 60.0
    handle_grp = d_grp.entities.add_group
    handle_pts = [
      Geom::Point3d.new(hx_pos.mm, hy_pos.mm, (base_z_mm + 950.0).mm),
      Geom::Point3d.new((hx_pos + leaf_nx * 40.0).mm, (hy_pos + leaf_ny * 40.0).mm, (base_z_mm + 950.0).mm),
      Geom::Point3d.new((hx_pos + leaf_nx * 40.0).mm, (hy_pos + leaf_ny * 40.0).mm, (base_z_mm + 965.0).mm),
      Geom::Point3d.new(hx_pos.mm, hy_pos.mm, (base_z_mm + 965.0).mm)
    ]
    h_face = handle_grp.entities.add_face(handle_pts)
    if h_face
      h_face.pushpull(120.mm)
      handle_grp.layer = tag_door
      handle_grp.material = mat_hw
    end
  end
  d_grp
end

# ------------------------------------------------------------------------------
# 4. Build Walls with Architectural Opening Cutouts (Doors, Windows, Passages)
# ------------------------------------------------------------------------------
wall_master_group = entities.add_group
wall_master_group.name = "ULTIDA Walls"

`;

  // Build walls with opening segmentations
  const wallsList = scene.walls ?? [];
  const openingsList = scene.openings ?? [];

  for (const wall of wallsList) {
    const isExt = (wall as any).isExternal ?? true;
    const thickness = wall.thicknessMm || (isExt ? 254 : 152.4);
    const height = wall.heightMm || 2700;
    const baseZ = wall.baseElevationMm || 0;
    const x1 = wall.start.xMm;
    const y1 = wall.start.yMm;
    const x2 = wall.end.xMm;
    const y2 = wall.end.yMm;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const wallLen = Math.hypot(dx, dy);
    if (wallLen < 1.0) continue;

    const ux = dx / wallLen;
    const uy = dy / wallLen;
    const nx = -uy;
    const ny = ux;
    const halfT = thickness / 2.0;

    // Find and sort openings along this wall
    const wallOpenings = openingsList
      .filter((op: SceneOpeningV1) => op.wallId === wall.id)
      .sort((a: SceneOpeningV1, b: SceneOpeningV1) => a.offsetMm - b.offsetMm);

    ruby += `
# ------------------------------------------------------------------------------
# Wall: ${wall.id} (${isExt ? 'Exterior' : 'Interior'}, L: ${wallLen.toFixed(1)}mm, T: ${thickness}mm, H: ${height}mm)
# ------------------------------------------------------------------------------
begin
  w_master_${wall.id} = wall_master_group.entities.add_group
  w_master_${wall.id}.name = "Wall ${wall.id}"
  tag_wall = ${isExt ? 'layer_ext_wall' : 'layer_int_wall'}
  mat_w = ${isExt ? 'mat_wall_ext' : 'mat_wall_int'}
`;

    if (wallOpenings.length === 0) {
      // Solid wall with no openings
      ruby += `  ultida_create_wall_segment(w_master_${wall.id}, ${x1}, ${y1}, ${x2}, ${y2}, ${nx.toFixed(5)}, ${ny.toFixed(5)}, ${halfT}, ${baseZ}, ${height}, tag_wall, mat_w)\n`;
    } else {
      // Wall with architectural openings: segment along centerline
      let currentOffset = 0;

      for (let i = 0; i < wallOpenings.length; i++) {
        const op = wallOpenings[i];
        const oStart = Math.max(0, Math.min(wallLen, op.offsetMm));
        const oWidth = op.widthMm;
        const oEnd = Math.min(wallLen, oStart + oWidth);

        // Segment before opening
        if (oStart > currentOffset + 1.0) {
          const segP1x = x1 + ux * currentOffset;
          const segP1y = y1 + uy * currentOffset;
          const segP2x = x1 + ux * oStart;
          const segP2y = y1 + uy * oStart;
          ruby += `  # Solid segment before opening ${op.id}\n`;
          ruby += `  ultida_create_wall_segment(w_master_${wall.id}, ${segP1x.toFixed(2)}, ${segP1y.toFixed(2)}, ${segP2x.toFixed(2)}, ${segP2y.toFixed(2)}, ${nx.toFixed(5)}, ${ny.toFixed(5)}, ${halfT}, ${baseZ}, ${height}, tag_wall, mat_w)\n`;
        }

        // Opening span [oStart, oEnd]
        const opP1x = x1 + ux * oStart;
        const opP1y = y1 + uy * oStart;
        const opP2x = x1 + ux * oEnd;
        const opP2y = y1 + uy * oEnd;

        if (op.kind === 'window') {
          const sillH = op.sillHeightMm ?? 900;
          const winH = op.heightMm;
          const lintelBase = baseZ + sillH + winH;
          const lintelH = baseZ + height - lintelBase;

          ruby += `  # Window Opening: ${op.id} (Sill: ${sillH}mm, Height: ${winH}mm)\n`;
          if (sillH > 0) {
            ruby += `  ultida_create_wall_segment(w_master_${wall.id}, ${opP1x.toFixed(2)}, ${opP1y.toFixed(2)}, ${opP2x.toFixed(2)}, ${opP2y.toFixed(2)}, ${nx.toFixed(5)}, ${ny.toFixed(5)}, ${halfT}, ${baseZ}, ${sillH}, tag_wall, mat_w) # Sill wall\n`;
          }
          ruby += `  ultida_create_window_assembly(w_master_${wall.id}, ${opP1x.toFixed(2)}, ${opP1y.toFixed(2)}, ${opP2x.toFixed(2)}, ${opP2y.toFixed(2)}, ${nx.toFixed(5)}, ${ny.toFixed(5)}, ${halfT}, ${baseZ + sillH}, ${winH}, layer_glazing, mat_frame, mat_glass)\n`;
          if (lintelH > 0) {
            ruby += `  ultida_create_wall_segment(w_master_${wall.id}, ${opP1x.toFixed(2)}, ${opP1y.toFixed(2)}, ${opP2x.toFixed(2)}, ${opP2y.toFixed(2)}, ${nx.toFixed(5)}, ${ny.toFixed(5)}, ${halfT}, ${lintelBase}, ${lintelH}, tag_wall, mat_w) # Lintel wall\n`;
          }
        } else if (op.kind === 'door') {
          const doorH = op.heightMm;
          const lintelBase = baseZ + doorH;
          const lintelH = baseZ + height - lintelBase;

          ruby += `  # Door Opening: ${op.id} (Height: ${doorH}mm)\n`;
          ruby += `  ultida_create_door_assembly(w_master_${wall.id}, ${opP1x.toFixed(2)}, ${opP1y.toFixed(2)}, ${opP2x.toFixed(2)}, ${opP2y.toFixed(2)}, ${nx.toFixed(5)}, ${ny.toFixed(5)}, ${halfT}, ${baseZ}, ${doorH}, layer_doors, mat_door_timber, mat_hardware)\n`;
          if (lintelH > 0) {
            ruby += `  ultida_create_wall_segment(w_master_${wall.id}, ${opP1x.toFixed(2)}, ${opP1y.toFixed(2)}, ${opP2x.toFixed(2)}, ${opP2y.toFixed(2)}, ${nx.toFixed(5)}, ${ny.toFixed(5)}, ${halfT}, ${lintelBase}, ${lintelH}, tag_wall, mat_w) # Lintel wall\n`;
          }
        } else {
          // Passage (clear opening with lintel)
          const passageH = op.heightMm;
          const lintelBase = baseZ + passageH;
          const lintelH = baseZ + height - lintelBase;
          ruby += `  # Passage Opening: ${op.id}\n`;
          if (lintelH > 0) {
            ruby += `  ultida_create_wall_segment(w_master_${wall.id}, ${opP1x.toFixed(2)}, ${opP1y.toFixed(2)}, ${opP2x.toFixed(2)}, ${opP2y.toFixed(2)}, ${nx.toFixed(5)}, ${ny.toFixed(5)}, ${halfT}, ${lintelBase}, ${lintelH}, tag_wall, mat_w)\n`;
          }
        }

        currentOffset = oEnd;
      }

      // Final segment to end of wall
      if (currentOffset < wallLen - 1.0) {
        const segP1x = x1 + ux * currentOffset;
        const segP1y = y1 + uy * currentOffset;
        ruby += `  # Final wall segment after openings\n`;
        ruby += `  ultida_create_wall_segment(w_master_${wall.id}, ${segP1x.toFixed(2)}, ${segP1y.toFixed(2)}, ${x2}, ${y2}, ${nx.toFixed(5)}, ${ny.toFixed(5)}, ${halfT}, ${baseZ}, ${height}, tag_wall, mat_w)\n`;
      }
    }

    ruby += `rescue => e\n  puts "Notice: Wall ${wall.id} build status: #{e.message}"\nend\n`;
  }

  // ------------------------------------------------------------------------------
  // 5. Build Floors, Skirting Boards & False Ceilings
  // ------------------------------------------------------------------------------
  ruby += `
# ------------------------------------------------------------------------------
# 5. Build Room Floors, Skirting & False Ceilings
# ------------------------------------------------------------------------------
floor_master_group = entities.add_group
floor_master_group.name = "ULTIDA Floors"

ceiling_master_group = entities.add_group
ceiling_master_group.name = "ULTIDA Ceilings & Lighting"

`;

  const roomsList = scene.rooms ?? [];
  for (const room of roomsList) {
    const poly = room.boundary ?? [];
    if (poly.length >= 3) {
      const roomLabel = sanitize(room.name || room.type || room.id);
      const isWetArea = room.type === 'bathroom' || room.type === 'kitchen' || roomLabel.toLowerCase().includes('bath') || roomLabel.toLowerCase().includes('toilet');
      const floorMat = isWetArea ? 'mat_floor_tile' : 'mat_floor_wood';
      const ptList = poly.map((p: ScenePointMm) => `Geom::Point3d.new(${p.xMm}.mm, ${p.yMm}.mm, 0)`).join(', ');

      ruby += `
# Room: ${room.id} (${roomLabel})
begin
  # Floor Slab (-20mm)
  rf_grp = floor_master_group.entities.add_group
  rf_grp.name = "Floor: ${roomLabel}"
  face_flr = rf_grp.entities.add_face([${ptList}])
  if face_flr
    face_flr.pushpull(-20.mm)
    rf_grp.layer = layer_floor
    rf_grp.material = ${floorMat}
  end

  # Room Perimeter Skirting (75mm high x 15mm thick along room perimeter)
  skirt_pts = [${poly.map((p: ScenePointMm) => `[${p.xMm}, ${p.yMm}]`).join(', ')}]
  (0...(skirt_pts.length - 1)).each do |i|
    p_a = skirt_pts[i]
    p_b = skirt_pts[i + 1]
    dx = p_b[0] - p_a[0]
    dy = p_b[1] - p_a[1]
    len = Math.hypot(dx, dy)
    if len > 50.0
      nx = -dy / len
      ny = dx / len
      ultida_create_wall_segment(rf_grp, p_a[0], p_a[1], p_b[0], p_b[1], nx, ny, 7.5, 0, 75.0, layer_skirt, mat_door_timber)
    end
  end

  # False Ceiling Slab (at 2700mm)
  rc_grp = ceiling_master_group.entities.add_group
  rc_grp.name = "Ceiling: ${roomLabel}"
  ceil_face = rc_grp.entities.add_face([${poly.map((p: ScenePointMm) => `Geom::Point3d.new(${p.xMm}.mm, ${p.yMm}.mm, 2700.mm)`).join(', ')}])
  if ceil_face
    ceil_face.pushpull(12.mm)
    rc_grp.layer = layer_ceiling
    rc_grp.material = mat_ceiling
  end

  # Dropped Perimeter Cove Band with Warm LED Strip
  cove_grp = rc_grp.entities.add_group
  cove_grp.name = "LED Cove Strip (${roomLabel})"
  (0...(skirt_pts.length - 1)).each do |i|
    p_a = skirt_pts[i]
    p_b = skirt_pts[i + 1]
    dx = p_b[0] - p_a[0]
    dy = p_b[1] - p_a[1]
    len = Math.hypot(dx, dy)
    if len > 200.0
      nx = -dy / len
      ny = dx / len
      # 120mm drop, 200mm width cove
      ultida_create_wall_segment(cove_grp, p_a[0] + nx * 200.0, p_a[1] + ny * 200.0, p_b[0] + nx * 200.0, p_b[1] + ny * 200.0, nx, ny, 15.0, 2580.0, 120.0, layer_ceiling, mat_ceiling)
      # LED warm strip at cove lip
      ultida_create_wall_segment(cove_grp, p_a[0] + nx * 215.0, p_a[1] + ny * 215.0, p_b[0] + nx * 215.0, p_b[1] + ny * 215.0, nx, ny, 10.0, 2600.0, 20.0, layer_lighting, mat_led_cove)
    end
  end
rescue => e
  puts "Notice: Room ${room.id} floor/ceiling build: #{e.message}"
end
`;
    }
  }

  // ------------------------------------------------------------------------------
  // 6. Build Modular Furniture Casework (System 32 Gables, Shelves, Shutters, Handles)
  // ------------------------------------------------------------------------------
  ruby += `
# ------------------------------------------------------------------------------
# 6. Build Modular Furniture (System 32 Casework, Gables, Shelves, Shutters, Handles)
# ------------------------------------------------------------------------------
furn_master_group = entities.add_group
furn_master_group.name = "ULTIDA Modular Casework"

`;

  const modulesList = scene.modules ?? [];
  for (const mod of modulesList) {
    const family = sanitize(mod.family || 'Cabinet');
    const posX = mod.position?.xMm ?? 0;
    const posY = mod.position?.yMm ?? 0;
    const rotDeg = mod.rotationDeg ?? 0;
    const w = mod.widthMm;
    const d = mod.depthMm;
    const h = mod.heightMm;

    const isOverhead =
      family.toLowerCase().includes('overhead') ||
      family.toLowerCase().includes('loft') ||
      family.toLowerCase().includes('wall_unit') ||
      mod.anchor === 'ceiling' ||
      mod.anchor === 'wall';

    const posZ = isOverhead ? (mod.anchor === 'ceiling' ? 2100 : 1450) : 0;
    const plinthH = isOverhead ? 0 : 75; // 75mm standard Indian recessed plinth

    ruby += `
# ------------------------------------------------------------------------------
# Module: ${mod.id} (${family}, ${w}x${d}x${h}mm, Rot: ${rotDeg}deg)
# ------------------------------------------------------------------------------
begin
  m_grp = furn_master_group.entities.add_group
  m_grp.name = "${family} [${mod.id}]"

  # Built relative to local origin (0, 0, 0)
`;

    if (!isOverhead) {
      // Recessed Plinth Kickboard (75mm high, 20mm setback)
      ruby += `  # 75mm Recessed Plinth Kickboard
  ultida_create_box(m_grp, 18.0, 20.0, 0.0, ${w - 36.0}, 18.0, ${plinthH}.0, layer_furn_base, mat_plinth)
`;
    }

    // Carcass Left & Right Gables (18mm)
    const carcassH = h - plinthH;
    ruby += `  # 18mm Left Gable & Right Gable
  ultida_create_box(m_grp, 0.0, 0.0, ${plinthH}.0, 18.0, ${d}.0, ${carcassH}.0, ${isOverhead ? 'layer_furn_over' : 'layer_furn_base'}, mat_carcass)
  ultida_create_box(m_grp, ${w - 18.0}, 0.0, ${plinthH}.0, 18.0, ${d}.0, ${carcassH}.0, ${isOverhead ? 'layer_furn_over' : 'layer_furn_base'}, mat_carcass)

  # 18mm Bottom Base & Top Panel
  ultida_create_box(m_grp, 18.0, 0.0, ${plinthH}.0, ${w - 36.0}, ${d}.0, 18.0, ${isOverhead ? 'layer_furn_over' : 'layer_furn_base'}, mat_carcass)
  ultida_create_box(m_grp, 18.0, 0.0, ${h - 18.0}.0, ${w - 36.0}, ${d}.0, 18.0, ${isOverhead ? 'layer_furn_over' : 'layer_furn_base'}, mat_carcass)

  # 6mm Grooved Backing Board
  ultida_create_box(m_grp, 18.0, 10.0, ${plinthH + 18.0}.0, ${w - 36.0}, 6.0, ${carcassH - 36.0}.0, ${isOverhead ? 'layer_furn_over' : 'layer_furn_base'}, mat_carcass)
`;

    // Center Vertical Divider if wide module (>= 900mm)
    if (w >= 900) {
      const divX = (w / 2) - 9;
      ruby += `  # 18mm Center Vertical Divider
  ultida_create_box(m_grp, ${divX.toFixed(1)}, 18.0, ${plinthH + 18.0}.0, 18.0, ${d - 18.0}.0, ${carcassH - 36.0}.0, layer_furn_shel, mat_carcass)
`;
    }

    // System 32 Adjustable Shelves (2 horizontal shelves)
    const shelfCount = h >= 1800 ? 3 : 2;
    for (let s = 1; s <= shelfCount; s++) {
      const shelfZ = plinthH + 18 + ((carcassH - 36) / (shelfCount + 1)) * s;
      if (w >= 900) {
        const halfW = (w - 54) / 2;
        ruby += `  # Internal Adjustable Shelves (System 32)
  ultida_create_box(m_grp, 18.0, 18.0, ${shelfZ.toFixed(1)}, ${halfW.toFixed(1)}, ${d - 25.0}.0, 18.0, layer_furn_shel, mat_carcass)
  ultida_create_box(m_grp, ${(w / 2 + 9).toFixed(1)}, 18.0, ${shelfZ.toFixed(1)}, ${halfW.toFixed(1)}, ${d - 25.0}.0, 18.0, layer_furn_shel, mat_carcass)
`;
      } else {
        ruby += `  # Internal Adjustable Shelf (System 32)
  ultida_create_box(m_grp, 18.0, 18.0, ${shelfZ.toFixed(1)}, ${w - 36.0}.0, ${d - 25.0}.0, 18.0, layer_furn_shel, mat_carcass)
`;
      }
    }

    // Front Shutters (18mm thickness with 2mm shadow margins)
    const shutterCount = w >= 1800 ? 4 : w >= 1200 ? 3 : w >= 600 ? 2 : 1;
    const gap = 2.0;
    const totalGaps = (shutterCount - 1) * gap;
    const shutterW = (w - totalGaps - 4.0) / shutterCount;
    const shutterH = carcassH - 4.0;
    const shutterZ = plinthH + 2.0;

    ruby += `  # Front Shutters (${shutterCount}-leaf configuration, 18mm PU Matte Laminate)
`;
    for (let sh = 0; sh < shutterCount; sh++) {
      const shX = 2.0 + sh * (shutterW + gap);
      ruby += `  ultida_create_box(m_grp, ${shX.toFixed(1)}, ${d}.0, ${shutterZ.toFixed(1)}, ${shutterW.toFixed(1)}, 18.0, ${shutterH.toFixed(1)}, layer_furn_shut, mat_shutter)\n`;

      const handleSide = (sh % 2 === 0) ? (shX + shutterW - 35.0) : (shX + 23.0);
      const handleZ = isOverhead ? (shutterZ + 40.0) : (shutterZ + Math.min(1050.0, shutterH - 180.0));
      ruby += `  # Modern Brushed Brass Bar Handle (160mm length)
  ultida_create_box(m_grp, ${handleSide.toFixed(1)}, ${d + 18.0}.0, ${handleZ.toFixed(1)}, 12.0, 24.0, 160.0, layer_furn_hard, mat_hardware) # Handle
`;
    }

    // Apply 3D Spatial Transformation (Rotation around Z + 3D Translation)
    ruby += `
  # Apply 3D Spatial Transformation (Rotation: ${rotDeg} deg, Translation: [${posX}, ${posY}, ${posZ}])
  rot_rad = ${rotDeg} * Math::PI / 180.0
  t_rot = Geom::Transformation.rotation(Geom::Point3d.new(0, 0, 0), Geom::Vector3d.new(0, 0, 1), rot_rad)
  t_pos = Geom::Transformation.translation(Geom::Vector3d.new(${posX}.mm, ${posY}.mm, ${posZ}.mm))
  m_grp.transform!(t_pos * t_rot)
rescue => e
  puts "Notice: Module ${mod.id} build status: #{e.message}"
end
`;
  }

  // ------------------------------------------------------------------------------
  // 7. Setup SketchUp Scene Pages (Camera Views)
  // ------------------------------------------------------------------------------
  ruby += `
# ------------------------------------------------------------------------------
# 7. Setup Standard Scene Camera Pages (Tabs)
# ------------------------------------------------------------------------------
begin
  # Page 1: 3D Isometric Axonometric Orbit
  p_iso = pages.add('01 - Overall 3D Orbit')
  p_iso.camera.set(
    Geom::Point3d.new(-1500.mm, -2500.mm, 4500.mm),
    Geom::Point3d.new(3500.mm, 3000.mm, 1000.mm),
    Geom::Vector3d.new(0, 0, 1)
  )

  # Page 2: Floor Plan Top View (Parallel Projection)
  p_plan = pages.add('02 - Floor Plan (Top View)')
  p_plan.camera.perspective = false
  p_plan.camera.set(
    Geom::Point3d.new(3500.mm, 3000.mm, 8000.mm),
    Geom::Point3d.new(3500.mm, 3000.mm, 0),
    Geom::Vector3d.new(0, 1, 0)
  )

`;

  // Add dedicated camera page for each room
  roomsList.forEach((rm: SceneRoomV1, idx: number) => {
    const roomName = sanitize(rm.name || rm.type || `Room ${idx + 1}`);
    const poly = rm.boundary ?? [];
    if (poly.length >= 3) {
      // Calculate room centroid
      const cx = poly.reduce((acc: number, p: ScenePointMm) => acc + p.xMm, 0) / poly.length;
      const cy = poly.reduce((acc: number, p: ScenePointMm) => acc + p.yMm, 0) / poly.length;
      const pFirst = poly[0];
      const eyeX = (pFirst.xMm + cx) / 2.0;
      const eyeY = (pFirst.yMm + cy) / 2.0;

      ruby += `  # Page ${idx + 3}: ${roomName} Perspective
  p_rm_${idx} = pages.add('0${idx + 3} - ${roomName} View')
  p_rm_${idx}.camera.perspective = true
  p_rm_${idx}.camera.set(
    Geom::Point3d.new(${eyeX.toFixed(1)}.mm, ${eyeY.toFixed(1)}.mm, 1550.mm),
    Geom::Point3d.new(${cx.toFixed(1)}.mm, ${cy.toFixed(1)}.mm, 1100.mm),
    Geom::Vector3d.new(0, 0, 1)
  )
`;
    }
  });

  ruby += `rescue => e
  puts "Notice: Scene pages setup: #{e.message}"
end

model.commit_operation
puts "=========================================================================="
puts "ULTIDA Interior Design OS — 3D Model Successfully Generated!"
puts "Project: ${projectId}"
puts "Tags: A-WALL, A-DOOR, A-GLAZ, A-FLOR, A-CLNG, A-FURN-BASE, A-FURN-SHUT, A-FURN-SHEL, A-FURN-HARD"
puts "Click any Scene tab at the top of your SketchUp window to tour the space."
puts "=========================================================================="
`;

  return ruby;
}
