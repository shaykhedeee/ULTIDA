import type { CSSProperties } from 'react';
import './module-preview.css';

export type ModulePreviewData = {
  id: string;
  family: string;
  name: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  tags?: string[];
};

type Props = { module: ModulePreviewData; compact?: boolean; style?: CSSProperties };

const paletteByFamily: Record<string, { front: string; side: string; top: string; accent: string }> = {
  'kitchen-base': { front: '#d8c7b5', side: '#b9a38e', top: '#f3eee5', accent: '#8a6244' },
  'kitchen-wall': { front: '#d6d8cf', side: '#a9aea1', top: '#f1f2eb', accent: '#777e70' },
  'kitchen-tall': { front: '#cbd2c2', side: '#9ca994', top: '#eff1e8', accent: '#5f7259' },
  'kitchen-corner': { front: '#d4c5b2', side: '#ad977d', top: '#f3ede3', accent: '#8b6746' },
  wardrobe: { front: '#d9d0c5', side: '#a99b8d', top: '#f3eee8', accent: '#706154' },
  'tv-unit': { front: '#cab79e', side: '#9d8263', top: '#eee7dc', accent: '#3f3027' },
  crockery: { front: '#d8d2c7', side: '#a9a093', top: '#f4f1eb', accent: '#9c7652' },
  pooja: { front: '#e2d1a9', side: '#b99a62', top: '#f7efd9', accent: '#9b6b24' },
  study: { front: '#d1c0aa', side: '#a48d70', top: '#eee7dc', accent: '#70523b' },
  utility: { front: '#cbd1d0', side: '#98a4a2', top: '#edf1f0', accent: '#5b7472' },
  storage: { front: '#d5cec4', side: '#a59b8d', top: '#f0ece6', accent: '#70665a' },
  bed: { front: '#c9b5a3', side: '#96775e', top: '#ece3da', accent: '#674b39' },
  sofa: { front: '#aeb8af', side: '#7e8d82', top: '#dbe0da', accent: '#4f6255' },
  dining: { front: '#c39e76', side: '#8e684c', top: '#ead7c2', accent: '#63452f' },
  'false-ceiling': { front: '#e9e7e2', side: '#bcb9b1', top: '#ffffff', accent: '#b18a42' },
  'feature-wall': { front: '#2e3338', side: '#1f2327', top: '#454c52', accent: '#d4af37' },
};

function Cabinet({ module, colours }: { module: ModulePreviewData; colours: { front: string; side: string; top: string; accent: string } }) {
  if (module.family === 'crockery') {
    const wide = module.widthMm >= 1800;
    const fullHeight = module.heightMm >= 2300;
    const tags = `${module.name} ${(module.tags ?? []).join(' ')}`.toLowerCase();
    const fluted = /fluted|slatted|ribbed/.test(tags);
    const barNiche = /bar|sideboard|buffet/.test(tags);
    return <>
      <rect x="22" y={fullHeight ? 19 : 30} width="112" height={fullHeight ? 100 : 87} rx="3" fill={colours.front} />
      <polygon points={`${134},${fullHeight ? 19 : 30} 146,${fullHeight ? 8 : 19} 146,${fullHeight ? 108 : 117} 134,${fullHeight ? 119 : 117}`} fill={colours.side} />
      <polygon points={`${22},${fullHeight ? 19 : 30} 134,${fullHeight ? 19 : 30} 146,${fullHeight ? 8 : 19} 35,${fullHeight ? 8 : 19}`} fill={colours.top} />
      {fullHeight && <rect x="25" y="23" width="106" height="17" rx="1" fill={colours.top} opacity=".82" />}
      <rect x={wide ? 31 : 40} y={fullHeight ? 44 : 39} width={wide ? 59 : 47} height="48" rx="2" fill="#6d8b91" opacity=".68" stroke={colours.accent} strokeWidth="1.4" />
      <line x1={wide ? 50 : 55} y1={fullHeight ? 46 : 41} x2={wide ? 50 : 55} y2="90" stroke="#eff7f4" strokeWidth="1.2" />
      <line x1={wide ? 31 : 40} y1="59" x2={wide ? 90 : 87} y2="59" stroke="#eff7f4" strokeWidth="1.2" />
      <line x1={wide ? 31 : 40} y1="75" x2={wide ? 90 : 87} y2="75" stroke="#eff7f4" strokeWidth="1.2" />
      <rect x={wide ? 96 : 94} y={fullHeight ? 44 : 39} width={wide ? 31 : 27} height="48" rx="2" fill={colours.top} />
      <path d={wide ? 'M98 85 Q111 66 125 85' : 'M96 85 Q107 66 120 85'} fill="none" stroke={colours.accent} strokeWidth="2" />
      <rect x="22" y="94" width="112" height="24" rx="2" fill={colours.front} />
      <line x1="59" y1="94" x2="59" y2="118" stroke={colours.accent} strokeOpacity=".45" />
      <line x1="96" y1="94" x2="96" y2="118" stroke={colours.accent} strokeOpacity=".45" />
      {fluted && Array.from({ length: 8 }).map((_, index) => <line key={index} x1={27 + index * 13} y1="97" x2={27 + index * 13} y2="115" stroke={colours.accent} strokeOpacity=".35" strokeWidth="1.2" />)}
      {barNiche && <rect x="99" y="98" width="25" height="14" rx="1" fill="#4e3830" opacity=".7" />}
      <rect x="20" y="118" width="116" height="4" rx="1" fill={colours.accent} opacity=".72" />
    </>;
  }
  const isTall = module.family === 'wardrobe' || module.family === 'kitchen-tall' || module.family === 'utility' || module.family === 'storage';
  const isWall = module.family === 'kitchen-wall';
  const hasGlass = module.family === 'crockery' || module.tags?.some((tag) => /glass|display/i.test(tag));
  const hasSink = /sink/i.test(module.name);
  const isPooja = module.family === 'pooja';
  const frontY = isTall ? 23 : isWall ? 31 : 58;
  const frontH = isTall ? 99 : isWall ? 70 : 58;
  const doors = module.widthMm >= 1100 ? 3 : 2;
  const doorW = 106 / doors;
  return <>
    <polygon points={`24,${frontY} 130,${frontY} 143,${frontY - 12} 38,${frontY - 12}`} fill={colours.top} />
    <polygon points={`130,${frontY} 143,${frontY - 12} 143,${frontY + frontH - 12} 130,${frontY + frontH}`} fill={colours.side} />
    <rect x="24" y={frontY} width="106" height={frontH} rx="2" fill={colours.front} />
    {isTall && <rect x="24" y={frontY} width="106" height="18" fill={colours.top} opacity=".85" />}
    {Array.from({ length: doors }).map((_, index) => {
      const x = 24 + index * doorW;
      return <g key={index}>
        <rect x={x + 2} y={frontY + (isTall ? 21 : 3)} width={doorW - 4} height={frontH - (isTall ? 24 : 6)} rx="1.5" fill={hasGlass && index === doors - 1 ? '#71909a' : colours.front} opacity={hasGlass && index === doors - 1 ? '.6' : '1'} stroke={colours.accent} strokeOpacity=".28" />
        {hasGlass && index === doors - 1 && <><line x1={x + doorW / 2} y1={frontY + 24} x2={x + doorW / 2} y2={frontY + frontH - 5} stroke="#ecf4f3" strokeOpacity=".8" /><line x1={x + 4} y1={frontY + 50} x2={x + doorW - 4} y2={frontY + 50} stroke="#ecf4f3" strokeOpacity=".8" /></>}
        {!hasGlass && <line x1={x + doorW - 5} y1={frontY + frontH / 2 - 8} x2={x + doorW - 5} y2={frontY + frontH / 2 + 8} stroke={colours.accent} strokeWidth="1.6" strokeLinecap="round" opacity=".65" />}
      </g>;
    })}
    {!isTall && !isWall && <rect x="22" y={frontY + frontH} width="111" height="5" rx="1" fill={colours.accent} opacity=".8" />}
    {hasSink && <ellipse cx="77" cy={frontY - 4} rx="23" ry="6" fill="#85796b" opacity=".95" />}
    {isPooja && <><path d="M52 85 V65 C52 51 75 45 75 32 C75 45 98 51 98 65 V85" fill="none" stroke={colours.accent} strokeWidth="3" /><circle cx="75" cy="70" r="5" fill="#fff3c9" /></>}
  </>;
}

function LivingPreview({ module, colours }: { module: ModulePreviewData; colours: { front: string; side: string; top: string; accent: string } }) {
  if (module.family === 'bed') return <><polygon points="28,74 110,74 135,58 53,58" fill={colours.top} /><polygon points="28,74 110,74 110,108 28,108" fill={colours.front} /><polygon points="110,74 135,58 135,92 110,108" fill={colours.side} /><rect x="42" y="64" width="34" height="15" rx="4" fill="#f7f3ec" /><rect x="78" y="64" width="25" height="15" rx="4" fill="#f7f3ec" /><rect x="20" y="46" width="90" height="18" rx="4" fill={colours.accent} opacity=".85" /></>;
  if (module.family === 'sofa') return <><polygon points="33,77 112,77 136,62 57,62" fill={colours.top} /><polygon points="33,77 112,77 112,106 33,106" fill={colours.front} /><polygon points="112,77 136,62 136,91 112,106" fill={colours.side} /><rect x="29" y="49" width="84" height="34" rx="8" fill={colours.front} /><rect x="22" y="67" width="18" height="31" rx="7" fill={colours.front} /><rect x="104" y="66" width="18" height="31" rx="7" fill={colours.front} /></>;
  if (module.family === 'dining') return <><polygon points="36,58 112,58 132,46 56,46" fill={colours.top} /><polygon points="36,58 112,58 112,64 36,64" fill={colours.front} /><line x1="46" y1="64" x2="39" y2="110" stroke={colours.side} strokeWidth="5" /><line x1="103" y1="64" x2="112" y2="110" stroke={colours.side} strokeWidth="5" /><rect x="18" y="72" width="16" height="25" rx="3" fill={colours.front} /><rect x="119" y="64" width="16" height="25" rx="3" fill={colours.front} /><rect x="56" y="89" width="16" height="25" rx="3" fill={colours.front} /><rect x="91" y="84" width="16" height="25" rx="3" fill={colours.front} /></>;
  const tvWide = module.widthMm >= 2200;
  const displayTower = /profile|display|crockery|asymmetric|full-wall/i.test(module.name);
  const fullWall = /full-wall|asymmetric|crockery/i.test(module.name);
  const floating = /floating/i.test(module.name);
  const tags = `${module.name} ${(module.tags ?? []).join(' ')}`.toLowerCase();
  const fluted = /fluted|slatted|ribbed/.test(tags);
  const partition = /partition|divider/.test(tags);
  const studySurface = /study|desk|workstation/.test(tags);
  const archNiche = /arch|arched|niche/.test(tags);
  const libraryWall = /library/.test(tags);
  return <>
    <rect x="20" y={fullWall ? 17 : 25} width="118" height={fullWall ? 95 : 81} rx="3" fill={colours.top} />
    {fullWall && <rect x="23" y="20" width="112" height="16" rx="1" fill={colours.front} opacity=".85" />}
    <rect x={displayTower ? 34 : 39} y={fullWall ? 43 : 40} width={displayTower ? 48 : tvWide ? 55 : 43} height="32" rx="2" fill="#202b2d" />
    <rect x={displayTower ? 37 : 42} y={fullWall ? 46 : 43} width={displayTower ? 42 : tvWide ? 49 : 37} height="26" rx="1" fill="#6f8887" />
    {displayTower && <><rect x="94" y={fullWall ? 39 : 31} width="29" height="52" rx="2" fill="#6e939b" opacity=".68" stroke={colours.accent} /><line x1="108.5" y1={fullWall ? 41 : 33} x2="108.5" y2="88" stroke="#f3faf8" /><line x1="96" y1="61" x2="121" y2="61" stroke="#f3faf8" /></>}
    {fullWall && <rect x="23" y="40" width="8" height="51" fill={colours.front} opacity=".88" />}
    {fluted && Array.from({ length: 9 }).map((_, index) => <line key={index} x1={25 + index * 8} y1={fullWall ? 40 : 30} x2={25 + index * 8} y2={fullWall ? 90 : 84} stroke={colours.accent} strokeOpacity=".28" />)}
    {partition && <><rect x="24" y="37" width="9" height="54" fill={colours.accent} opacity=".6" />{Array.from({ length: 4 }).map((_, index) => <line key={index} x1={25 + index * 2.2} y1="39" x2={25 + index * 2.2} y2="88" stroke="#f7f3eb" strokeOpacity=".55" strokeWidth=".8" />)}</>}
    {archNiche && <path d="M48 79 V58 C48 39 102 30 102 58 V79" fill="none" stroke={colours.accent} strokeWidth="4" opacity=".76" />}
    {libraryWall && Array.from({ length: 4 }).map((_, index) => <rect key={index} x={24 + index * 8} y={fullWall ? 42 : 35} width="4" height="40" rx="1" fill={colours.accent} opacity=".56" />)}
    <rect x="20" y={floating ? 97 : 91} width="118" height="24" rx="2" fill={colours.front} />
    <polygon points={`138,${floating ? 97 : 91} 149,${floating ? 86 : 80} 149,${floating ? 104 : 104} 138,115`} fill={colours.side} />
    <line x1="59" y1={floating ? 97 : 91} x2="59" y2="115" stroke={colours.accent} strokeOpacity=".45" />
    <line x1="98" y1={floating ? 97 : 91} x2="98" y2="115" stroke={colours.accent} strokeOpacity=".45" />
    {floating && <path d="M27 119 H132" stroke="#d8a94b" strokeWidth="2" strokeLinecap="round" opacity=".8" />}
    {studySurface && <><rect x="91" y="75" width="37" height="5" rx="1" fill={colours.top} /><line x1="96" y1="80" x2="96" y2="91" stroke={colours.side} strokeWidth="2" /><line x1="123" y1="80" x2="123" y2="91" stroke={colours.side} strokeWidth="2" /></>}
  </>;
}

export function ModulePreview({ module, compact = false, style }: Props) {
  const colours = paletteByFamily[module.family] ?? paletteByFamily.storage;
  const isFurniture = ['tv-unit', 'bed', 'sofa', 'dining'].includes(module.family);
  const label = `${module.name}: dimensional 3D preview`;
  return <div className={`module-preview${compact ? ' compact' : ''}`} style={style} aria-label={label} role="img">
    <svg viewBox="0 0 168 138" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style={{ background: 'transparent' }}>
      <defs>
        <filter id={`shadow-${module.id}`} x="-20%" y="-20%" width="150%" height="150%"><feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#3d2a1a" floodOpacity=".20" /></filter>
      </defs>
      <g filter={`url(#shadow-${module.id})`}>{isFurniture ? <LivingPreview module={module} colours={colours} /> : <Cabinet module={module} colours={colours} />}</g>
      <text x="12" y="16" fill="#8c7a6b" fontSize="8" fontWeight="800" letterSpacing=".9">{module.family.replaceAll('-', ' ').toUpperCase()}</text>
    </svg>
  </div>;
}
