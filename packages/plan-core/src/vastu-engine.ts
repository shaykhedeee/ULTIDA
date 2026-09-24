import { z } from 'zod';

export type VastuDirection = 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'N' | 'Brahmasthan';

export interface VastuZoneMeta {
  code: VastuDirection;
  sanskritName: string;
  englishDirection: string;
  rulingDeity: string;
  element: string;
  auspiciousUsages: string[];
  inauspiciousUsages: string[];
  remedyColor: string;
  hexColor: string;
}

export const VASTU_ZONES_META: Record<VastuDirection, VastuZoneMeta> = {
  NE: {
    code: 'NE',
    sanskritName: 'Ishanya',
    englishDirection: 'North-East',
    rulingDeity: 'Lord Shiva / Ishana',
    element: 'Water (Jal)',
    auspiciousUsages: ['pooja', 'mandir', 'meditation', 'living', 'study', 'foyer', 'balcony'],
    inauspiciousUsages: ['master_bedroom', 'toilet', 'bathroom', 'kitchen', 'staircase'],
    remedyColor: 'Light Blue / White',
    hexColor: 'rgba(56, 189, 248, 0.18)',
  },
  E: {
    code: 'E',
    sanskritName: 'Purva',
    englishDirection: 'East',
    rulingDeity: 'Lord Indra / Surya',
    element: 'Solar / Air',
    auspiciousUsages: ['living', 'foyer', 'study', 'dining', 'balcony', 'bedroom'],
    inauspiciousUsages: ['toilet', 'heavy_storage'],
    remedyColor: 'Sun Gold / Emerald Green',
    hexColor: 'rgba(34, 197, 94, 0.16)',
  },
  SE: {
    code: 'SE',
    sanskritName: 'Agneya',
    englishDirection: 'South-East',
    rulingDeity: 'Lord Agni (Fire)',
    element: 'Fire (Agni)',
    auspiciousUsages: ['kitchen', 'utility', 'electrical', 'pantry'],
    inauspiciousUsages: ['master_bedroom', 'pooja', 'mandir', 'water_body', 'toilet'],
    remedyColor: 'Warm Copper / Pastel Peach',
    hexColor: 'rgba(249, 115, 22, 0.18)',
  },
  S: {
    code: 'S',
    sanskritName: 'Dakshina',
    englishDirection: 'South',
    rulingDeity: 'Lord Yama',
    element: 'Earth / Fire',
    auspiciousUsages: ['bedroom', 'wardrobe', 'storage', 'office'],
    inauspiciousUsages: ['main_entrance', 'pooja', 'mandir', 'underground_water'],
    remedyColor: 'Earthy Ochre / Terracotta',
    hexColor: 'rgba(234, 88, 12, 0.16)',
  },
  SW: {
    code: 'SW',
    sanskritName: 'Nairutya',
    englishDirection: 'South-West',
    rulingDeity: 'Nirrti (Stability & Earth)',
    element: 'Earth (Prithvi)',
    auspiciousUsages: ['master_bedroom', 'heavy_storage', 'wardrobe', 'treasury'],
    inauspiciousUsages: ['pooja', 'mandir', 'kitchen', 'water_tank', 'main_entrance', 'toilet'],
    remedyColor: 'Warm Sand / Deep Earth',
    hexColor: 'rgba(168, 85, 247, 0.18)',
  },
  W: {
    code: 'W',
    sanskritName: 'Pashchima',
    englishDirection: 'West',
    rulingDeity: 'Lord Varuna',
    element: 'Water / Space',
    auspiciousUsages: ['dining', 'bedroom', 'kids_bedroom', 'study', 'toilet'],
    inauspiciousUsages: ['pooja', 'mandir', 'kitchen'],
    remedyColor: 'Soft Grey / Metallic White',
    hexColor: 'rgba(148, 163, 184, 0.18)',
  },
  NW: {
    code: 'NW',
    sanskritName: 'Vayavya',
    englishDirection: 'North-West',
    rulingDeity: 'Lord Vayu (Air)',
    element: 'Air (Vayu)',
    auspiciousUsages: ['guest_bedroom', 'utility', 'pantry', 'toilet', 'bathroom', 'parking', 'balcony'],
    inauspiciousUsages: ['master_bedroom', 'pooja'],
    remedyColor: 'Pearl White / Cream',
    hexColor: 'rgba(20, 184, 166, 0.16)',
  },
  N: {
    code: 'N',
    sanskritName: 'Uttara',
    englishDirection: 'North',
    rulingDeity: 'Lord Kuber (Wealth)',
    element: 'Water / Wealth',
    auspiciousUsages: ['living', 'foyer', 'study', 'home_office', 'treasury', 'balcony'],
    inauspiciousUsages: ['toilet', 'kitchen', 'heavy_storage'],
    remedyColor: 'Pistachio Green / Mint',
    hexColor: 'rgba(16, 185, 129, 0.18)',
  },
  Brahmasthan: {
    code: 'Brahmasthan',
    sanskritName: 'Brahmasthan',
    englishDirection: 'Center Core',
    rulingDeity: 'Lord Brahma (Cosmic Creator)',
    element: 'Ether (Akasha)',
    auspiciousUsages: ['courtyard', 'atrium', 'open_lobby', 'living', 'circulation'],
    inauspiciousUsages: ['toilet', 'kitchen', 'staircase', 'heavy_pillar', 'shaft'],
    remedyColor: 'Pure Gold / Luminous White',
    hexColor: 'rgba(234, 179, 8, 0.20)',
  },
};

export type VastuHarmonyStatus = 'auspicious' | 'neutral' | 'remedy_needed' | 'critical_defect';

export interface VastuRoomEvaluation {
  roomId: string;
  roomLabel: string;
  roomType: string;
  zone: VastuDirection;
  zoneMeta: VastuZoneMeta;
  status: VastuHarmonyStatus;
  score: number; // 0..100
  feedback: string;
  remedy?: string;
  centroid: { x: number; y: number };
}

export interface PlanVastuReport {
  overallScore: number; // 0..100
  status: 'highly_auspicious' | 'harmonious' | 'remedies_recommended' | 'critical_alignments_needed';
  northAngleDeg: number;
  planBounds: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
  planCentroid: { x: number; y: number };
  rooms: VastuRoomEvaluation[];
  summary: {
    auspiciousCount: number;
    neutralCount: number;
    remedyCount: number;
    criticalDefectCount: number;
  };
  keyRemedies: string[];
}

export interface VastuRoomInput {
  id: string;
  label?: string;
  roomType?: string;
  polygon?: Array<{ x: number; y: number }>;
  geometry?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    polygon?: Array<{ x: number; y: number }>;
  };
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

function normalizeRoomType(raw?: string, label?: string): string {
  const text = `${raw || ''} ${label || ''}`.toLowerCase();
  if (text.includes('master')) return 'master_bedroom';
  if (text.includes('bed') || text.includes('br')) return 'bedroom';
  if (text.includes('kitchen') || text.includes('kit')) return 'kitchen';
  if (text.includes('pooja') || text.includes('puja') || text.includes('mandir') || text.includes('prayer')) return 'pooja';
  if (text.includes('toilet') || text.includes('bath') || text.includes('wc') || text.includes('powder')) return 'toilet';
  if (text.includes('dining') || text.includes('din')) return 'dining';
  if (text.includes('living') || text.includes('drawing') || text.includes('hall') || text.includes('lounge')) return 'living';
  if (text.includes('foyer') || text.includes('entry') || text.includes('vestibule')) return 'foyer';
  if (text.includes('utility') || text.includes('wash') || text.includes('laundry')) return 'utility';
  if (text.includes('balcony') || text.includes('verandah') || text.includes('deck') || text.includes('terrace')) return 'balcony';
  if (text.includes('study') || text.includes('office') || text.includes('library')) return 'study';
  if (text.includes('stair') || text.includes('lift')) return 'staircase';
  if (text.includes('store') || text.includes('pantry')) return 'storage';
  return raw || 'other';
}

function getRoomCentroid(room: VastuRoomInput): { x: number; y: number } {
  const poly = room.polygon ?? room.geometry?.polygon;
  if (poly && poly.length >= 3) {
    let sumX = 0;
    let sumY = 0;
    for (const p of poly) {
      sumX += p.x;
      sumY += p.y;
    }
    return { x: sumX / poly.length, y: sumY / poly.length };
  }
  const x = room.geometry?.x ?? room.x ?? 0;
  const y = room.geometry?.y ?? room.y ?? 0;
  const w = room.geometry?.width ?? room.width ?? 0;
  const h = room.geometry?.height ?? room.height ?? 0;
  return { x: x + w / 2, y: y + h / 2 };
}

export function determineVastuZone(
  centroid: { x: number; y: number },
  bounds: { minX: number; minY: number; width: number; height: number },
  northAngleDeg = 0
): VastuDirection {
  const normX = bounds.width > 0 ? (centroid.x - bounds.minX) / bounds.width : 0.5;
  const normY = bounds.height > 0 ? (centroid.y - bounds.minY) / bounds.height : 0.5;

  if (normX >= 0.33 && normX <= 0.67 && normY >= 0.33 && normY <= 0.67) {
    return 'Brahmasthan';
  }

  const dx = normX - 0.5;
  const dy = normY - 0.5;
  let angleFromUpDeg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  if (angleFromUpDeg < 0) angleFromUpDeg += 360;

  let bearingFromNorth = angleFromUpDeg - northAngleDeg;
  while (bearingFromNorth < 0) bearingFromNorth += 360;
  while (bearingFromNorth >= 360) bearingFromNorth -= 360;

  if (bearingFromNorth >= 337.5 || bearingFromNorth < 22.5) return 'N';
  if (bearingFromNorth >= 22.5 && bearingFromNorth < 67.5) return 'NE';
  if (bearingFromNorth >= 67.5 && bearingFromNorth < 112.5) return 'E';
  if (bearingFromNorth >= 112.5 && bearingFromNorth < 157.5) return 'SE';
  if (bearingFromNorth >= 157.5 && bearingFromNorth < 202.5) return 'S';
  if (bearingFromNorth >= 202.5 && bearingFromNorth < 247.5) return 'SW';
  if (bearingFromNorth >= 247.5 && bearingFromNorth < 292.5) return 'W';
  return 'NW';
}

export function evaluateRoomZoneHarmony(
  roomType: string,
  zone: VastuDirection,
  label: string
): { status: VastuHarmonyStatus; score: number; feedback: string; remedy?: string } {
  const normType = normalizeRoomType(roomType, label);

  switch (normType) {
    case 'master_bedroom':
      if (zone === 'SW') {
        return {
          status: 'auspicious',
          score: 100,
          feedback: 'Master bedroom in South-West (Nairutya) is ideally grounded, providing authority, stability and peace.',
        };
      }
      if (zone === 'S' || zone === 'W') {
        return {
          status: 'neutral',
          score: 80,
          feedback: `Master bedroom in ${zone} is favorable and peaceful.`,
        };
      }
      if (zone === 'NE') {
        return {
          status: 'critical_defect',
          score: 20,
          feedback: 'CRITICAL DEFECT: Master bedroom in North-East (Ishanya) creates unrest, financial volatility and sleep disturbances.',
          remedy: 'Position the bed along the South/West wall; sleep with head facing South; keep the NE corner of the room free and clean with a brass bowl of sea salt or camphor diffuser.',
        };
      }
      if (zone === 'SE') {
        return {
          status: 'remedy_needed',
          score: 40,
          feedback: 'DEFECT: Master bedroom in South-East (Agneya - Fire zone) can induce irritability and domestic friction.',
          remedy: 'Use soothing pastel earth tones (sand/peach); avoid fiery reds; install a rose quartz crystal or lead helix on the South-East wall.',
        };
      }
      return {
        status: 'neutral',
        score: 65,
        feedback: `Master bedroom in ${zone} is workable with proper furniture orientation.`,
        remedy: 'Ensure the headboard faces South or East during sleep.',
      };

    case 'kitchen':
      if (zone === 'SE') {
        return {
          status: 'auspicious',
          score: 100,
          feedback: 'Kitchen in South-East (Agneya) directly aligns with the sacred Fire element (Agni), bestowing prosperity and digestive vitality.',
        };
      }
      if (zone === 'NW') {
        return {
          status: 'neutral',
          score: 85,
          feedback: 'Kitchen in North-West (Vayavya) is a classical secondary alternative under Vastu.',
        };
      }
      if (zone === 'NE') {
        return {
          status: 'critical_defect',
          score: 15,
          feedback: 'CRITICAL DEFECT: Kitchen in North-East (Ishanya - Water/Divine zone) opposes Fire and Water, generating severe discord and health strain.',
          remedy: 'Install a brown/yellow marble or jasper slab beneath the cooking hob; place the cooking stove strictly in the South-East corner of the kitchen; avoid red counters.',
        };
      }
      if (zone === 'SW') {
        return {
          status: 'critical_defect',
          score: 20,
          feedback: 'CRITICAL DEFECT: Kitchen in South-West (Nairutya - Earth zone) drains domestic stability and prosperity.',
          remedy: 'Use a yellow stone slab under the stove and paint walls light cream; ensure the cook faces East while preparing meals.',
        };
      }
      return {
        status: 'remedy_needed',
        score: 50,
        feedback: `Kitchen in ${zone} requires elemental balancing.`,
        remedy: 'Place the cooking hob towards the South-East corner of the room and keep the sink in the North-East corner.',
      };

    case 'pooja':
      if (zone === 'NE') {
        return {
          status: 'auspicious',
          score: 100,
          feedback: 'Pooja/Mandir in North-East (Ishanya) is supremely sacred and divine, amplifying positive spiritual cosmic energies.',
        };
      }
      if (zone === 'E' || zone === 'N') {
        return {
          status: 'auspicious',
          score: 90,
          feedback: `Pooja room in ${zone} is highly auspicious, inviting knowledge and abundance.`,
        };
      }
      if (zone === 'SW' || zone === 'S') {
        return {
          status: 'critical_defect',
          score: 15,
          feedback: `CRITICAL DEFECT: Sacred Mandir in ${zone} conflicts with the Heavy Earth zone.`,
          remedy: 'If relocation is not possible, elevate the deities on a white marble or teak altar; ensure idols face West so the devotee faces East during worship.',
        };
      }
      return {
        status: 'remedy_needed',
        score: 45,
        feedback: `Pooja room in ${zone} is non-traditional.`,
        remedy: 'Keep the sacred deities on the East or North-East wall of the room.',
      };

    case 'toilet':
      if (zone === 'NW' || zone === 'W') {
        return {
          status: 'auspicious',
          score: 95,
          feedback: `Toilet in ${zone} is classically recommended for healthy waste elimination and energy release.`,
        };
      }
      if (zone === 'S') {
        return {
          status: 'neutral',
          score: 75,
          feedback: 'Toilet in South is acceptable with proper ventilation.',
        };
      }
      if (zone === 'NE' || zone === 'Brahmasthan') {
        return {
          status: 'critical_defect',
          score: 10,
          feedback: `CRITICAL DEFECT: Toilet in ${zone} severely contaminates sacred cosmic energy and can cause chronic health or vitality blockages.`,
          remedy: 'Keep toilet lid closed at all times; place a bowl of raw Himalayan rock salt in a bronze dish; install copper/zinc Vastu energy strips along the bathroom threshold.',
        };
      }
      if (zone === 'SW') {
        return {
          status: 'remedy_needed',
          score: 35,
          feedback: 'DEFECT: Toilet in South-West depletes relationship stability and household groundedness.',
          remedy: 'Install a lead energy strip or yellow fluorite crystals at the doorway; keep the door strictly closed.',
        };
      }
      return {
        status: 'neutral',
        score: 70,
        feedback: `Toilet in ${zone} is standard.`,
      };

    case 'living':
    case 'dining':
      if (zone === 'N' || zone === 'E' || zone === 'NE') {
        return {
          status: 'auspicious',
          score: 100,
          feedback: `${label} in ${zone} welcomes vibrant social harmony, sunlight and positive visitor energy.`,
        };
      }
      if (zone === 'NW' || zone === 'W') {
        return {
          status: 'auspicious',
          score: 90,
          feedback: `${label} in ${zone} fosters warm conversations and nourishment.`,
        };
      }
      return {
        status: 'neutral',
        score: 75,
        feedback: `${label} in ${zone} is functional and comfortable.`,
      };

    default:
      if (zone === 'Brahmasthan') {
        return {
          status: 'neutral',
          score: 70,
          feedback: 'Central zone should remain light, open and clear of heavy obstacles.',
        };
      }
      return {
        status: 'neutral',
        score: 80,
        feedback: `${label} in ${zone} is standard architectural layout.`,
      };
  }
}

export function calculatePlanVastu(input: {
  rooms: VastuRoomInput[];
  northAngleDeg?: number;
  planBounds?: { minX: number; minY: number; maxX: number; maxY: number };
}): PlanVastuReport {
  const northAngleDeg = input.northAngleDeg ?? 0;
  const rawRooms = input.rooms.filter((r) => {
    const w = r.geometry?.width ?? r.width ?? 0;
    const h = r.geometry?.height ?? r.height ?? 0;
    const poly = r.polygon ?? r.geometry?.polygon;
    return (w > 0 && h > 0) || (poly && poly.length >= 3);
  });

  if (rawRooms.length === 0) {
    return {
      overallScore: 100,
      status: 'harmonious',
      northAngleDeg,
      planBounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000, width: 1000, height: 1000 },
      planCentroid: { x: 500, y: 500 },
      rooms: [],
      summary: { auspiciousCount: 0, neutralCount: 0, remedyCount: 0, criticalDefectCount: 0 },
      keyRemedies: [],
    };
  }

  let minX = input.planBounds?.minX ?? Infinity;
  let minY = input.planBounds?.minY ?? Infinity;
  let maxX = input.planBounds?.maxX ?? -Infinity;
  let maxY = input.planBounds?.maxY ?? -Infinity;

  if (!input.planBounds) {
    for (const r of rawRooms) {
    const poly = r.polygon ?? r.geometry?.polygon;
    if (poly && poly.length > 0) {
      for (const p of poly) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    } else {
      const rx = r.geometry?.x ?? r.x ?? 0;
      const ry = r.geometry?.y ?? r.y ?? 0;
      const rw = r.geometry?.width ?? r.width ?? 0;
      const rh = r.geometry?.height ?? r.height ?? 0;
      if (rx < minX) minX = rx;
      if (ry < minY) minY = ry;
      if (rx + rw > maxX) maxX = rx + rw;
      if (ry + rh > maxY) maxY = ry + rh;
    }
  }
  }

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const bounds = { minX, minY, maxX, maxY, width, height };
  const planCentroid = { x: minX + width / 2, y: minY + height / 2 };

  let totalScore = 0;
  let auspiciousCount = 0;
  let neutralCount = 0;
  let remedyCount = 0;
  let criticalDefectCount = 0;
  const keyRemedies: string[] = [];

  const evaluatedRooms: VastuRoomEvaluation[] = rawRooms.map((r, idx) => {
    const centroid = getRoomCentroid(r);
    const zone = determineVastuZone(centroid, bounds, northAngleDeg);
    const label = r.label || `Room ${idx + 1}`;
    const roomType = r.roomType || 'room';
    const evalResult = evaluateRoomZoneHarmony(roomType, zone, label);

    totalScore += evalResult.score;
    if (evalResult.status === 'auspicious') auspiciousCount += 1;
    else if (evalResult.status === 'neutral') neutralCount += 1;
    else if (evalResult.status === 'remedy_needed') {
      remedyCount += 1;
      if (evalResult.remedy) keyRemedies.push(`${label} (${zone}): ${evalResult.remedy}`);
    } else if (evalResult.status === 'critical_defect') {
      criticalDefectCount += 1;
      if (evalResult.remedy) keyRemedies.push(`⚠️ ${label} (${zone}): ${evalResult.remedy}`);
    }

    return {
      roomId: r.id,
      roomLabel: label,
      roomType,
      zone,
      zoneMeta: VASTU_ZONES_META[zone],
      status: evalResult.status,
      score: evalResult.score,
      feedback: evalResult.feedback,
      remedy: evalResult.remedy,
      centroid,
    };
  });

  const overallScore = Math.round(totalScore / (evaluatedRooms.length || 1));

  let status: PlanVastuReport['status'] = 'harmonious';
  if (overallScore >= 88 && criticalDefectCount === 0) status = 'highly_auspicious';
  else if (criticalDefectCount > 0) status = 'critical_alignments_needed';
  else if (overallScore < 70) status = 'remedies_recommended';

  return {
    overallScore,
    status,
    northAngleDeg,
    planBounds: bounds,
    planCentroid,
    rooms: evaluatedRooms,
    summary: {
      auspiciousCount,
      neutralCount,
      remedyCount,
      criticalDefectCount,
    },
    keyRemedies,
  };
}
