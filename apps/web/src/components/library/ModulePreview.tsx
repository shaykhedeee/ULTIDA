import { useState, type CSSProperties } from 'react';
import { Camera, Layers } from 'lucide-react';
import './module-preview.css';

export type ModulePreviewData = {
  id: string;
  family: string;
  name: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  tags?: string[];
  photoUrl?: string;
};

type Props = { module: ModulePreviewData; compact?: boolean; style?: CSSProperties; defaultView?: 'vector' | 'real' };

// 3D AI-generated product renders (background-less, white-background product shots)
const MODULE_3D_BY_FAMILY: Record<string, string> = {
  'kitchen-base': '/module-3d/kitchen-base.jpg',
  'kitchen-tall': '/module-3d/kitchen-tall.jpg',
  wardrobe: '/module-3d/wardrobe.jpg',
  'tv-unit': '/module-3d/tv-unit.jpg',
  'feature-wall': '/module-3d/tv-unit.jpg',
  crockery: '/module-3d/crockery.jpg',
  study: '/module-3d/study.jpg',
};

// Real-life installed photography fallback
const REAL_LIFE_PHOTO_BY_FAMILY: Record<string, string> = {
  'tv-unit': '/reference-vault/013-52a29a1053dc.png',
  'feature-wall': '/reference-vault/034-355f624f691c.png',
  wardrobe: '/reference-vault/008-5fd497f005d8.png',
  'kitchen-base': '/reference-vault/006-e36e2c7c9b1a.png',
  'kitchen-wall': '/reference-vault/039-1786da704c5a.png',
  'kitchen-tall': '/reference-vault/003-1f61a8aabde4.png',
  'kitchen-corner': '/reference-vault/042-7eaf3dbfd306.png',
  bed: '/reference-vault/047-c1ce4511e83d.png',
  sofa: '/reference-vault/001-ddc1891636f7.png',
  dining: '/reference-vault/002-cab37cfa0bb2.png',
  crockery: '/reference-vault/018-b7dd5f1492fe.png',
  pooja: '/reference-vault/020-ea872c640df6.png',
  study: '/reference-vault/011-6c55d3439149.png',
  utility: '/reference-vault/036-de959cf3df44.png',
  vanity: '/reference-vault/028-a8f62ab3d392.png',
  storage: '/reference-vault/040-a7dcd66e4242.png',
  'false-ceiling': '/reference-vault/037-4dd8b6a25dc7.png',
};

const paletteByFamily: Record<string, { front: string; frontEnd: string; side: string; top: string; accent: string; highlight: string; led: string }> = {
  'kitchen-base': { front: '#e8dcce', frontEnd: '#d4c2af', side: '#b5a18d', top: '#f8f4ec', accent: '#8c6239', highlight: '#ffffff', led: '#fef08a' },
  'kitchen-wall': { front: '#e2e5dc', frontEnd: '#ccd2c4', side: '#a3ab9a', top: '#f4f6f0', accent: '#697462', highlight: '#ffffff', led: '#fef08a' },
  'kitchen-tall': { front: '#dbe1d3', frontEnd: '#c4cdb9', side: '#9ba78f', top: '#f0f4ea', accent: '#536349', highlight: '#ffffff', led: '#fef08a' },
  'kitchen-corner': { front: '#e5d7c3', frontEnd: '#cebc9f', side: '#ab9573', top: '#f9f2e8', accent: '#87623a', highlight: '#ffffff', led: '#fef08a' },
  wardrobe: { front: '#e4dcd2', frontEnd: '#cfc3b5', side: '#a89886', top: '#f5efe8', accent: '#695748', highlight: '#ffffff', led: '#fef08a' },
  'tv-unit': { front: '#3d3732', frontEnd: '#292420', side: '#1c1815', top: '#544c45', accent: '#c59c2d', highlight: '#73685e', led: '#fef08a' },
  crockery: { front: '#ded8cd', frontEnd: '#c7beaf', side: '#a39785', top: '#f4f0e8', accent: '#99734d', highlight: '#ffffff', led: '#fef08a' },
  pooja: { front: '#e8d4a7', frontEnd: '#d1b980', side: '#b09452', top: '#f8eed2', accent: '#916317', highlight: '#fff9e6', led: '#fde047' },
  study: { front: '#ded1be', frontEnd: '#c7b69e', side: '#a38f72', top: '#f3ebe0', accent: '#6d4f36', highlight: '#ffffff', led: '#fef08a' },
  utility: { front: '#dbe2e2', frontEnd: '#c4cccc', side: '#9aa5a5', top: '#edf2f2', accent: '#526c6a', highlight: '#ffffff', led: '#fef08a' },
  storage: { front: '#ded7cd', frontEnd: '#c9beaf', side: '#a39785', top: '#f4f0e8', accent: '#6b5e50', highlight: '#ffffff', led: '#fef08a' },
  bed: { front: '#d7c7b8', frontEnd: '#beaa97', side: '#99816b', top: '#ede2d7', accent: '#664a34', highlight: '#ffffff', led: '#fef08a' },
  sofa: { front: '#bcc6bd', frontEnd: '#a0ad9f', side: '#7b8a78', top: '#dbe3db', accent: '#465a48', highlight: '#ffffff', led: '#fef08a' },
  dining: { front: '#cfab84', frontEnd: '#b38d64', side: '#8c663f', top: '#ebd7c0', accent: '#5c3d22', highlight: '#ffffff', led: '#fef08a' },
  'false-ceiling': { front: '#f4f2ee', frontEnd: '#dfdcd4', side: '#b8b4a8', top: '#ffffff', accent: '#c59c2d', highlight: '#ffffff', led: '#fef08a' },
  'feature-wall': { front: '#2e3338', frontEnd: '#1e2226', side: '#131618', top: '#454c52', accent: '#c59c2d', highlight: '#5d676e', led: '#fef08a' },
};

function DetailedCabinet({ module, colours }: { module: ModulePreviewData; colours: (typeof paletteByFamily)['kitchen-base'] }) {
  const roomRefH = 2800; // standard architectural reference ceiling height in mm
  const plinthY = 118; // standard floor plinth datum
  const isTall = module.family === 'wardrobe' || module.family === 'kitchen-tall' || module.family === 'utility' || module.family === 'storage' || (module.heightMm && module.heightMm >= 1800);
  const isWall = module.family === 'kitchen-wall' || (!isTall && /wall|overhead/i.test(module.name));
  const isCorner = module.family === 'kitchen-corner';
  const isCrockery = module.family === 'crockery';
  const isPooja = module.family === 'pooja';

  const tags = `${module.name} ${(module.tags ?? []).join(' ')}`.toLowerCase();
  const hasGlass = isCrockery || /glass|profile|display|tinted/i.test(tags);
  const hasSink = /sink|basin/i.test(module.name);
  const hasHob = /hob|cooktop/i.test(module.name);
  const hasDrawers = /drawer|cutlery|tandem|pot/i.test(tags);
  const hasAppliance = /microwave|oven|appliance/i.test(tags);
  const isWashroom = /washroom|vanity|cistern/i.test(tags);

  // Proportional height scaling (750mm -> ~32px, 2100mm -> ~80px, 2730mm -> ~102px)
  const hMm = module.heightMm || (isTall ? 2400 : isWall ? 720 : 750);
  const rawH = (hMm / roomRefH) * 105;
  const frontH = Math.max(30, Math.min(104, Math.round(rawH)));
  const frontY = isTall
    ? Math.max(14, plinthY - frontH)
    : isWall
      ? 34
      : plinthY - frontH;

  const doors = module.widthMm >= 1200 ? 3 : module.widthMm >= 500 ? 2 : 1;
  const doorW = 110 / doors;
  const hasLoft = isTall && hMm >= 2100;
  const loftH = hasLoft ? Math.round(frontH * (630 / hMm)) : 0;

  return (
    <>
      {/* 3D Top Deck */}
      <polygon points={`22,${frontY} 132,${frontY} 146,${frontY - 12} 36,${frontY - 12}`} fill={`url(#grad-top-${module.id})`} />
      {/* 3D Side Depth Panel */}
      <polygon points={`132,${frontY} 146,${frontY - 12} 146,${frontY + frontH - 12} 132,${frontY + frontH}`} fill={`url(#grad-side-${module.id})`} />

      {/* Main Front Carcase Box */}
      <rect x="22" y={frontY} width="110" height={frontH} rx="2" fill={`url(#grad-front-${module.id})`} stroke={colours.accent} strokeWidth="1.2" />

      {/* System 32 Line Hole Indicators (Architectural Detailing) */}
      <g opacity="0.4">
        <circle cx="26" cy={frontY + 8} r="0.8" fill="#4a3b2c" />
        <circle cx="26" cy={frontY + 18} r="0.8" fill="#4a3b2c" />
        <circle cx="26" cy={frontY + 28} r="0.8" fill="#4a3b2c" />
        <circle cx="128" cy={frontY + 8} r="0.8" fill="#4a3b2c" />
        <circle cx="128" cy={frontY + 18} r="0.8" fill="#4a3b2c" />
        <circle cx="128" cy={frontY + 28} r="0.8" fill="#4a3b2c" />
      </g>

      {/* Tall Unit Upper Lofts */}
      {hasLoft && (
        <g>
          <rect x="22" y={frontY} width="110" height={loftH} fill={colours.frontEnd} stroke={colours.accent} strokeWidth="1" />
          <line x1="77" y1={frontY} x2="77" y2={frontY + loftH} stroke={colours.accent} strokeWidth="1" />
          <text x="77" y={frontY + Math.max(9, loftH / 2 + 3)} fill={colours.accent} fontSize="6" fontWeight="bold" textAnchor="middle" opacity="0.8">LOFT STORAGE</text>
        </g>
      )}

      {/* Kitchen Base Drawers Stack */}
      {hasDrawers && !isTall && !isWall && (
        <g>
          {/* Top Cutlery Drawer */}
          <rect x="24" y={frontY + 2} width="106" height={Math.round((frontH - 6) * 0.28)} rx="1.5" fill={colours.front} stroke={colours.accent} strokeWidth="0.8" />
          <line x1="28" y1={frontY + Math.round((frontH - 6) * 0.14)} x2="126" y2={frontY + Math.round((frontH - 6) * 0.14)} stroke={colours.accent} strokeWidth="1.5" strokeLinecap="round" />
          {/* Middle Utensil Drawer */}
          <rect x="24" y={frontY + Math.round((frontH - 6) * 0.32)} width="106" height={Math.round((frontH - 6) * 0.32)} rx="1.5" fill={colours.front} stroke={colours.accent} strokeWidth="0.8" />
          <line x1="28" y1={frontY + Math.round((frontH - 6) * 0.48)} x2="126" y2={frontY + Math.round((frontH - 6) * 0.48)} stroke={colours.accent} strokeWidth="1.5" strokeLinecap="round" />
          {/* Bottom Pot Drawer */}
          <rect x="24" y={frontY + Math.round((frontH - 6) * 0.66)} width="106" height={Math.round((frontH - 6) * 0.32)} rx="1.5" fill={colours.front} stroke={colours.accent} strokeWidth="0.8" />
          <line x1="28" y1={frontY + Math.round((frontH - 6) * 0.82)} x2="126" y2={frontY + Math.round((frontH - 6) * 0.82)} stroke={colours.accent} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}

      {/* Built-in Appliance Tower (Microwave + Oven) */}
      {hasAppliance && isTall && (
        <g>
          {/* Microwave Niche */}
          <rect x="26" y={frontY + loftH + 4} width="102" height="24" rx="2" fill="#18181b" stroke="#3f3f46" strokeWidth="1.2" />
          <rect x="30" y={frontY + loftH + 7} width="66" height="18" rx="1" fill="#09090b" stroke="#52525b" />
          <circle cx="112" cy={frontY + loftH + 12} r="2.5" fill="#ef4444" opacity="0.8" />
          <circle cx="112" cy={frontY + loftH + 20} r="3" fill="#a1a1aa" />
          {/* Convection Oven */}
          <rect x="26" y={frontY + loftH + 32} width="102" height="26" rx="2" fill="#18181b" stroke="#3f3f46" strokeWidth="1.2" />
          <rect x="30" y={frontY + loftH + 35} width="94" height="18" rx="1" fill="#27272a" stroke="#52525b" />
          <line x1="34" y1={frontY + loftH + 39} x2="120" y2={frontY + loftH + 39} stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}

      {/* Standard Shutter Doors */}
      {!hasDrawers && !hasAppliance && Array.from({ length: doors }).map((_, index) => {
        const x = 24 + index * doorW;
        const isGlassDoor = hasGlass && (index === doors - 1 || doors === 1);
        const shutterTop = frontY + (hasLoft ? loftH + 2 : 2);
        const shutterHeight = frontH - (hasLoft ? loftH + 4 : 4);

        return (
          <g key={index}>
            <rect
              x={x + 1}
              y={shutterTop}
              width={doorW - 2}
              height={shutterHeight}
              rx="1.5"
              fill={isGlassDoor ? 'url(#grad-glass)' : `url(#grad-front-${module.id})`}
              stroke={colours.accent}
              strokeWidth="1"
              strokeOpacity="0.6"
            />
            {/* Fluted / Profile Glass Reflections */}
            {isGlassDoor && (
              <g>
                <line x1={x + 4} y1={shutterTop + 10} x2={x + doorW - 6} y2={shutterTop + 10} stroke="#fef08a" strokeWidth="1.5" opacity="0.8" />
                <line x1={x + doorW / 2} y1={shutterTop + 6} x2={x + doorW / 2} y2={shutterTop + shutterHeight - 6} stroke="#ffffff" strokeWidth="1" opacity="0.6" />
                <line x1={x + 4} y1={shutterTop + shutterHeight / 2} x2={x + doorW - 6} y2={shutterTop + shutterHeight / 2} stroke="#ffffff" strokeWidth="1" opacity="0.6" />
              </g>
            )}
            {/* Long Profile Handle */}
            {!isGlassDoor && (
              <g>
                <line
                  x1={index % 2 === 0 ? x + doorW - 5 : x + 5}
                  y1={shutterTop + shutterHeight / 2 - 10}
                  x2={index % 2 === 0 ? x + doorW - 5 : x + 5}
                  y2={shutterTop + shutterHeight / 2 + 10}
                  stroke="#c59c2d"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </g>
            )}
          </g>
        );
      })}

      {/* LeMans Corner Carousel Trays */}
      {isCorner && (
        <g>
          <path d="M 35 75 Q 60 60 90 75 Q 110 88 85 102 Q 50 102 35 75 Z" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" opacity="0.9" />
          <circle cx="45" cy="80" r="3" fill="#c59c2d" />
        </g>
      )}

      {/* Stainless Steel Sink Basin on Base Unit */}
      {hasSink && (
        <g>
          <ellipse cx="77" cy={frontY - 5} rx="24" ry="7" fill="#e2e8f0" stroke="#64748b" strokeWidth="1.5" />
          <ellipse cx="64" cy={frontY - 5} rx="9" ry="4" fill="#cbd5e1" />
          <ellipse cx="88" cy={frontY - 5} rx="9" ry="4" fill="#cbd5e1" />
          {/* Chrome Mixer Faucet */}
          <path d="M 77 46 Q 77 34 83 34 Q 88 34 88 40" fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}

      {/* 4-Burner Glass Hob */}
      {hasHob && (
        <g>
          <rect x="50" y={frontY - 6} width="54" height="10" rx="2" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
          <circle cx="62" cy={frontY - 1} r="2.5" fill="#ef4444" opacity="0.8" />
          <circle cx="92" cy={frontY - 1} r="2.5" fill="#ef4444" opacity="0.8" />
        </g>
      )}

      {/* Washroom Overhead Shutter & Backlit Vanity Mirror */}
      {isWashroom && (
        <g>
          <rect x="30" y={frontY + 4} width="94" height="24" rx="2" fill="#eadecc" stroke="#a3896b" strokeWidth="1" />
          <ellipse cx="77" cy={frontY + 45} rx="16" ry="16" fill="#f8fafc" stroke="#c59c2d" strokeWidth="1.8" />
          <circle cx="77" cy={frontY + 45} r="13" fill="#e2e8f0" opacity="0.8" />
        </g>
      )}

      {/* Sacred Pooja Altar Insets */}
      {isPooja && (
        <g>
          <path d="M 52 75 V 58 C 52 46 77 40 77 28 C 77 40 102 46 102 58 V 75" fill="none" stroke="#c59c2d" strokeWidth="2.5" />
          <circle cx="77" cy="62" r="5" fill="#fef08a" stroke="#d97706" />
          <text x="77" y="65" fill="#92400e" fontSize="8" fontWeight="bold" textAnchor="middle">ॐ</text>
        </g>
      )}

      {/* Bottom Plinth / Skirting */}
      {!isWall && (
        <g>
          <rect x="20" y={frontY + frontH} width="114" height="5" rx="1" fill="#2b2017" stroke="#1c140d" strokeWidth="1" />
          <line x1="22" y1={frontY + frontH + 2} x2="132" y2={frontY + frontH + 2} stroke="#c59c2d" strokeWidth="0.8" opacity="0.6" />
        </g>
      )}
    </>
  );
}

function DetailedLivingPreview({ module, colours }: { module: ModulePreviewData; colours: (typeof paletteByFamily)['tv-unit'] }) {
  const isBed = module.family === 'bed';
  const isSofa = module.family === 'sofa';
  const isDining = module.family === 'dining';
  const isTv = module.family === 'tv-unit';
  const isFeatureWall = module.family === 'feature-wall';

  if (isBed) {
    return (
      <g>
        {/* Headboard */}
        <rect x="18" y="38" width="124" height="28" rx="4" fill={`url(#grad-front-${module.id})`} stroke={colours.accent} strokeWidth="1.5" />
        {/* Fluted Headboard Lines */}
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={i} x1={24 + i * 9.5} y1="40" x2={24 + i * 9.5} y2="64" stroke={colours.accent} strokeWidth="1" strokeOpacity="0.4" />
        ))}
        {/* Mattress Isometric Deck */}
        <polygon points="26,66 114,66 142,50 54,50" fill={`url(#grad-top-${module.id})`} stroke={colours.accent} strokeWidth="1.2" />
        <polygon points="26,66 114,66 114,106 26,106" fill={`url(#grad-front-${module.id})`} stroke={colours.accent} strokeWidth="1.2" />
        <polygon points="114,66 142,50 142,90 114,106" fill={`url(#grad-side-${module.id})`} />
        {/* Dual Pillows */}
        <rect x="36" y="54" width="34" height="14" rx="3" fill="#ffffff" stroke="#d5cbbe" strokeWidth="1" />
        <rect x="76" y="54" width="34" height="14" rx="3" fill="#ffffff" stroke="#d5cbbe" strokeWidth="1" />
        {/* Warm Underglow LED */}
        <path d="M 28 108 H 112" stroke="#fef08a" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
      </g>
    );
  }

  if (isSofa) {
    return (
      <g>
        {/* Sofa Backrest */}
        <rect x="24" y="44" width="104" height="32" rx="8" fill={`url(#grad-front-${module.id})`} stroke={colours.accent} strokeWidth="1.5" />
        {/* Sofa Armrests */}
        <rect x="18" y="56" width="16" height="42" rx="6" fill={`url(#grad-side-${module.id})`} stroke={colours.accent} strokeWidth="1.2" />
        <rect x="118" y="56" width="16" height="42" rx="6" fill={`url(#grad-side-${module.id})`} stroke={colours.accent} strokeWidth="1.2" />
        {/* Sofa Seat Cushions */}
        <polygon points="34,76 118,76 138,62 54,62" fill={`url(#grad-top-${module.id})`} />
        <polygon points="34,76 118,76 118,104 34,104" fill={`url(#grad-front-${module.id})`} stroke={colours.accent} strokeWidth="1.2" />
        <polygon points="118,76 138,62 138,90 118,104" fill={`url(#grad-side-${module.id})`} />
        <line x1="76" y1="76" x2="76" y2="104" stroke={colours.accent} strokeWidth="1.5" />
      </g>
    );
  }

  if (isDining) {
    return (
      <g>
        {/* Marble Table Top */}
        <polygon points="30,56 122,56 144,44 52,44" fill={`url(#grad-top-${module.id})`} stroke="#c59c2d" strokeWidth="1.5" />
        <polygon points="30,56 122,56 122,64 30,64" fill={`url(#grad-front-${module.id})`} stroke="#c59c2d" strokeWidth="1" />
        {/* Dual Fluted Pedestal Columns */}
        <rect x="48" y="64" width="18" height="46" rx="3" fill={`url(#grad-front-${module.id})`} stroke={colours.accent} strokeWidth="1.2" />
        <rect x="94" y="64" width="18" height="46" rx="3" fill={`url(#grad-front-${module.id})`} stroke={colours.accent} strokeWidth="1.2" />
        {/* Dining Chairs */}
        <rect x="14" y="62" width="14" height="28" rx="3" fill="#b45309" stroke="#78350f" />
        <rect x="132" y="62" width="14" height="28" rx="3" fill="#b45309" stroke="#78350f" />
      </g>
    );
  }

  // TV Unit / Feature Wall
  return (
    <g>
      {/* Back Wall Panel */}
      <rect x="18" y="20" width="124" height="84" rx="3" fill={`url(#grad-front-${module.id})`} stroke={colours.accent} strokeWidth="1.5" />
      {/* Acoustic Vertical Slats / Flutes */}
      {Array.from({ length: 14 }).map((_, i) => (
        <line key={i} x1={24 + i * 8.2} y1="22" x2={24 + i * 8.2} y2="102" stroke="#c59c2d" strokeWidth="1.2" strokeOpacity="0.35" />
      ))}
      {/* TV Screen Profile */}
      <rect x="36" y="34" width="60" height="36" rx="2" fill="#09090b" stroke="#27272a" strokeWidth="1.5" />
      <rect x="39" y="37" width="54" height="30" rx="1" fill="#18181b" stroke="#3f3f46" />
      {/* Profile Glass Display Tower */}
      <rect x="104" y="26" width="30" height="74" rx="2" fill="url(#grad-glass)" stroke="#c59c2d" strokeWidth="1.2" />
      <line x1="106" y1="46" x2="132" y2="46" stroke="#fef08a" strokeWidth="1.5" opacity="0.8" />
      <line x1="106" y1="70" x2="132" y2="70" stroke="#fef08a" strokeWidth="1.5" opacity="0.8" />
      {/* Floating Media Console with 3 Drawers */}
      <rect x="18" y="90" width="124" height="24" rx="2" fill="#1c1917" stroke="#c59c2d" strokeWidth="1.2" />
      <line x1="59" y1="90" x2="59" y2="114" stroke="#44403c" strokeWidth="1" />
      <line x1="100" y1="90" x2="100" y2="114" stroke="#44403c" strokeWidth="1" />
      <line x1="24" y1="117" x2="136" y2="117" stroke="#fef08a" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
    </g>
  );
}

export function ModulePreview({ module, compact = false, style, defaultView = 'vector' }: Props) {
  const [viewMode, setViewMode] = useState<'vector' | 'real'>(defaultView);
  const colours = paletteByFamily[module.family] ?? paletteByFamily.storage;
  const isLivingOrFurniture = ['tv-unit', 'bed', 'sofa', 'dining', 'feature-wall'].includes(module.family);
  // Prefer 3D render if available, then custom photoUrl, then real-life reference vault photo
  const photo = MODULE_3D_BY_FAMILY[module.family] ?? module.photoUrl ?? REAL_LIFE_PHOTO_BY_FAMILY[module.family] ?? '/reference-vault/013-52a29a1053dc.png';
  const has3D = Boolean(MODULE_3D_BY_FAMILY[module.family] ?? module.photoUrl);

  return (
    <div className={`module-preview${compact ? ' compact' : ''}`} style={{ position: 'relative', overflow: 'hidden', ...style }} aria-label={`${module.name} architectural preview`} role="img">
      {/* Quick 2D CAD vs Real-Life View Switcher */}
      <div
        style={{
          position: 'absolute',
          top: 4,
          left: 4,
          zIndex: 10,
          display: 'flex',
          gap: 2,
          background: 'rgba(28, 25, 23, 0.85)',
          backdropFilter: 'blur(4px)',
          borderRadius: 14,
          padding: '2px 4px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setViewMode('vector')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '2px 6px',
            fontSize: '9px',
            fontWeight: 800,
            borderRadius: 10,
            border: 0,
            background: viewMode === 'vector' ? 'var(--gold, #c59c2d)' : 'transparent',
            color: viewMode === 'vector' ? '#1c1917' : '#d6d3d1',
            cursor: 'pointer',
          }}
          title="2D Architectural Elevation & Millimeter Geometry"
        >
          <Layers size={10} /> 2D
        </button>
        <button
          type="button"
          onClick={() => setViewMode('real')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '2px 6px',
            fontSize: '9px',
            fontWeight: 800,
            borderRadius: 10,
            border: 0,
            background: viewMode === 'real' ? 'var(--gold, #c59c2d)' : 'transparent',
            color: viewMode === 'real' ? '#1c1917' : '#d6d3d1',
            cursor: 'pointer',
          }}
          title={has3D ? '3D Product Render — AI Generated' : 'Real-Life Installed Photography & Luxury Finish'}
        >
          <Camera size={10} /> {has3D ? '3D' : 'Real'}
        </button>
      </div>

      {viewMode === 'real' ? (
        <div style={{ width: '100%', height: '100%', minHeight: compact ? 80 : 120, position: 'relative', background: has3D ? '#f8f6f2' : '#000', borderRadius: 6, overflow: 'hidden' }}>
          <img
            src={photo}
            alt={`${module.name} product render`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: has3D ? 'contain' : 'cover',
              display: 'block',
              borderRadius: 6,
              padding: has3D ? '4px' : 0,
            }}
          />
          {/* Overlay — dark for real-life photos, minimal badge for 3D renders */}
          {has3D ? (
            <div style={{
              position: 'absolute', bottom: 4, right: 6,
              background: 'rgba(197,156,45,0.9)', color: '#1c1917',
              fontSize: '8px', fontWeight: 800, borderRadius: 6, padding: '2px 6px',
              letterSpacing: '.04em',
            }}>
              3D RENDER · {module.widthMm}mm
            </div>
          ) : (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
              padding: '6px 8px 4px', color: '#fff', fontSize: '10px', fontWeight: 700,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>{module.name}</span>
              <span style={{ fontSize: '9px', opacity: 0.9, color: 'var(--gold-dim, #e8c96a)' }}>{module.widthMm}×{module.heightMm}</span>
            </div>
          )}
        </div>
      ) : (
        <svg viewBox="0 0 168 138" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style={{ background: 'transparent', width: '100%', height: '100%' }}>
          <defs>
            {/* Gradients */}
            <linearGradient id={`grad-front-${module.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colours.front} />
              <stop offset="100%" stopColor={colours.frontEnd} />
            </linearGradient>
            <linearGradient id={`grad-top-${module.id}`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={colours.top} />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>
            <linearGradient id={`grad-side-${module.id}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={colours.side} />
              <stop offset="100%" stopColor={colours.frontEnd} />
            </linearGradient>
            <linearGradient id="grad-glass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(40, 65, 75, 0.75)" />
              <stop offset="100%" stopColor="rgba(20, 35, 42, 0.88)" />
            </linearGradient>
            {/* Glossy Reflection Highlight */}
            <linearGradient id={`grad-gloss-${module.id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.4)" />
              <stop offset="35%" stopColor="rgba(255, 255, 255, 0.08)" />
              <stop offset="70%" stopColor="transparent" />
            </linearGradient>
            {/* Drop Shadows */}
            <filter id={`shadow-${module.id}`} x="-20%" y="-20%" width="150%" height="150%">
              <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#1c140d" floodOpacity="0.28" />
            </filter>
          </defs>

          {/* Subtle Architectural Floor Grid */}
          <g opacity="0.15">
            <line x1="16" y1="126" x2="152" y2="126" stroke="#8c7355" strokeWidth="0.8" />
            <line x1="30" y1="120" x2="160" y2="120" stroke="#8c7355" strokeWidth="0.6" strokeDasharray="3 3" />
          </g>

          <g filter={`url(#shadow-${module.id})`}>
            {isLivingOrFurniture ? (
              <DetailedLivingPreview module={module} colours={colours as any} />
            ) : (
              <DetailedCabinet module={module} colours={colours} />
            )}
          </g>

          {/* Top Header Title & Dimension Badges */}
          <g style={{ pointerEvents: 'none' }}>
            <rect x="98" y="4" width="62" height="15" rx="4" fill="#ffffff" stroke="#e7dcce" strokeWidth="1" />
            <text x="129" y="15" fill="#695748" fontSize="7" fontWeight="bold" textAnchor="middle">
              {module.widthMm} × {module.heightMm} mm
            </text>
          </g>
        </svg>
      )}
    </div>
  );
}
