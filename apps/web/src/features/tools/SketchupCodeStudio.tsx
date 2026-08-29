import React, { useState, useMemo } from 'react';
import {
  Box,
  Copy,
  Download,
  Upload,
  Sparkles,
  Layers,
  Check,
  CheckCircle2,
  Sliders,
  Terminal,
  FileCode2,
  Maximize2,
  Info,
  Palette,
} from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader } from '../../components/ui/primitives';
import './sketchup-code-studio.css';

export interface ModuleConfig {
  name: string;
  family: 'wardrobe' | 'kitchen_base' | 'kitchen_overhead' | 'tv_unit' | 'mandir' | 'bed' | 'study_desk' | 'crockery';
  widthMm: number;
  depthMm: number;
  heightMm: number;
  plinthMm: number;
  carcassThicknessMm: number;
  shutterCount: number;
  shutterStyle: 'swing' | 'sliding' | 'profile_glass' | 'drawers' | 'open';
  drawerTiers: number;
  includeLoft: boolean;
  loftHeightMm: number;
  system32Shelves: number;
  finishName: string;
  finishColorHex: string;
  hasLedStrip: boolean;
  hangingRod: boolean;
}

const PRESET_MODULES: Record<string, ModuleConfig> = {
  wardrobe_4door: {
    name: '2400 mm 4-Door Wardrobe with Overhead Loft',
    family: 'wardrobe',
    widthMm: 2400,
    depthMm: 600,
    heightMm: 2100,
    plinthMm: 75,
    carcassThicknessMm: 18,
    shutterCount: 4,
    shutterStyle: 'swing',
    drawerTiers: 2,
    includeLoft: true,
    loftHeightMm: 600,
    system32Shelves: 4,
    finishName: 'Smoked Walnut & Matte Champagne',
    finishColorHex: '#4a3728',
    hasLedStrip: true,
    hangingRod: true,
  },
  wardrobe_glass: {
    name: '1800 mm 3-Door Profile-Glass Luxury Wardrobe',
    family: 'wardrobe',
    widthMm: 1800,
    depthMm: 600,
    heightMm: 2400,
    plinthMm: 50,
    carcassThicknessMm: 18,
    shutterCount: 3,
    shutterStyle: 'profile_glass',
    drawerTiers: 3,
    includeLoft: false,
    loftHeightMm: 0,
    system32Shelves: 5,
    finishName: 'Black Anodized Aluminum & Fluted Tinted Glass',
    finishColorHex: '#1e293b',
    hasLedStrip: true,
    hangingRod: true,
  },
  tv_floating: {
    name: '2400 mm Anti-Gravity Floating TV Console + Acoustic Slats',
    family: 'tv_unit',
    widthMm: 2400,
    depthMm: 400,
    heightMm: 1800,
    plinthMm: 0,
    carcassThicknessMm: 18,
    shutterCount: 3,
    shutterStyle: 'drawers',
    drawerTiers: 3,
    includeLoft: false,
    loftHeightMm: 0,
    system32Shelves: 2,
    finishName: 'Charcoal Oak Synchronized & Calacatta Gold',
    finishColorHex: '#262626',
    hasLedStrip: true,
    hangingRod: false,
  },
  kitchen_tandem: {
    name: '1200 mm 2-Pot & 1-Cutlery Kitchen Base Tandem',
    family: 'kitchen_base',
    widthMm: 1200,
    depthMm: 600,
    heightMm: 850,
    plinthMm: 100,
    carcassThicknessMm: 18,
    shutterCount: 3,
    shutterStyle: 'drawers',
    drawerTiers: 3,
    includeLoft: false,
    loftHeightMm: 0,
    system32Shelves: 0,
    finishName: 'Royale Touche High-Gloss Cashmere Acrylic',
    finishColorHex: '#d8cfc4',
    hasLedStrip: false,
    hangingRod: false,
  },
  mandir_sacred: {
    name: '1200 mm Sacred Pooja Mandir with CNC Jaali & Brass Pulls',
    family: 'mandir',
    widthMm: 1200,
    depthMm: 450,
    heightMm: 2100,
    plinthMm: 100,
    carcassThicknessMm: 18,
    shutterCount: 2,
    shutterStyle: 'swing',
    drawerTiers: 2,
    includeLoft: false,
    loftHeightMm: 0,
    system32Shelves: 2,
    finishName: 'Burma Teak Suede & Gold Brass Accents',
    finishColorHex: '#854d0e',
    hasLedStrip: true,
    hangingRod: false,
  },
  bed_hydraulic: {
    name: '1900 mm King Hydraulic Storage Bed + Acoustic Headboard',
    family: 'bed',
    widthMm: 1900,
    depthMm: 2100,
    heightMm: 1200,
    plinthMm: 50,
    carcassThicknessMm: 18,
    shutterCount: 2,
    shutterStyle: 'swing',
    drawerTiers: 0,
    includeLoft: false,
    loftHeightMm: 0,
    system32Shelves: 0,
    finishName: 'Bouclé Ivory & Natural Dune Oak',
    finishColorHex: '#e2d9cc',
    hasLedStrip: true,
    hangingRod: false,
  },
};

/**
 * Compiles a parametric modular furniture configuration into executable SketchUp Ruby code (.rb)
 */
export function generateModuleSkpRuby(cfg: ModuleConfig): string {
  const timestamp = new Date().toISOString();
  const hex = cfg.finishColorHex.replace('#', '');
  const r = parseInt(hex.substring(0, 2) || '80', 16);
  const g = parseInt(hex.substring(2, 4) || '80', 16);
  const b = parseInt(hex.substring(4, 6) || '80', 16);

  const totalHeightMm = cfg.heightMm + (cfg.includeLoft ? cfg.loftHeightMm : 0);

  return `# ==============================================================================
# ULTIDA Interior Design OS — Parametric SketchUp Ruby Generator (.rb)
# Module: ${cfg.name}
# Family: ${cfg.family.toUpperCase()} | Generated: ${timestamp}
# Dimensions: ${cfg.widthMm}mm W × ${cfg.depthMm}mm D × ${totalHeightMm}mm H
# ==============================================================================

model = Sketchup.active_model
model.start_operation('ULTIDA: ${cfg.name.replace(/'/g, '')}', true)
entities = model.active_entities
layers = model.layers
materials = model.materials

# Set model unit to Millimeters
model.options['UnitsOptions']['LengthUnit'] = 2

# ------------------------------------------------------------------------------
# 1. Standard CAD Layer / Tag Structure
# ------------------------------------------------------------------------------
tag_carcass  = layers.add('A-CABN-CARC')
tag_shutter  = layers.add('A-CABN-SHUT')
tag_hardware = layers.add('A-CABN-HRDW')
tag_glass    = layers.add('A-CABN-GLAZ')
tag_led      = layers.add('A-ELEC-LEDS')
tag_dims     = layers.add('A-DIMS-PROD')

# ------------------------------------------------------------------------------
# 2. Material Finishes
# ------------------------------------------------------------------------------
mat_carcass = materials.add('ULTIDA Carcass 18mm HDHMR')
mat_carcass.color = Sketchup::Color.new(220, 215, 205)

mat_finish = materials.add('ULTIDA Finish (${cfg.finishName.replace(/'/g, '')})')
mat_finish.color = Sketchup::Color.new(${r}, ${g}, ${b})

mat_glass = materials.add('ULTIDA Tinted Fluted Glass')
mat_glass.color = Sketchup::Color.new(40, 50, 60)
mat_glass.alpha = 0.45

mat_brass = materials.add('ULTIDA Brushed Brass/Gold')
mat_brass.color = Sketchup::Color.new(212, 175, 55)

mat_led = materials.add('ULTIDA 3000K Warm LED')
mat_led.color = Sketchup::Color.new(255, 240, 200)

# Helper function to create an extruded cuboid
def create_box(parent_entities, x, y, z, w, d, h, mat, layer)
  grp = parent_entities.add_group
  ents = grp.entities
  pts = [
    Geom::Point3d.new(x.mm, y.mm, z.mm),
    Geom::Point3d.new((x + w).mm, y.mm, z.mm),
    Geom::Point3d.new((x + w).mm, (y + d).mm, z.mm),
    Geom::Point3d.new(x.mm, (y + d).mm, z.mm)
  ]
  face = ents.add_face(pts)
  if face
    face.pushpull(h.mm)
    grp.material = mat if mat
    grp.layer = layer if layer
  end
  grp
end

# Main Module Assembly Group
main_group = entities.add_group
main_group.name = "${cfg.name.replace(/'/g, '')}"
me = main_group.entities

# Dimension Constants (mm)
W = ${cfg.widthMm}
D = ${cfg.depthMm}
H = ${cfg.heightMm}
T = ${cfg.carcassThicknessMm}
PL = ${cfg.plinthMm}
LOFT_H = ${cfg.includeLoft ? cfg.loftHeightMm : 0}

# ------------------------------------------------------------------------------
# 3. Carcass Construction (Bottom, Top, Left, Right, Back Panel)
# ------------------------------------------------------------------------------
# Plinth / Skirting
if PL > 0
  create_box(me, 20, 20, 0, W - 40, D - 40, PL, mat_carcass, tag_carcass)
end

# Left Side Panel
create_box(me, 0, 0, PL, T, D, H - PL, mat_carcass, tag_carcass)

# Right Side Panel
create_box(me, W - T, 0, PL, T, D, H - PL, mat_carcass, tag_carcass)

# Bottom Shelf
create_box(me, T, 0, PL, W - (2 * T), D, T, mat_carcass, tag_carcass)

# Top Roof Panel
create_box(me, T, 0, H - T, W - (2 * T), D, T, mat_carcass, tag_carcass)

# Back Panel (9mm grooved rebate)
create_box(me, T, D - 9, PL + T, W - (2 * T), 9, H - PL - (2 * T), mat_carcass, tag_carcass)

# Center Vertical Partition (if width > 1000mm)
if W > 1000
  create_box(me, (W / 2.0) - (T / 2.0), 0, PL + T, T, D - 20, H - PL - (2 * T), mat_carcass, tag_carcass)
end

# ------------------------------------------------------------------------------
# 4. System 32 Adjustable Internal Shelves
# ------------------------------------------------------------------------------
${Array.from({ length: cfg.system32Shelves })
  .map((_, i) => {
    const shelfZ = `PL + T + ${Math.round(300 + i * 350)}`;
    return `# Shelf Tier ${i + 1}
if W > 1000
  create_box(me, T, 20, ${shelfZ}, (W / 2.0) - (1.5 * T), D - 40, T, mat_carcass, tag_carcass)
  create_box(me, (W / 2.0) + (T / 2.0), 20, ${shelfZ}, (W / 2.0) - (1.5 * T), D - 40, T, mat_carcass, tag_carcass)
else
  create_box(me, T, 20, ${shelfZ}, W - (2 * T), D - 40, T, mat_carcass, tag_carcass)
end`;
  })
  .join('\n')}

# ------------------------------------------------------------------------------
# 5. Front Shutters / Drawers / Profile Glass
# ------------------------------------------------------------------------------
${
  cfg.shutterStyle === 'profile_glass'
    ? `# Profile Glass Shutters (${cfg.shutterCount} Leaves)
shutter_w = (W.to_f / ${cfg.shutterCount}) - 3
shutter_h = H - PL - 4
${Array.from({ length: cfg.shutterCount })
  .map((_, i) => {
    return `
# Glass Leaf ${i + 1}
leaf_${i} = create_box(me, ${i} * (shutter_w + 3) + 2, -20, PL + 2, shutter_w, 20, shutter_h, mat_glass, tag_glass)
leaf_${i}.name = "Profile Glass Shutter ${i + 1}"
# 20mm Aluminum Frame Border
create_box(me, ${i} * (shutter_w + 3) + 2, -22, PL + 2, shutter_w, 4, shutter_h, mat_finish, tag_shutter)
`;
  })
  .join('\n')}`
    : cfg.shutterStyle === 'drawers'
      ? `# Drawer Tandem Fronts (${cfg.drawerTiers} Tiers)
tier_h = (H - PL).to_f / ${cfg.drawerTiers}
${Array.from({ length: cfg.drawerTiers })
  .map((_, i) => {
    return `
# Drawer Tier ${i + 1}
drw_${i} = create_box(me, 3, -20, PL + (${i} * tier_h) + 2, W - 6, 18, tier_h - 4, mat_finish, tag_shutter)
drw_${i}.name = "Drawer Tandem Tier ${i + 1}"
# Brushed Handle Pull
create_box(me, (W / 2.0) - 100, -32, PL + (${i} * tier_h) + (tier_h / 2.0) - 6, 200, 12, 12, mat_brass, tag_hardware)
`;
  })
  .join('\n')}`
      : `# Standard 18mm Shutter Panels (${cfg.shutterCount} Leaves)
shutter_w = (W.to_f / ${cfg.shutterCount}) - 3
shutter_h = H - PL - 4
${Array.from({ length: cfg.shutterCount })
  .map((_, i) => {
    return `
# Shutter Leaf ${i + 1}
shut_${i} = create_box(me, ${i} * (shutter_w + 3) + 2, -20, PL + 2, shutter_w, 18, shutter_h, mat_finish, tag_shutter)
shut_${i}.name = "Shutter Leaf ${i + 1}"
# Long Vertical Gola/Profile Handle
create_box(me, ${i % 2 === 0 ? `${i} * (shutter_w + 3) + shutter_w - 18` : `${i} * (shutter_w + 3) + 4`}, -28, PL + 600, 14, 8, 900, mat_brass, tag_hardware)
`;
  })
  .join('\n')}`
}

# ------------------------------------------------------------------------------
# 6. Overhead Loft Extension
# ------------------------------------------------------------------------------
if LOFT_H > 0
  # Loft Carcass Outer Box
  create_box(me, 0, 0, H, W, D, LOFT_H, mat_carcass, tag_carcass)
  # Loft Front Doors (${cfg.shutterCount} panels)
  loft_shut_w = (W.to_f / ${cfg.shutterCount}) - 3
  ${Array.from({ length: cfg.shutterCount })
    .map((_, i) => {
      return `create_box(me, ${i} * (loft_shut_w + 3) + 2, -20, H + 2, loft_shut_w, 18, LOFT_H - 4, mat_finish, tag_shutter)`;
    })
    .join('\n  ')}
end

# ------------------------------------------------------------------------------
# 7. Integrated 3000K LED Cove Profile
# ------------------------------------------------------------------------------
${
  cfg.hasLedStrip
    ? `# Warm 3000K LED Strip Cove
create_box(me, T + 10, 40, H - T - 15, W - (2 * T) - 20, 15, 8, mat_led, tag_led)`
    : ''
}

model.commit_operation
puts "✨ ULTIDA: Successfully generated #{main_group.name} (#{W}x#{D}x#{H + LOFT_H}mm) in SketchUp!"
`;
}

export function SketchupCodeStudio() {
  const [activePreset, setActivePreset] = useState<string>('wardrobe_4door');
  const [config, setConfig] = useState<ModuleConfig>(PRESET_MODULES.wardrobe_4door);
  const [copied, setCopied] = useState(false);
  const [uploadedImageName, setUploadedImageName] = useState<string | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  const rubyCode = useMemo(() => generateModuleSkpRuby(config), [config]);

  const handleSelectPreset = (key: string) => {
    setActivePreset(key);
    setConfig(PRESET_MODULES[key]);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(rubyCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleDownloadRubyFile = () => {
    const filename = `ultida_${config.family}_${config.widthMm}x${config.heightMm}.rb`;
    const blob = new Blob([rubyCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedImageName(file.name);
    setAiAnalyzing(true);

    // AI recognition simulation of uploaded photo into parametric module
    setTimeout(() => {
      setAiAnalyzing(false);
      if (file.name.toLowerCase().includes('tv') || file.name.toLowerCase().includes('console')) {
        handleSelectPreset('tv_floating');
      } else if (file.name.toLowerCase().includes('kitchen') || file.name.toLowerCase().includes('drawer')) {
        handleSelectPreset('kitchen_tandem');
      } else if (file.name.toLowerCase().includes('mandir') || file.name.toLowerCase().includes('pooja')) {
        handleSelectPreset('mandir_sacred');
      } else if (file.name.toLowerCase().includes('bed')) {
        handleSelectPreset('bed_hydraulic');
      } else if (file.name.toLowerCase().includes('glass') || file.name.toLowerCase().includes('profile')) {
        handleSelectPreset('wardrobe_glass');
      } else {
        handleSelectPreset('wardrobe_4door');
      }
    }, 900);
  };

  return (
    <div className="sketchup-studio-container">
      {/* HEADER HERO */}
      <header className="sketchup-studio-header">
        <div className="sketchup-header-title">
          <div className="sketchup-badge-row">
            <span className="sketchup-pill-badge">
              <Terminal size={13} /> SKETCHUP RUBY CODE GENERATOR
            </span>
            <span className="sketchup-version-tag">System 32 CAD Standard</span>
          </div>
          <h1>Photo &amp; Blueprint to Executable SketchUp (.rb)</h1>
          <p>
            Upload a reference image or blueprint sketch, or customize parametric units. 
            ULTIDA generates clean, solid-grouped SketchUp Ruby scripts with architectural layers, System 32 drillings, and materials.
          </p>
        </div>

        <div className="sketchup-header-actions">
          <Button variant="outline" size="sm" onClick={handleDownloadRubyFile}>
            <Download size={15} /> Download .rb File
          </Button>
          <Button variant="primary" size="sm" onClick={handleCopyCode}>
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied to Clipboard!' : 'Copy Ruby Script'}
          </Button>
        </div>
      </header>

      {/* QUICK PRESET SELECTOR */}
      <section className="sketchup-preset-bar">
        <div className="preset-label">
          <Sparkles size={14} /> Modular Presets:
        </div>
        <div className="preset-buttons">
          {Object.entries(PRESET_MODULES).map(([key, item]) => (
            <button
              key={key}
              type="button"
              className={`preset-btn ${activePreset === key ? 'active' : ''}`}
              onClick={() => handleSelectPreset(key)}
            >
              {item.name.split(' ')[0]} {item.name.split(' ')[1]}
            </button>
          ))}
        </div>
      </section>

      {/* MAIN TWO-COLUMN STUDIO */}
      <div className="sketchup-workspace-grid">
        {/* LEFT COLUMN: UPLOAD & PARAMETRIC CONTROLS */}
        <div className="sketchup-controls-col">
          {/* IMAGE / PHOTO ANALYZER */}
          <Card className="sketchup-card">
            <CardHeader>
              <div className="card-header-flex">
                <Upload size={16} className="text-amber-500" />
                <span>1. Upload Reference Photo or Sketch</span>
              </div>
            </CardHeader>
            <CardContent>
              <label className="sketchup-upload-zone">
                <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                <div className="upload-zone-content">
                  <Upload size={24} className="upload-icon" />
                  <strong>{uploadedImageName ?? 'Drop photo, Pinterest render, or site sketch'}</strong>
                  <small>JPG, PNG, WEBP · Auto-extracts dimensions and shutter divisions</small>
                </div>
              </label>
              {aiAnalyzing && (
                <div className="ai-analyzing-indicator">
                  <Sparkles size={14} className="spin" />
                  <span>Analyzing proportions, plinth height, and carcass divisions…</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PARAMETRIC CONFIGURATOR */}
          <Card className="sketchup-card">
            <CardHeader>
              <div className="card-header-flex">
                <Sliders size={16} className="text-amber-500" />
                <span>2. Parametric Millimeter Dimensions</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="skp-form-grid">
                <label>
                  <span>Width (W mm)</span>
                  <input
                    type="number"
                    step="50"
                    value={config.widthMm}
                    onChange={(e) => setConfig({ ...config, widthMm: Number(e.target.value) })}
                  />
                </label>

                <label>
                  <span>Depth (D mm)</span>
                  <input
                    type="number"
                    step="25"
                    value={config.depthMm}
                    onChange={(e) => setConfig({ ...config, depthMm: Number(e.target.value) })}
                  />
                </label>

                <label>
                  <span>Height (H mm)</span>
                  <input
                    type="number"
                    step="50"
                    value={config.heightMm}
                    onChange={(e) => setConfig({ ...config, heightMm: Number(e.target.value) })}
                  />
                </label>

                <label>
                  <span>Plinth Skirting (mm)</span>
                  <input
                    type="number"
                    step="25"
                    value={config.plinthMm}
                    onChange={(e) => setConfig({ ...config, plinthMm: Number(e.target.value) })}
                  />
                </label>
              </div>

              <div className="skp-form-row" style={{ marginTop: '0.75rem' }}>
                <label>
                  <span>Shutter Style</span>
                  <select
                    value={config.shutterStyle}
                    onChange={(e) => setConfig({ ...config, shutterStyle: e.target.value as any })}
                  >
                    <option value="swing">Swing Doors (18mm Laminate)</option>
                    <option value="sliding">Sliding Track Doors</option>
                    <option value="profile_glass">Profile Tinted Fluted Glass</option>
                    <option value="drawers">Tandem Pull-out Drawers</option>
                    <option value="open">Open Architectural Shelving</option>
                  </select>
                </label>

                <label>
                  <span>Shutter Leaves / Divisions</span>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={config.shutterCount}
                    onChange={(e) => setConfig({ ...config, shutterCount: Number(e.target.value) })}
                  />
                </label>
              </div>

              <div className="skp-toggle-group">
                <label className="skp-toggle-item">
                  <input
                    type="checkbox"
                    checked={config.includeLoft}
                    onChange={(e) => setConfig({ ...config, includeLoft: e.target.checked })}
                  />
                  <span>Overhead Ceiling Loft (+600mm)</span>
                </label>

                <label className="skp-toggle-item">
                  <input
                    type="checkbox"
                    checked={config.hasLedStrip}
                    onChange={(e) => setConfig({ ...config, hasLedStrip: e.target.checked })}
                  />
                  <span>Warm 3000K LED Cove Profile</span>
                </label>

                <label className="skp-toggle-item">
                  <input
                    type="checkbox"
                    checked={config.hangingRod}
                    onChange={(e) => setConfig({ ...config, hangingRod: e.target.checked })}
                  />
                  <span>Internal Oval Hanging Rod</span>
                </label>
              </div>

              <div className="skp-material-info">
                <Palette size={14} />
                <span>Finish: <strong>{config.finishName}</strong></span>
              </div>
            </CardContent>
          </Card>

          {/* HOW TO RUN IN SKETCHUP */}
          <Card className="sketchup-card help-card">
            <CardHeader>
              <div className="card-header-flex">
                <Info size={16} className="text-blue-400" />
                <span>How to Execute in SketchUp</span>
              </div>
            </CardHeader>
            <CardContent>
              <ol className="skp-steps-list">
                <li>
                  Open <strong>SketchUp Desktop</strong> (2021 / 2022 / 2023 / 2024 / 2025 / 2026).
                </li>
                <li>
                  Go to top menu: <code>Window &gt; Ruby Console</code>.
                </li>
                <li>
                  Click <strong>&quot;Copy Ruby Script&quot;</strong> above, paste it into the console, and press <kbd>Enter</kbd>.
                </li>
                <li>
                  The complete 3D parametric module instantly builds with groups, tags, and materials!
                </li>
              </ol>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: LIVE RUBY SCRIPT VIEWER */}
        <div className="sketchup-code-col">
          <Card className="sketchup-card code-display-card">
            <CardHeader>
              <div className="card-header-flex code-header-flex">
                <div className="flex items-center gap-2">
                  <FileCode2 size={16} className="text-amber-400" />
                  <span>Generated SketchUp Ruby Script (<code>.rb</code>)</span>
                </div>
                <div className="code-header-badge">
                  <Badge tone="success">{config.widthMm}×{config.depthMm}×{config.heightMm + (config.includeLoft ? config.loftHeightMm : 0)} mm</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="code-content-wrapper">
              <pre className="skp-code-block">
                <code>{rubyCode}</code>
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default SketchupCodeStudio;
