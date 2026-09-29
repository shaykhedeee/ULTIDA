// ═══════════════════════════════════════════════════════════════════════════════
// ULTIDA CNC JAALI & SACRED POOJA MOTIFS GENERATOR
// Machine-ready 2D CAD vectors, live SVG previews, and AutoCAD DXF exports
// ═══════════════════════════════════════════════════════════════════════════════

export type JaaliPattern =
  | 'diamond'
  | 'arch'
  | 'circle'
  | 'om'
  | 'floral'
  | 'ganesha'
  | 'bells'
  | 'lotus'
  | 'moroccan_star'
  | 'chevron';

export interface JaaliPatternMeta {
  id: JaaliPattern;
  name: string;
  category: 'sacred' | 'geometric' | 'architectural';
  description: string;
  recommendedSpacingMm: number;
}

export const JAALI_PATTERNS: Record<JaaliPattern, JaaliPatternMeta> = {
  ganesha: {
    id: 'ganesha',
    name: 'Lord Ganesha Pooja Jaali',
    category: 'sacred',
    description: 'Sacred Ganesha silhouette with Mukut crown, curved trunk, ears and tilak in temple sanctum arch',
    recommendedSpacingMm: 120,
  },
  bells: {
    id: 'bells',
    name: 'Temple Hanging Brass Bells',
    category: 'sacred',
    description: 'Cascading pooja mandir brass bells with hanging link chains and resonant clappers',
    recommendedSpacingMm: 150,
  },
  om: {
    id: 'om',
    name: 'Sacred Om Medallion',
    category: 'sacred',
    description: 'Centred Vedic Om symbol with chandra-bindu, surrounded by a radiant aureole',
    recommendedSpacingMm: 120,
  },
  lotus: {
    id: 'lotus',
    name: 'Sacred Lotus Mandala',
    category: 'sacred',
    description: 'Multi-tiered 16-petal blooming lotus mandala with central seed pod',
    recommendedSpacingMm: 100,
  },
  moroccan_star: {
    id: 'moroccan_star',
    name: 'Moroccan 8-Point Star',
    category: 'geometric',
    description: 'Interlocking Islamic 8-point geometric star tessellation with connecting fretwork',
    recommendedSpacingMm: 80,
  },
  chevron: {
    id: 'chevron',
    name: 'Modern Chevron Lattice',
    category: 'geometric',
    description: 'Contemporary architectural 45° chevron V-groove herringbone pattern',
    recommendedSpacingMm: 60,
  },
  diamond: {
    id: 'diamond',
    name: 'Diamond Lattice',
    category: 'geometric',
    description: 'Classic diagonal criss-cross diamond jaali panel',
    recommendedSpacingMm: 75,
  },
  arch: {
    id: 'arch',
    name: 'Temple Arch Lattice',
    category: 'architectural',
    description: 'Colonnade of traditional temple arch bays with vertical fluted jambs',
    recommendedSpacingMm: 100,
  },
  circle: {
    id: 'circle',
    name: 'Ventilated Circle Grid',
    category: 'architectural',
    description: 'Evenly spaced circular perforated grill for pooja doors and HVAC ventilation',
    recommendedSpacingMm: 60,
  },
  floral: {
    id: 'floral',
    name: 'Floral Rosette Repeat',
    category: 'geometric',
    description: 'Radial 8-petal rosette medallion array with central blossom core',
    recommendedSpacingMm: 90,
  },
};

// ─── DXF Entity Primitives ──────────────────────────────────────────────────
export function dxfLine(x1: number, y1: number, x2: number, y2: number, layer = 'CUT') {
  return `0\nLINE\n8\n${layer}\n10\n${x1.toFixed(2)}\n20\n${y1.toFixed(2)}\n11\n${x2.toFixed(2)}\n21\n${y2.toFixed(2)}\n`;
}

export function dxfCircle(x: number, y: number, radius: number, layer = 'CUT') {
  return `0\nCIRCLE\n8\n${layer}\n10\n${x.toFixed(2)}\n20\n${y.toFixed(2)}\n40\n${radius.toFixed(2)}\n`;
}

export function dxfArc(x: number, y: number, radius: number, startAngleDeg: number, endAngleDeg: number, layer = 'CUT') {
  return `0\nARC\n8\n${layer}\n10\n${x.toFixed(2)}\n20\n${y.toFixed(2)}\n40\n${radius.toFixed(2)}\n50\n${startAngleDeg.toFixed(2)}\n51\n${endAngleDeg.toFixed(2)}\n`;
}

// ─── Complete AutoCAD DXF Generator for Jaali Panels ─────────────────────────
export function generateJaaliDxf(
  pattern: JaaliPattern,
  width: number,
  height: number,
  spacing: number,
  toolDia = 6
): string {
  // Panel Outer Boundary
  let body =
    dxfLine(0, 0, width, 0, 'A-OUTLINE-BORDER') +
    dxfLine(width, 0, width, height, 'A-OUTLINE-BORDER') +
    dxfLine(width, height, 0, height, 'A-OUTLINE-BORDER') +
    dxfLine(0, height, 0, 0, 'A-OUTLINE-BORDER');

  const cx = width / 2;
  const cy = height / 2;

  switch (pattern) {
    case 'ganesha': {
      // Scale silhouette to fit comfortably inside panel leaving border margins
      const scale = Math.min(width * 0.75, height * 0.8) / 400;
      const gX = cx;
      const gY = cy;

      // Sanctum Arch Frame around Ganesha
      const archRadius = Math.min(width, height) * 0.44;
      body += dxfArc(gX, gY + archRadius * 0.1, archRadius, 0, 180, 'A-CUT-SANCTUM');
      body += dxfLine(gX - archRadius, gY + archRadius * 0.1, gX - archRadius, gY - archRadius * 0.8, 'A-CUT-SANCTUM');
      body += dxfLine(gX + archRadius, gY + archRadius * 0.1, gX + archRadius, gY - archRadius * 0.8, 'A-CUT-SANCTUM');
      body += dxfLine(gX - archRadius, gY - archRadius * 0.8, gX + archRadius, gY - archRadius * 0.8, 'A-CUT-SANCTUM');

      // Mukut (Crown) at Top
      body += dxfLine(gX - 35 * scale, gY + 120 * scale, gX + 35 * scale, gY + 120 * scale, 'A-CUT-GANESHA');
      body += dxfLine(gX - 35 * scale, gY + 120 * scale, gX - 25 * scale, gY + 155 * scale, 'A-CUT-GANESHA');
      body += dxfLine(gX + 35 * scale, gY + 120 * scale, gX + 25 * scale, gY + 155 * scale, 'A-CUT-GANESHA');
      body += dxfLine(gX - 25 * scale, gY + 155 * scale, gX + 25 * scale, gY + 155 * scale, 'A-CUT-GANESHA');
      body += dxfLine(gX - 18 * scale, gY + 155 * scale, gX, gY + 185 * scale, 'A-CUT-GANESHA');
      body += dxfLine(gX + 18 * scale, gY + 155 * scale, gX, gY + 185 * scale, 'A-CUT-GANESHA');
      body += dxfCircle(gX, gY + 195 * scale, 6 * scale, 'A-CUT-GANESHA');

      // Left Large Ear
      body += dxfArc(gX - 70 * scale, gY + 60 * scale, 45 * scale, 90, 270, 'A-CUT-GANESHA');
      body += dxfLine(gX - 70 * scale, gY + 105 * scale, gX - 30 * scale, gY + 115 * scale, 'A-CUT-GANESHA');
      body += dxfLine(gX - 70 * scale, gY + 15 * scale, gX - 35 * scale, gY + 10 * scale, 'A-CUT-GANESHA');

      // Right Large Ear
      body += dxfArc(gX + 70 * scale, gY + 60 * scale, 45 * scale, 270, 90, 'A-CUT-GANESHA');
      body += dxfLine(gX + 70 * scale, gY + 105 * scale, gX + 30 * scale, gY + 115 * scale, 'A-CUT-GANESHA');
      body += dxfLine(gX + 70 * scale, gY + 15 * scale, gX + 35 * scale, gY + 10 * scale, 'A-CUT-GANESHA');

      // Forehead & Kumbha
      body += dxfArc(gX, gY + 70 * scale, 35 * scale, 15, 165, 'A-CUT-GANESHA');

      // Tilak (Trident / Chandan)
      body += dxfLine(gX, gY + 65 * scale, gX, gY + 105 * scale, 'A-ENGRAVE-TILAK');
      body += dxfLine(gX - 10 * scale, gY + 80 * scale, gX - 10 * scale, gY + 100 * scale, 'A-ENGRAVE-TILAK');
      body += dxfLine(gX + 10 * scale, gY + 80 * scale, gX + 10 * scale, gY + 100 * scale, 'A-ENGRAVE-TILAK');
      body += dxfCircle(gX, gY + 60 * scale, 3.5 * scale, 'A-ENGRAVE-TILAK');

      // Trunk (Vakratunda) Sweeping Curve
      body += dxfArc(gX - 20 * scale, gY + 20 * scale, 38 * scale, 270, 70, 'A-CUT-GANESHA');
      body += dxfArc(gX - 45 * scale, gY - 45 * scale, 42 * scale, 250, 40, 'A-CUT-GANESHA');
      // Trunk Tip Modak Loop
      body += dxfCircle(gX - 75 * scale, gY - 60 * scale, 16 * scale, 'A-CUT-GANESHA');

      // Tusk (Ekadanta)
      body += dxfLine(gX + 18 * scale, gY + 22 * scale, gX + 35 * scale, gY + 8 * scale, 'A-CUT-GANESHA');
      break;
    }

    case 'bells': {
      // Columns of hanging bells based on spacing
      const cols = Math.max(1, Math.floor(width / Math.max(120, spacing)));
      const colWidth = width / cols;

      for (let i = 0; i < cols; i++) {
        const bx = colWidth * i + colWidth / 2;
        // Stagger vertical drop: alternating long and short chains
        const isAlternate = i % 2 === 1;
        const bellTopY = height - (isAlternate ? 180 : 120) * (height / 800);
        const bellHeight = Math.min(colWidth * 0.7, 130);
        const bellRadius = bellHeight * 0.45;

        // Hanging Chain from Ceiling
        body += dxfLine(bx, height, bx, bellTopY + 20, 'A-CUT-CHAIN');
        // Chain links / decorative beads
        for (let cy = height - 30; cy > bellTopY + 25; cy -= 35) {
          body += dxfCircle(bx, cy, 5, 'A-CUT-CHAIN');
        }

        // Bell Top Loop / Crown
        body += dxfCircle(bx, bellTopY + 12, 8, 'A-CUT-BELL');

        // Bell Body (Dome & Flare)
        body += dxfArc(bx, bellTopY, bellRadius * 0.65, 0, 180, 'A-CUT-BELL');
        // Left Flared Skirt
        body += dxfLine(bx - bellRadius * 0.65, bellTopY, bx - bellRadius, bellTopY - bellHeight * 0.7, 'A-CUT-BELL');
        // Right Flared Skirt
        body += dxfLine(bx + bellRadius * 0.65, bellTopY, bx + bellRadius, bellTopY - bellHeight * 0.7, 'A-CUT-BELL');
        // Bottom Rim Curve
        body += dxfArc(bx, bellTopY - bellHeight * 0.7, bellRadius, 180, 360, 'A-CUT-BELL');

        // Internal Clapper / Tongue
        const clapperCenterY = bellTopY - bellHeight * 0.75;
        body += dxfLine(bx, bellTopY - 10, bx, clapperCenterY, 'A-CUT-BELL');
        body += dxfCircle(bx, clapperCenterY - 8, 9, 'A-CUT-BELL');

        // Secondary bottom hanging bell if panel is tall enough (> 1200mm)
        if (height >= 1200) {
          const lowerBellTopY = bellTopY - bellHeight - 200;
          if (lowerBellTopY > 150) {
            body += dxfLine(bx, clapperCenterY - 17, bx, lowerBellTopY + 20, 'A-CUT-CHAIN');
            body += dxfCircle(bx, lowerBellTopY + 12, 7, 'A-CUT-BELL');
            body += dxfArc(bx, lowerBellTopY, bellRadius * 0.55, 0, 180, 'A-CUT-BELL');
            body += dxfLine(bx - bellRadius * 0.55, lowerBellTopY, bx - bellRadius * 0.85, lowerBellTopY - bellHeight * 0.6, 'A-CUT-BELL');
            body += dxfLine(bx + bellRadius * 0.55, lowerBellTopY, bx + bellRadius * 0.85, lowerBellTopY - bellHeight * 0.6, 'A-CUT-BELL');
            body += dxfArc(bx, lowerBellTopY - bellHeight * 0.6, bellRadius * 0.85, 180, 360, 'A-CUT-BELL');
            body += dxfCircle(bx, lowerBellTopY - bellHeight * 0.6 - 7, 7, 'A-CUT-BELL');
          }
        }
      }
      break;
    }

    case 'lotus': {
      const radius = Math.min(width, height) * 0.4;
      // Central seed pod (Karnika)
      body += dxfCircle(cx, cy, radius * 0.22, 'A-CUT-LOTUS');
      // Pericarp dots
      for (let d = 0; d < 6; d++) {
        const dotAngle = (d * 60 * Math.PI) / 180;
        body += dxfCircle(cx + Math.cos(dotAngle) * radius * 0.11, cy + Math.sin(dotAngle) * radius * 0.11, radius * 0.03, 'A-ENGRAVE-LOTUS');
      }

      // Inner Tier: 8 Petals
      const innerPetalCount = 8;
      for (let i = 0; i < innerPetalCount; i++) {
        const angle = (i * 2 * Math.PI) / innerPetalCount;
        const tipX = cx + Math.cos(angle) * radius * 0.6;
        const tipY = cy + Math.sin(angle) * radius * 0.6;
        const baseAngle1 = angle - Math.PI / innerPetalCount;
        const baseAngle2 = angle + Math.PI / innerPetalCount;
        const b1X = cx + Math.cos(baseAngle1) * radius * 0.22;
        const b1Y = cy + Math.sin(baseAngle1) * radius * 0.22;
        const b2X = cx + Math.cos(baseAngle2) * radius * 0.22;
        const b2Y = cy + Math.sin(baseAngle2) * radius * 0.22;
        body += dxfLine(b1X, b1Y, tipX, tipY, 'A-CUT-LOTUS');
        body += dxfLine(tipX, tipY, b2X, b2Y, 'A-CUT-LOTUS');
      }

      // Outer Tier: 8 Interleaved Petals
      const outerPetalCount = 8;
      for (let i = 0; i < outerPetalCount; i++) {
        const angle = ((i + 0.5) * 2 * Math.PI) / outerPetalCount;
        const tipX = cx + Math.cos(angle) * radius * 0.95;
        const tipY = cy + Math.sin(angle) * radius * 0.95;
        const b1X = cx + Math.cos(angle - 0.28) * radius * 0.55;
        const b1Y = cy + Math.sin(angle - 0.28) * radius * 0.55;
        const b2X = cx + Math.cos(angle + 0.28) * radius * 0.55;
        const b2Y = cy + Math.sin(angle + 0.28) * radius * 0.55;
        body += dxfLine(b1X, b1Y, tipX, tipY, 'A-CUT-LOTUS');
        body += dxfLine(tipX, tipY, b2X, b2Y, 'A-CUT-LOTUS');
      }

      // Surrounding Concentric Halo Rings
      body += dxfCircle(cx, cy, radius * 0.98, 'A-CUT-LOTUS');
      break;
    }

    case 'moroccan_star': {
      // Repeat 8-point stars across the panel at pitch spacing
      const pitch = Math.max(60, spacing);
      const starR = pitch * 0.38;

      for (let y = pitch / 2; y < height; y += pitch) {
        for (let x = pitch / 2; x < width; x += pitch) {
          // An 8-point star is formed by 2 concentric squares rotated 45 degrees
          const s1 = starR;
          // Square 1 (Axial)
          body += dxfLine(x - s1, y - s1, x + s1, y - s1, 'A-CUT-STAR');
          body += dxfLine(x + s1, y - s1, x + s1, y + s1, 'A-CUT-STAR');
          body += dxfLine(x + s1, y + s1, x - s1, y + s1, 'A-CUT-STAR');
          body += dxfLine(x - s1, y + s1, x - s1, y - s1, 'A-CUT-STAR');

          // Square 2 (Rotated 45°)
          const d = s1 * 1.414;
          body += dxfLine(x, y - d, x + d, y, 'A-CUT-STAR');
          body += dxfLine(x + d, y, x, y + d, 'A-CUT-STAR');
          body += dxfLine(x, y + d, x - d, y, 'A-CUT-STAR');
          body += dxfLine(x - d, y, x, y - d, 'A-CUT-STAR');

          // Connecting diamond lines to neighbors
          body += dxfLine(x, y - d, x, y - pitch / 2, 'A-CUT-FRET');
          body += dxfLine(x + d, y, x + pitch / 2, y, 'A-CUT-FRET');
        }
      }
      break;
    }

    case 'chevron': {
      const pitch = Math.max(30, spacing);
      for (let y = -width; y < height + width; y += pitch) {
        // Left rake (rising)
        body += dxfLine(0, y, cx, y + cx, 'A-CUT-CHEVRON');
        // Right rake (falling)
        body += dxfLine(cx, y + cx, width, y, 'A-CUT-CHEVRON');
      }
      // Centre Spine Groove
      body += dxfLine(cx, 0, cx, height, 'A-ENGRAVE-SPINE');
      break;
    }

    case 'diamond': {
      for (let x = -height; x < width + height; x += spacing) {
        body += dxfLine(x, 0, x + height, height, 'A-CUT-DIAMOND');
        body += dxfLine(x, height, x + height, 0, 'A-CUT-DIAMOND');
      }
      break;
    }

    case 'circle': {
      const r = Math.max(8, spacing * 0.28);
      for (let y = spacing / 2; y < height; y += spacing) {
        for (let x = spacing / 2; x < width; x += spacing) {
          body += dxfCircle(x, y, r, 'A-CUT-CIRCLE');
        }
      }
      break;
    }

    case 'arch': {
      const bays = Math.max(1, Math.floor(width / spacing));
      const bay = width / bays;
      const radius = bay / 2;
      for (let i = 0; i < bays; i++) {
        const center = bay * i + radius;
        body += dxfArc(center, 0, radius, 0, 180, 'A-CUT-ARCH');
        body += dxfLine(center - radius, 0, center - radius, Math.min(height, radius), 'A-CUT-ARCH');
        body += dxfLine(center + radius, 0, center + radius, Math.min(height, radius), 'A-CUT-ARCH');
      }
      break;
    }

    case 'om': {
      const r = Math.min(width, height) * 0.24;
      // Outer Medallion Aureole
      body += dxfCircle(cx, cy, r, 'A-CUT-AUREOLE');
      body += dxfCircle(cx, cy, r * 1.08, 'A-CUT-AUREOLE');
      // Inner curves of Vedic Om
      body += dxfArc(cx, cy, r * 0.68, 210, 120, 'A-CUT-OM');
      body += dxfArc(cx + r * 0.18, cy - r * 0.05, r * 0.42, 70, 290, 'A-CUT-OM');
      body += dxfLine(cx - r * 0.55, cy + r * 0.2, cx + r * 0.55, cy + r * 0.2, 'A-CUT-OM');
      // Chandra-bindu
      body += dxfArc(cx, cy - r * 0.85, r * 0.22, 180, 360, 'A-CUT-OM');
      body += dxfCircle(cx, cy - r * 0.95, r * 0.06, 'A-CUT-OM');
      break;
    }

    case 'floral':
    default: {
      const r = Math.min(width, height) * 0.15;
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const px = cx + Math.cos(angle) * r * 1.5;
        const py = cy + Math.sin(angle) * r * 1.5;
        body += dxfCircle(px, py, r * 0.72, 'A-CUT-FLORAL');
      }
      body += dxfCircle(cx, cy, r * 0.72, 'A-CUT-FLORAL');
      break;
    }
  }

  return [
    '0', 'SECTION',
    '2', 'HEADER',
    '9', '$INSUNITS', '70', '4', // Millimetres
    '0', 'ENDSEC',
    '0', 'SECTION',
    '2', 'TABLES',
    '0', 'TABLE', '2', 'LAYER', '70', '6',
    '0', 'LAYER', '2', '0', '70', '0', '62', '7', '6', 'CONTINUOUS',
    '0', 'LAYER', '2', 'A-OUTLINE-BORDER', '70', '0', '62', '7', '6', 'CONTINUOUS',
    '0', 'LAYER', '2', 'A-CUT-SANCTUM', '70', '0', '62', '1', '6', 'CONTINUOUS',
    '0', 'LAYER', '2', 'A-CUT-GANESHA', '70', '0', '62', '3', '6', 'CONTINUOUS',
    '0', 'LAYER', '2', 'A-CUT-BELL', '70', '0', '62', '2', '6', 'CONTINUOUS',
    '0', 'LAYER', '2', 'A-CUT-LOTUS', '70', '0', '62', '4', '6', 'CONTINUOUS',
    '0', 'ENDTAB',
    '0', 'ENDSEC',
    '0', 'SECTION',
    '2', 'ENTITIES',
    body,
    '0', 'ENDSEC',
    '0', 'EOF',
    ''
  ].join('\n');
}
