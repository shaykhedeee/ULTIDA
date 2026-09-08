import { Part, TemplateCompileInput, LightingFixtureType } from './types.js';

export interface LightingZoneOptions {
  family?: string;
  category?: string;
  materialSlots?: string[];
  tags?: string[];
}

/**
 * compileLightingElements — reads a module's declared lighting zones and emits
 * real ModuleElement records of kind 'lighting_anchor' with exact 3D positions,
 * fixture types, color temperatures, strip lengths, and BOM entries.
 */
export function compileLightingElements(input: TemplateCompileInput, options?: LightingZoneOptions): Part[] {
  const p = (input.parameters ?? {}) as any;
  const instanceId = input.instanceId ?? 'mod-1';
  const widthMm = Number(p.totalWidthMm ?? p.widthMm ?? 600);
  const depthMm = Number(p.totalDepthMm ?? p.depthMm ?? 400);
  const heightMm = Number(p.totalHeightMm ?? p.heightMm ?? 750);

  // Aggregate tags, material slots, and family
  const tags: string[] = [
    ...(Array.isArray(input.tags) ? input.tags : []),
    ...(Array.isArray(p.tags) ? p.tags : []),
    ...(Array.isArray(options?.tags) ? options.tags : []),
  ].map((t) => String(t).toLowerCase());

  const materialSlots: string[] = [
    ...(Array.isArray(input.materialSlots) ? input.materialSlots : []),
    ...(Array.isArray(p.materialSlots) ? p.materialSlots : []),
    ...(Array.isArray(options?.materialSlots) ? options.materialSlots : []),
  ].map((s) => String(s).toLowerCase());

  const family = String(input.family ?? p.family ?? options?.family ?? input.category ?? '').toLowerCase();
  const name = String(p.name ?? '').toLowerCase();
  const description = String(p.description ?? '').toLowerCase();
  const fullText = `${family} ${name} ${description} ${tags.join(' ')}`;

  // Determine if lighting is declared or enabled
  const lightingParam = String(p.lighting ?? 'none').toLowerCase();
  const hasLightingSlot = materialSlots.includes('lighting');
  const hasLightingParam = lightingParam !== 'none' && lightingParam !== '';
  const hasLightingTag = tags.some((t) =>
    ['lighting', 'led-channel', 'warm-light', 'ambient-light', 'sensor-lighting', 'led-mirror', 'pendant', 'floor-lamp', 'table-lamp', 'sconce', 'led'].includes(t)
  );
  const hasLightingKeyword = /light|led|pendant|lamp|sconce/i.test(fullText);

  const lightingEnabled = hasLightingSlot || hasLightingParam || hasLightingTag || hasLightingKeyword;
  if (!lightingEnabled) {
    return [];
  }

  // Parse color temperature: default 3000K, or 2700K / 4000K from tags/text
  let colorTemperatureK = 3000;
  if (fullText.includes('2700k') || tags.includes('2700k')) {
    colorTemperatureK = 2700;
  } else if (fullText.includes('4000k') || tags.includes('4000k')) {
    colorTemperatureK = 4000;
  } else if (typeof p.colorTemperatureK === 'number' && p.colorTemperatureK > 0) {
    colorTemperatureK = p.colorTemperatureK;
  }

  const parts: Part[] = [];

  const createAnchor = (
    subId: string,
    anchorName: string,
    fixtureType: LightingFixtureType,
    pos: { xMm: number; yMm: number; zMm: number },
    face: Part['anchor']['face'],
    lengthMm?: number,
    sku = 'LED-3000K-ANCHOR'
  ): Part => {
    const isStrip = fixtureType === 'led-strip';
    const effectiveLengthMm = isStrip ? (lengthMm ?? Math.max(200, widthMm - 40)) : undefined;
    const qty = isStrip ? Math.max(0.1, Math.round(((effectiveLengthMm ?? 1000) / 1000) * 100) / 100) : 1;
    const unit = isStrip ? 'm' : 'pc';

    const part: Part = {
      id: `${instanceId}-${subId}`,
      templateVersionId: input.templateVersionId,
      instanceId,
      name: anchorName,
      kind: 'lighting_anchor',
      transform: { xMm: pos.xMm, yMm: pos.yMm, zMm: pos.zMm, rotationDeg: 0 },
      positionMm: { xMm: pos.xMm, yMm: pos.yMm, zMm: pos.zMm },
      size: {
        widthMm: isStrip ? (effectiveLengthMm ?? widthMm) : 40,
        depthMm: isStrip ? 12 : 40,
        heightMm: isStrip ? 12 : 30,
      },
      anchor: { face },
      fixtureType,
      colorTemperatureK,
      lengthMm: effectiveLengthMm,
      meta: {
        semanticType: 'lighting_anchor',
        parentId: null,
        materialSlot: { id: 'mat-led-warm', code: 'LED-WARM', name: `${colorTemperatureK}K Luminaire` },
        drawing: { layer: 'A-ANNO-LIGHTING', sortOrder: 5 },
        fixtureType,
        colorTemperatureK,
        lengthMm: effectiveLengthMm,
        bom: {
          sku,
          qty,
          unit,
          lengthMm: effectiveLengthMm,
        },
      },
      bom: {
        sku,
        qty,
        unit,
        lengthMm: effectiveLengthMm,
      },
    };
    return part;
  };

  // ── 1. Freestanding Lighting (Standalone luminaires) ───────
  if (family === 'freestanding-lighting' || family === 'lighting' || tags.includes('floor-lamp') || tags.includes('table-lamp') || tags.includes('pendant') || tags.includes('sconce')) {
    if (tags.includes('pendant') || /pendant/i.test(fullText)) {
      parts.push(createAnchor(
        'lighting-anchor-pendant',
        `${name ? `${name} ` : ''}Pendant Luminaire Anchor`,
        'pendant',
        { xMm: widthMm / 2, yMm: depthMm / 2, zMm: heightMm },
        'top',
        undefined,
        'LUMINAIRE-PENDANT-3000K'
      ));
    } else if (tags.includes('floor-lamp') || /floor/i.test(fullText)) {
      parts.push(createAnchor(
        'lighting-anchor-floor-lamp',
        `${name ? `${name} ` : ''}Floor Lamp Luminaire Anchor`,
        'spot',
        { xMm: widthMm / 2, yMm: depthMm / 2, zMm: Math.max(1200, heightMm - 200) },
        'center',
        undefined,
        'LUMINAIRE-FLOOR-LAMP-2700K'
      ));
    } else if (tags.includes('table-lamp') || /table/i.test(fullText)) {
      parts.push(createAnchor(
        'lighting-anchor-table-lamp',
        `${name ? `${name} ` : ''}Table Lamp Luminaire Anchor`,
        'spot',
        { xMm: widthMm / 2, yMm: depthMm / 2, zMm: Math.max(300, heightMm - 80) },
        'top',
        undefined,
        'LUMINAIRE-TABLE-LAMP-2700K'
      ));
    } else {
      // Wall sconce or ambient standalone luminaire
      parts.push(createAnchor(
        'lighting-anchor-sconce',
        `${name ? `${name} ` : ''}Architectural Sconce Luminaire Anchor`,
        'spot',
        { xMm: widthMm / 2, yMm: depthMm, zMm: heightMm / 2 },
        'back',
        undefined,
        'LUMINAIRE-SCONCE-3000K'
      ));
    }
    return parts;
  }

  // ── 2. Profile-Glass Channel & Display Shelf LED ──────────
  const isProfileGlass =
    p.profileGlassOption === true ||
    p.glassProfile === true ||
    p.shutterStyle === 'profile-glass' ||
    family === 'crockery' ||
    tags.includes('profile-glass') ||
    tags.includes('fluted-glass') ||
    tags.includes('display');

  if (isProfileGlass) {
    const channelH = Math.max(300, heightMm - 100);
    parts.push(createAnchor(
      'lighting-anchor-profile-glass',
      'Profile Glass Vertical LED Channel',
      'led-strip',
      { xMm: Math.max(20, widthMm - 40), yMm: 20, zMm: 50 },
      'front',
      channelH,
      'LED-PROFILE-CHANNEL'
    ));
  }

  // ── 3. Under-Cabinet Strip / Floating Console / Floating Bed Underglow ──
  const isFloatingBase =
    p.baseType === 'floating' ||
    /floating/i.test(fullText) ||
    family === 'tv-unit' ||
    family === 'bed' ||
    (family.includes('kitchen') && (family.includes('wall') || /wall|aventos|overhead/i.test(fullText))) ||
    tags.includes('floating-base') ||
    tags.includes('floating') ||
    tags.includes('under-cabinet') ||
    tags.includes('concealed-led');

  if (isFloatingBase) {
    const stripW = Math.max(200, widthMm - 40);
    const zPos = family === 'bed'
      ? 40
      : family.includes('kitchen') && (family.includes('wall') || /wall/i.test(fullText))
        ? 0
        : p.floorClearanceMm ?? 160;

    parts.push(createAnchor(
      'lighting-anchor-under-cabinet',
      family === 'bed'
        ? 'Bed Underglow Warm LED Strip'
        : family.includes('kitchen')
          ? 'Under-Cabinet Countertop Task LED Strip'
          : 'Floating Console Underglow LED Strip',
      'led-strip',
      { xMm: 20, yMm: Math.max(10, depthMm - 40), zMm: zPos },
      'bottom',
      stripW,
      'LED-UNDERCABINET-STRIP'
    ));
  }

  // ── 4. Loft Downlight / Ceiling Spotlight ──────────────────
  const hasDownlight =
    lightingParam === 'spotlight' ||
    lightingParam === 'both' ||
    p.includeLoft === true ||
    tags.includes('spotlight') ||
    tags.includes('downlight') ||
    /spotlight|downlight|mandapa|arch/i.test(fullText);

  if (hasDownlight) {
    parts.push(createAnchor(
      'lighting-anchor-downlight',
      'Fascia / Loft Recessed Downlight',
      'downlight',
      { xMm: widthMm / 2, yMm: depthMm / 2, zMm: heightMm - 10 },
      'top',
      undefined,
      'SPOT-3000K-COB'
    ));
  }

  // ── 5. Vanity / Mirror / CNC Jaali / Feature Wall Backlight ──
  const hasBacklight =
    family === 'feature-wall' ||
    family === 'pooja' ||
    tags.includes('led-mirror') ||
    tags.includes('vanity') ||
    tags.includes('cnc-jaali') ||
    tags.includes('backlight') ||
    tags.includes('ambient-light') ||
    /mirror|vanity|jaali|backlight|acoustic-slat/i.test(fullText);

  if (hasBacklight) {
    const perimeterMm = Math.max(300, (widthMm + heightMm) * 0.8);
    parts.push(createAnchor(
      'lighting-anchor-backlight',
      family === 'pooja'
        ? 'Sacred Mandir Jaali Concealed Backlight'
        : family === 'feature-wall'
          ? 'Perimeter Accent Backlight Channel'
          : 'Vanity Mirror Perimeter Backlight',
      'led-strip',
      { xMm: 10, yMm: depthMm - 10, zMm: heightMm / 2 },
      'back',
      perimeterMm,
      'LED-PERIMETER-BACKLIGHT'
    ));
  }

  // ── 6. Fallback Guarantee for Catalog Entries Declaring Lighting ──
  if (parts.length === 0 && (hasLightingSlot || hasLightingParam || hasLightingTag)) {
    const defaultLengthMm = Math.max(200, widthMm - 40);
    parts.push(createAnchor(
      'lighting-anchor-ambient',
      'Concealed Ambient 3000K LED Strip',
      'led-strip',
      { xMm: 20, yMm: depthMm / 2, zMm: heightMm - 24 },
      'top',
      defaultLengthMm,
      'LED-3000K-STRIP'
    ));
  }

  return parts;
}
