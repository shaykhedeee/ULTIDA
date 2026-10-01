import { BookOpen, Library as LibraryIcon, Loader2, Palette, Search, Upload, Sparkles, Plus, Trash2, Layers, Move, Download, Layout, Check, ArrowRight, Home, Camera } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Badge, Card, CardContent, CardHeader } from '../ui/primitives';
import { supabase } from '../../lib/supabase';
import { getApiBase } from '../../lib/api-base';
import { ModulePreview } from './ModulePreview';
import ResearchSourcingPanel from './ResearchSourcingPanel';
import { RECENT_REFERENCE_GALLERY, REFERENCE_SPACE_LABELS, referenceDisplayTitle, referenceFocus, type RecentGalleryReference } from './recent-reference-gallery';
import './reference-library.css';

type LibraryItem = {
  id: string;
  title: string;
  kind: string;
  tags: string[];
  notes: string;
  source: string;
  metadata: { previewUrl?: string };
  asset?: { storage_path: string; mime_type: string } | null;
};
type VaultEntry = { id: string; title: string; source_path: string; room: string; module_family: string; style: string; material_tags?: string[]; review_state: string; sha256: string; metadata: Record<string, unknown> };

type CatalogModule = {
  id: string;
  family: string;
  name: string;
  roomTypes: string[];
  widthMm: number;
  depthMm: number;
  heightMm: number;
  sku: string;
  tags: string[];
  description?: string;
  manufacturingRules?: string[];
  production: { cutlistSupported: boolean };
  digitalTwin?: { catalogVersion: string; geometryKey: string; productionKey: string };
};

type Material = {
  id: string;
  name: string;
  code: string;
  category: string;
  supplier?: string | null;
  finish?: string | null;
  availability?: string | null;
  thickness_mm?: number | null;
  edge_band_thickness_mm?: number | null;
  edge_band_material?: string | null;
  edge_band_status?: string | null;
  metadata?: {
    colourHex?: string;
    colorHex?: string;
    texture?: string;
    laminateFace?: string;
    availabilityVerifiedAt?: string;
    stockVerifiedAt?: string;
    supplierVerifiedAt?: string;
  } | null;
};

export type MoodboardItem = {
  id: string;
  type: 'module' | 'material' | 'swatch' | 'reference';
  title: string;
  subtitle?: string;
  colorHex?: string;
  image?: string;
  module?: CatalogModule;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
};

type MoodboardDraft = { items: MoodboardItem[]; background: 'linen' | 'clay' | 'dark' | 'white' };
function moodboardStorageKey(projectId?: string | null) {
  return projectId ? `ultida.moodboard.${projectId}.v1` : 'ultida.moodboard.studio.v1';
}
function readMoodboardDraft(projectId?: string | null): MoodboardDraft {
  const fallback = { items: MOODBOARD_PRESETS.living, background: 'linen' as const };
  if (typeof window === 'undefined') return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(moodboardStorageKey(projectId)) ?? 'null');
    if (!parsed || !Array.isArray(parsed.items)) return fallback;
    const items = parsed.items.filter((item: unknown): item is MoodboardItem => {
      if (!item || typeof item !== 'object') return false;
      const value = item as MoodboardItem;
      return typeof value.id === 'string' && typeof value.title === 'string'
        && ['module', 'material', 'swatch', 'reference'].includes(value.type)
        && [value.x, value.y, value.width, value.height, value.zIndex].every(Number.isFinite)
        && value.width > 0 && value.height > 0;
    });
    const background = ['linen', 'clay', 'dark', 'white'].includes(parsed.background) ? parsed.background : 'linen';
    return { items, background };
  } catch {
    return fallback;
  }
}

const MOODBOARD_PRESETS: Record<string, MoodboardItem[]> = {
  living: [
    { id: 'mb-tv', type: 'module', title: 'Fluted TV Wall (2400mm)', subtitle: 'Floating console with warm LED', x: 40, y: 40, width: 280, height: 180, zIndex: 2, module: { id: 'tv-fluted-2400', family: 'tv-unit', name: '2400 fluted media wall with floating console', roomTypes: ['living'], widthMm: 2400, depthMm: 400, heightMm: 2400, sku: 'ULT-TV-FLT-2400', tags: ['tv-wall', 'fluted'], production: { cutlistSupported: true } } },
    { id: 'mb-sofa', type: 'module', title: 'Curved Bouclé Sectional', subtitle: 'Sculptural organic contours in soft sand', x: 360, y: 50, width: 280, height: 170, zIndex: 1, module: { id: 'sofa-curved-boucle-2800', family: 'sofa', name: '2800 curved bouclé sectional sofa', roomTypes: ['living'], widthMm: 2800, depthMm: 1600, heightMm: 800, sku: 'ULT-SF-CRV-2800', tags: ['sofa', 'sectional', 'boucle'], production: { cutlistSupported: false } } },
    { id: 'mb-mat1', type: 'swatch', title: 'Smoked Oak Veneer', subtitle: 'Feature wall accent', colorHex: '#5A473B', x: 60, y: 250, width: 140, height: 100, zIndex: 3 },
    { id: 'mb-mat2', type: 'swatch', title: 'Botticino Marble', subtitle: 'Tabletop & floor sheen', colorHex: '#E8DFD0', x: 220, y: 250, width: 140, height: 100, zIndex: 4 },
    { id: 'mb-mat3', type: 'swatch', title: 'Brushed Brass PVD', subtitle: 'Hardware & trim metal', colorHex: '#C59C2D', x: 380, y: 250, width: 140, height: 100, zIndex: 5 },
  ],
  bedroom: [
    { id: 'mb-bed', type: 'module', title: 'Floating King Storage Bed', subtitle: '1800×2100mm with fluted headboard', x: 50, y: 40, width: 280, height: 180, zIndex: 2, module: { id: 'bed-floating-led-1800', family: 'bed', name: '1800 floating king bed with concealed LED', roomTypes: ['bedroom'], widthMm: 1800, depthMm: 2100, heightMm: 1100, sku: 'ULT-BD-FLT-1800', tags: ['bed', 'floating', 'hydraulic'], production: { cutlistSupported: true } } },
    { id: 'mb-wd', type: 'module', title: 'Profile-Glass Walk-In Closet', subtitle: 'Tinted fluted glass with sensor lighting', x: 360, y: 40, width: 270, height: 200, zIndex: 1, module: { id: 'wardrobe-walkin-glass-3000', family: 'wardrobe', name: '3000 profile-glass walk-in closet', roomTypes: ['bedroom'], widthMm: 3000, depthMm: 600, heightMm: 2700, sku: 'ULT-WD-WIK-3000', tags: ['wardrobe', 'walk-in', 'glass'], production: { cutlistSupported: true } } },
    { id: 'mb-mat4', type: 'swatch', title: 'Blush Ivory Linen', subtitle: 'Internal carcass fabric', colorHex: '#E8D9CC', x: 60, y: 250, width: 140, height: 100, zIndex: 3 },
    { id: 'mb-mat5', type: 'swatch', title: 'Natural Oak Grain', subtitle: 'External shutter laminate', colorHex: '#A77B5B', x: 220, y: 250, width: 140, height: 100, zIndex: 4 },
  ],
  dining: [
    { id: 'mb-dn', type: 'module', title: 'Calacatta Gold Dining Table', subtitle: '2100mm marble slab on fluted pedestals', x: 50, y: 40, width: 280, height: 180, zIndex: 2, module: { id: 'dining-calacatta-gold-2100', family: 'dining', name: '2100 Calacatta gold marble dining table', roomTypes: ['dining'], widthMm: 2100, depthMm: 1000, heightMm: 750, sku: 'ULT-DN-CAL-2100', tags: ['dining', 'marble'], production: { cutlistSupported: false } } },
    { id: 'mb-cr', type: 'module', title: 'Crockery & Bar Unit', subtitle: '1800mm display with fluted glass & bar niche', x: 360, y: 40, width: 260, height: 200, zIndex: 1, module: { id: 'crockery-1800', family: 'crockery', name: '1800 full-wall crockery and bar', roomTypes: ['dining'], widthMm: 1800, depthMm: 450, heightMm: 2400, sku: 'ULT-CR-1800', tags: ['crockery', 'bar'], production: { cutlistSupported: true } } },
    { id: 'mb-mat6', type: 'swatch', title: 'Calacatta Vein Marble', subtitle: 'Table surface', colorHex: '#F0EFE9', x: 60, y: 250, width: 140, height: 100, zIndex: 3 },
    { id: 'mb-mat7', type: 'swatch', title: 'Smoked Walnut Finish', subtitle: 'Pedestal base & cabinetry', colorHex: '#453326', x: 220, y: 250, width: 140, height: 100, zIndex: 4 },
  ],
};

const MODULE_REFERENCE_IMAGES: Record<string, string[]> = {
  kitchen: ['/reference-vault/003-1f61a8aabde4.png', '/reference-vault/006-e36e2c7c9b1a.png', '/reference-vault/039-1786da704c5a.png', '/reference-vault/042-7eaf3dbfd306.png', '/reference-vault/048-ac94a44309b6.png', '/reference-vault/050-a2b533693ac2.png', '/reference-vault/052-1d6904ef55a3.png', '/reference-vault/053-edfb0eca9b46.png', '/reference-vault/055-e94b19f0e93f.png', '/reference-vault/056-3bb2275767d2.png', '/reference-vault/057-da6cb4575090.png', '/reference-vault/059-28205fff47ae.png'],
  'kitchen-base': ['/reference-vault/006-e36e2c7c9b1a.png', '/reference-vault/039-1786da704c5a.png', '/reference-vault/042-7eaf3dbfd306.png', '/reference-vault/050-a2b533693ac2.png', '/reference-vault/053-edfb0eca9b46.png', '/reference-vault/055-e94b19f0e93f.png', '/reference-vault/057-da6cb4575090.png'],
  'kitchen-wall': ['/reference-vault/006-e36e2c7c9b1a.png', '/reference-vault/039-1786da704c5a.png', '/reference-vault/050-a2b533693ac2.png', '/reference-vault/053-edfb0eca9b46.png'],
  'kitchen-tall': ['/reference-vault/003-1f61a8aabde4.png', '/reference-vault/048-ac94a44309b6.png', '/reference-vault/052-1d6904ef55a3.png', '/reference-vault/056-3bb2275767d2.png', '/reference-vault/059-28205fff47ae.png'],
  'kitchen-corner': ['/reference-vault/042-7eaf3dbfd306.png', '/reference-vault/055-e94b19f0e93f.png', '/reference-vault/057-da6cb4575090.png'],
  'tv-unit': ['/reference-vault/013-52a29a1053dc.png', '/reference-vault/014-685f67e3ff6f.png', '/reference-vault/015-5705e2ee9cb1.png', '/reference-vault/016-f106846da92c.png', '/reference-vault/017-cd2b9919c856.png', '/reference-vault/026-ebca5fba9a3f.png', '/reference-vault/051-999d353af1d8.png', '/reference-vault/058-b3d36c0c874b.png'],
  wardrobe: ['/reference-vault/007-2b9d568ff444.png', '/reference-vault/008-5fd497f005d8.png', '/reference-vault/009-f68e47674ead.png', '/reference-vault/010-a0dbdf361a50.png', '/reference-vault/012-5c60a01e5b86.png', '/reference-vault/023-ae1e9b70744f.png', '/reference-vault/025-adb09122c8d1.png', '/reference-vault/035-78733d79d595.png', '/reference-vault/038-73c6d08adf93.png', '/reference-vault/040-a7dcd66e4242.png', '/reference-vault/041-6770bf54ce43.png', '/reference-vault/043-71833d244d0d.png', '/reference-vault/044-577ed741688e.png', '/reference-vault/045-7ec65f321496.png', '/reference-vault/054-c8fa00bd2c4b.png'],
  crockery: ['/reference-vault/002-cab37cfa0bb2.png', '/reference-vault/004-ee04b56efde7.png', '/reference-vault/018-b7dd5f1492fe.png'],
  sofa: ['/reference-vault/001-ddc1891636f7.png', '/reference-vault/034-355f624f691c.png'],
  bed: ['/reference-vault/047-c1ce4511e83d.png', '/reference-vault/049-d1a18590223e.png', '/reference-vault/060-70075531f7e7.png'],
  dining: ['/reference-vault/002-cab37cfa0bb2.png', '/reference-vault/004-ee04b56efde7.png', '/reference-vault/018-b7dd5f1492fe.png'],
  pooja: ['/reference-vault/019-a06a89855436.png', '/reference-vault/020-ea872c640df6.png', '/reference-vault/021-5a47b71bad49.png'],
  study: ['/reference-vault/011-6c55d3439149.png', '/reference-vault/022-d6f4e9ee57d1.png', '/reference-vault/024-5976bb27ca03.png', '/reference-vault/033-9d09b620a75e.png', '/reference-vault/044-577ed741688e.png', '/reference-vault/054-c8fa00bd2c4b.png'],
  utility: ['/reference-vault/005-7919b88e0dc1.png', '/reference-vault/036-de959cf3df44.png'],
  bathroom: ['/reference-vault/027-3ee9dcdaca5c.png', '/reference-vault/028-a8f62ab3d392.png', '/reference-vault/029-640527178f8d.png'],
  vanity: ['/reference-vault/027-3ee9dcdaca5c.png', '/reference-vault/028-a8f62ab3d392.png', '/reference-vault/029-640527178f8d.png', '/reference-vault/030-7bd7e8a977bf.png', '/reference-vault/031-6f3948f48928.png', '/reference-vault/032-ae224c73b5dc.png'],
  'feature-wall': ['/reference-vault/034-355f624f691c.png', '/reference-vault/037-4dd8b6a25dc7.png', '/reference-vault/046-fe27dfd45c96.png'],
  storage: ['/reference-vault/008-5fd497f005d8.png', '/reference-vault/040-a7dcd66e4242.png', '/reference-vault/041-6770bf54ce43.png'],
};

const EXISTING_CURATED_VAULT_REFERENCES = [
  { id: 'ref-001', img: '/reference-vault/001-ddc1891636f7.png', room: 'living', family: 'sofa', title: '2800mm Sectional Sofa & Dark Oak Coffee Table', tags: ['living', 'sofa', 'sectional', 'l-shaped'] },
  { id: 'ref-002', img: '/reference-vault/002-cab37cfa0bb2.png', room: 'dining', family: 'crockery', title: '1800mm Fluted Crockery Console & Glass Overhead Bar', tags: ['dining', 'crockery', 'fluted', 'bar'] },
  { id: 'ref-003', img: '/reference-vault/003-1f61a8aabde4.png', room: 'kitchen', family: 'kitchen-tall', title: 'Modular Kitchen with Dual Microwave/Oven Tall Tower', tags: ['kitchen', 'tall-unit', 'appliance', 'microwave'] },
  { id: 'ref-004', img: '/reference-vault/004-ee04b56efde7.png', room: 'dining', family: 'crockery', title: 'Dining Bar & Display Console with Fluted Louvers', tags: ['dining', 'bar', 'crockery', 'display'] },
  { id: 'ref-005', img: '/reference-vault/005-7919b88e0dc1.png', room: 'utility', family: 'utility', title: 'Technical CAD Elevation: 1596mm Utility Wall Unit', tags: ['utility', 'cad-elevation', 'sink', 'washing-machine'] },
  { id: 'ref-006', img: '/reference-vault/006-e36e2c7c9b1a.png', room: 'kitchen', family: 'kitchen-base', title: 'Modular Kitchen Counter with Tandem Pot Drawers', tags: ['kitchen', 'base-unit', 'drawers', 'fluted-glass'] },
  { id: 'ref-007', img: '/reference-vault/007-2b9d568ff444.png', room: 'bedroom', family: 'wardrobe', title: '2-Door Sliding Wardrobe with Fluted Glass & Study Desk', tags: ['bedroom', 'wardrobe', 'sliding', 'study'] },
  { id: 'ref-008', img: '/reference-vault/008-5fd497f005d8.png', room: 'bedroom', family: 'wardrobe', title: '2000mm 4-Door Natural Oak Wardrobe with Lofts', tags: ['bedroom', 'wardrobe', 'oak', 'swing-door'] },
  { id: 'ref-009', img: '/reference-vault/009-f68e47674ead.png', room: 'bedroom', family: 'wardrobe', title: 'Suede Ivory 4-Door Wardrobe with Pinboard Study Desk', tags: ['bedroom', 'wardrobe', 'study', 'pinboard'] },
  { id: 'ref-010', img: '/reference-vault/010-a0dbdf361a50.png', room: 'bedroom', family: 'wardrobe', title: 'Blush Pink & White Arched 4-Door Kids Wardrobe & Desk', tags: ['bedroom', 'wardrobe', 'kids', 'arched', 'pink'] },
  { id: 'ref-011', img: '/reference-vault/011-6c55d3439149.png', room: 'study', family: 'study', title: '1500mm Floating Study Desk with Fluted Wall Cabinet', tags: ['study', 'desk', 'floating', 'fluted'] },
  { id: 'ref-012', img: '/reference-vault/012-5c60a01e5b86.png', room: 'bedroom', family: 'wardrobe', title: '2400mm Minimalist Gola Handleless Profile Wardrobe', tags: ['bedroom', 'wardrobe', 'gola', 'handleless'] },
  { id: 'ref-013', img: '/reference-vault/013-52a29a1053dc.png', room: 'living', family: 'tv-unit', title: '2400mm Fluted TV Console Wall with Backlit Louvers', tags: ['living', 'tv-unit', 'fluted', 'backlit'] },
  { id: 'ref-014', img: '/reference-vault/014-685f67e3ff6f.png', room: 'living', family: 'tv-unit', title: 'Minimalist Floating Backlit Media Wall', tags: ['living', 'tv-unit', 'floating'] },
  { id: 'ref-015', img: '/reference-vault/015-5705e2ee9cb1.png', room: 'living', family: 'tv-unit', title: 'TV Wall with Open Display Bookshelf & Acoustic Slats', tags: ['living', 'tv-unit', 'bookshelf'] },
  { id: 'ref-016', img: '/reference-vault/016-f106846da92c.png', room: 'living', family: 'tv-unit', title: 'Acoustic Slat Partition TV Media Wall', tags: ['living', 'tv-unit', 'partition'] },
  { id: 'ref-017', img: '/reference-vault/017-cd2b9919c856.png', room: 'living', family: 'tv-unit', title: 'Curved Asymmetric Plaster & Wood TV Unit', tags: ['living', 'tv-unit', 'curved'] },
  { id: 'ref-018', img: '/reference-vault/018-b7dd5f1492fe.png', room: 'dining', family: 'crockery', title: '1800mm Full Height Bar & Wine Cabinet with Fluted Backing', tags: ['dining', 'bar', 'crockery', 'fluted'] },
  { id: 'ref-019', img: '/reference-vault/019-a06a89855436.png', room: 'pooja', family: 'pooja', title: 'Modular Pooja Mandir Unit (Open & Shutter Variations)', tags: ['pooja', 'mandir', 'jaali', 'shutter'] },
  { id: 'ref-020', img: '/reference-vault/020-ea872c640df6.png', room: 'pooja', family: 'pooja', title: 'Traditional Backlit Pooja Mandir with CNC Jaali Archway', tags: ['pooja', 'mandir', 'cnc-jaali', 'backlit'] },
  { id: 'ref-021', img: '/reference-vault/021-5a47b71bad49.png', room: 'pooja', family: 'pooja', title: 'Isolated Product: 1000mm Mandir with Gold OM Mandala', tags: ['pooja', 'mandir', 'gold-om', 'isolated'] },
  { id: 'ref-022', img: '/reference-vault/022-d6f4e9ee57d1.png', room: 'study', family: 'study', title: 'Floating Study Desk with Fluted Dark Oak Shutter & Bookshelf', tags: ['study', 'desk', 'fluted', 'bookshelf'] },
  { id: 'ref-023', img: '/reference-vault/023-ae1e9b70744f.png', room: 'bedroom', family: 'wardrobe', title: '3200mm Beige Arched 4-Door Wardrobe & Floating Desk', tags: ['bedroom', 'wardrobe', 'arched', 'study'] },
  { id: 'ref-024', img: '/reference-vault/024-5976bb27ca03.png', room: 'study', family: 'study', title: 'Study Workstation with Linear Ceiling Profile Lighting', tags: ['study', 'desk', 'workstation', 'lighting'] },
  { id: 'ref-025', img: '/reference-vault/025-adb09122c8d1.png', room: 'bedroom', family: 'wardrobe', title: 'Sage Green Arched 4-Door Wardrobe with Glass LED Shelf', tags: ['bedroom', 'wardrobe', 'sage-green', 'glass-led'] },
  { id: 'ref-026', img: '/reference-vault/026-ebca5fba9a3f.png', room: 'living', family: 'tv-unit', title: 'Living Hallway TV Wall with Marble & Emerald Flank Trims', tags: ['living', 'tv-unit', 'wainscoting', 'marble'] },
  { id: 'ref-027', img: '/reference-vault/027-3ee9dcdaca5c.png', room: 'bathroom', family: 'vanity', title: '900mm Bathroom Vanity Ledge & Overhead Double-Shutter', tags: ['bathroom', 'vanity', 'cistern', 'overhead'] },
  { id: 'ref-028', img: '/reference-vault/028-a8f62ab3d392.png', room: 'bathroom', family: 'vanity', title: '1200mm Concealed Cistern Vanity & Wall-Hung Basin', tags: ['bathroom', 'toilet', 'vanity', 'wall-hung'] },
  { id: 'ref-029', img: '/reference-vault/029-640527178f8d.png', room: 'bathroom', family: 'vanity', title: '1500mm Bathroom Suite with Oval Backlit Mirror & Shutter', tags: ['bathroom', 'vanity', 'mirror', 'storage'] },
  { id: 'ref-030', img: '/reference-vault/030-7bd7e8a977bf.png', room: 'bathroom', family: 'vanity', title: '1200mm Bathroom Concealed Cistern Wall & Cabinet', tags: ['bathroom', 'vanity', 'cistern', 'cabinet'] },
  { id: 'ref-031', img: '/reference-vault/031-6f3948f48928.png', room: 'bathroom', family: 'vanity', title: '900mm Toilet Cistern Wall with Overhead Storage Cabinet', tags: ['bathroom', 'toilet', 'overhead-cabinet'] },
  { id: 'ref-032', img: '/reference-vault/032-ae224c73b5dc.png', room: 'bathroom', family: 'vanity', title: '900mm Cistern Vanity Unit with Dual Shutter Loft', tags: ['bathroom', 'toilet', 'loft-storage'] },
  { id: 'ref-033', img: '/reference-vault/033-9d09b620a75e.png', room: 'study', family: 'study', title: 'Architectural CAD Elevation: Study & Wardrobe Release', tags: ['study', 'cad-elevation', 'dimensions'] },
  { id: 'ref-034', img: '/reference-vault/034-355f624f691c.png', room: 'living', family: 'feature-wall', title: 'Living Room Acoustic Slat Divider with Backlit Niches', tags: ['living', 'partition', 'slat-wall', 'backlit'] },
  { id: 'ref-035', img: '/reference-vault/035-78733d79d595.png', room: 'bedroom', family: 'wardrobe', title: 'Sage Green Arched Wardrobe with Integrated Desk & LED Shelf', tags: ['bedroom', 'wardrobe', 'arched', 'desk'] },
  { id: 'ref-036', img: '/reference-vault/036-de959cf3df44.png', room: 'utility', family: 'utility', title: '1800mm Laundry Counter with Washing Machine & Lofts', tags: ['utility', 'laundry', 'washing-machine', 'dishwasher'] },
  { id: 'ref-037', img: '/reference-vault/037-4dd8b6a25dc7.png', room: 'bedroom', family: 'feature-wall', title: 'Bedroom Feature Wall with Recessed LED Cove Lighting', tags: ['bedroom', 'feature-wall', 'cove-lighting', 'lofts'] },
  { id: 'ref-038', img: '/reference-vault/038-73c6d08adf93.png', room: 'bedroom', family: 'wardrobe', title: 'Arched Shutter Kids Wardrobe with Built-In Study & Shelf', tags: ['bedroom', 'wardrobe', 'kids', 'study'] },
  { id: 'ref-039', img: '/reference-vault/039-1786da704c5a.png', room: 'kitchen', family: 'kitchen-base', title: '2400mm Kitchen Base & Fluted Glass Overhead Cabinets', tags: ['kitchen', 'base', 'overhead', 'terrazzo'] },
  { id: 'ref-040', img: '/reference-vault/040-a7dcd66e4242.png', room: 'bedroom', family: 'wardrobe', title: '2000mm 4-Door Suede & Dark Oak Corridor Wardrobe', tags: ['bedroom', 'wardrobe', 'corridor', 'suede'] },
  { id: 'ref-041', img: '/reference-vault/041-6770bf54ce43.png', room: 'bedroom', family: 'wardrobe', title: '2000mm 4-Door Stepped Two-Tone Passage Wardrobe', tags: ['bedroom', 'wardrobe', 'two-tone', 'lofts'] },
  { id: 'ref-042', img: '/reference-vault/042-7eaf3dbfd306.png', room: 'kitchen', family: 'kitchen-base', title: 'L-Shaped Kitchen with White Base, Oak Overheads & Lofts', tags: ['kitchen', 'l-shaped', 'acrylic', 'oak'] },
  { id: 'ref-043', img: '/reference-vault/043-71833d244d0d.png', room: 'bedroom', family: 'wardrobe', title: '2900mm Wardrobe with Integrated Desk & Backlit Niche', tags: ['bedroom', 'wardrobe', 'study', 'lofts'] },
  { id: 'ref-044', img: '/reference-vault/044-577ed741688e.png', room: 'bedroom', family: 'wardrobe', title: 'CAD Release: 2900W × 2790H Wardrobe & Study Elevation', tags: ['bedroom', 'wardrobe', 'cad-elevation', 'dimensions'] },
  { id: 'ref-045', img: '/reference-vault/045-7ec65f321496.png', room: 'bedroom', family: 'wardrobe', title: 'Sage Green Wardrobe Suite with Glass LED Display Tower', tags: ['bedroom', 'wardrobe', 'sage-green', 'display-tower'] },
  { id: 'ref-046', img: '/reference-vault/046-fe27dfd45c96.png', room: 'bedroom', family: 'feature-wall', title: 'Master Bed Feature Wall with Vertical LED Lighting Strip', tags: ['bedroom', 'feature-wall', 'led-strip', 'lofts'] },
  { id: 'ref-047', img: '/reference-vault/047-c1ce4511e83d.png', room: 'bedroom', family: 'bed', title: 'Master Bedroom Suite: King Bed, Fluted 4-Door Wardrobe & Vanity', tags: ['bedroom', 'bed', 'wardrobe', 'vanity'] },
  { id: 'ref-048', img: '/reference-vault/048-ac94a44309b6.png', room: 'kitchen', family: 'kitchen-tall', title: 'Kitchen Counter with Fluted Glass & Rolling Shutter Garage', tags: ['kitchen', 'rolling-shutter', 'appliance-garage', 'drawers'] },
  { id: 'ref-049', img: '/reference-vault/049-d1a18590223e.png', room: 'bedroom', family: 'bed', title: 'Master Bedroom Dossier: Floor Plan, 3D Elevation & Swatches', tags: ['bedroom', 'floor-plan', 'dossier', 'material-swatch'] },
  { id: 'ref-050', img: '/reference-vault/050-a2b533693ac2.png', room: 'kitchen', family: 'kitchen-base', title: 'Kitchen Base & Glass Overheads with Wood Slats Feature', tags: ['kitchen', 'fluted-glass', 'wood-slats', 'terrazzo'] },
  { id: 'ref-051', img: '/reference-vault/051-999d353af1d8.png', room: 'living', family: 'tv-unit', title: '2700mm TV Media Wall with Travertine, Louvers & Glass Cabinet', tags: ['living', 'tv-unit', 'travertine', 'louvers', 'glass-cabinet'] },
  { id: 'ref-052', img: '/reference-vault/052-1d6904ef55a3.png', room: 'kitchen', family: 'kitchen-tall', title: 'Minimalist Kitchen with Built-In Dual Oven Tower & Plinth LED', tags: ['kitchen', 'tall-tower', 'built-in-oven', 'plinth-led'] },
  { id: 'ref-053', img: '/reference-vault/053-edfb0eca9b46.png', room: 'kitchen', family: 'kitchen-base', title: 'Kitchen Sink Counter with Fluted Glass Overheads & Wood Niche', tags: ['kitchen', 'sink-unit', 'fluted-glass', 'open-shelf'] },
  { id: 'ref-054', img: '/reference-vault/054-c8fa00bd2c4b.png', room: 'bedroom', family: 'wardrobe', title: '2500mm 3-Door Wardrobe with Integrated Study & Pinboard', tags: ['bedroom', 'wardrobe', 'study', 'pedestal-drawers'] },
  { id: 'ref-055', img: '/reference-vault/055-e94b19f0e93f.png', room: 'kitchen', family: 'kitchen-base', title: 'L-Shaped Kitchen with White Base, Teak Overheads & Fridge Bay', tags: ['kitchen', 'l-shaped', 'refrigerator-bay', 'teak'] },
  { id: 'ref-056', img: '/reference-vault/056-3bb2275767d2.png', room: 'kitchen', family: 'kitchen-tall', title: 'Straight Kitchen with Microwave Tall Unit & Fluted Glass Display', tags: ['kitchen', 'microwave-unit', 'fluted-glass', 'straight-line'] },
  { id: 'ref-057', img: '/reference-vault/057-da6cb4575090.png', room: 'kitchen', family: 'kitchen-base', title: 'L-Shaped Kitchen with Marble Top, Bronze Tap & Teak Overheads', tags: ['kitchen', 'marble', 'bronze-faucet', 'l-shaped'] },
  { id: 'ref-058', img: '/reference-vault/058-b3d36c0c874b.png', room: 'living', family: 'tv-unit', title: '2600mm TV Panel with White Fluted Surround & Halo LED Light', tags: ['living', 'tv-unit', 'halo-light', 'floating-console'] },
  { id: 'ref-059', img: '/reference-vault/059-28205fff47ae.png', room: 'kitchen', family: 'kitchen-tall', title: 'Minimalist Kitchen with Dual Oven Tower & Gas Cooktop', tags: ['kitchen', 'tall-tower', 'cooktop', 'microwave'] },
  { id: 'ref-060', img: '/reference-vault/060-70075531f7e7.png', room: 'bedroom', family: 'bed', title: 'Master Bedroom Suite: King Bed, 6-Door Wardrobe & Study Desk', tags: ['bedroom', 'suite', 'king-bed', '6-door-wardrobe'] },
];

const CURATED_VAULT_REFERENCES: Array<{
  id: string;
  img: string;
  room: string;
  family: string;
  title: string;
  tags: string[];
  kind?: RecentGalleryReference['kind'] | 'existing-curated';
  sourceName?: string;
  sourceBatch?: string;
}> = [
  ...EXISTING_CURATED_VAULT_REFERENCES.map((reference) => ({ ...reference, kind: 'existing-curated' as const })),
  ...RECENT_REFERENCE_GALLERY,
];

type CuratedReference = (typeof CURATED_VAULT_REFERENCES)[number];
const ROOM_REFERENCE_FILTERS = [
  ['living', 'Living'], ['bedroom', 'Bedroom'], ['kitchen', 'Kitchen'], ['dining', 'Dining'],
  ['bathroom', 'Bathroom'], ['pooja', 'Pooja'], ['study', 'Study'], ['utility', 'Utility'], ['entry', 'Entry'],
] as const;
const REFERENCE_TYPE_FILTERS = [
  ['all', 'All references'], ['rooms', 'Room inspiration'], ['technical', 'Technical drawings'], ['materials', 'Material details'], ['boards', 'Project boards'],
] as const;
function referenceType(ref: CuratedReference): 'rooms' | 'technical' | 'materials' | 'boards' {
  if (ref.kind === 'technical') return 'technical';
  if (ref.kind === 'material-detail') return 'materials';
  const labels = `${ref.title} ${ref.tags.join(' ')}`.toLowerCase();
  if (/cad-elevation|technical-drawing|dimensioned|working-drawing|floor-plan|elevation-sheet/.test(labels)) return 'technical';
  if (/dossier|design-board|moodboard|material-board|comparison-board/.test(labels)) return 'boards';
  return 'rooms';
}
function referenceSpace(ref: CuratedReference): string {
  const type = referenceType(ref);
  if (type !== 'rooms') return type;
  return REFERENCE_SPACE_LABELS[ref.room] ? ref.room : 'living';
}
function referenceFocusLabel(ref: CuratedReference): string {
  const type = referenceType(ref);
  if (type === 'technical') return 'Plans & elevations';
  if (type === 'materials') return 'Material details';
  if (type === 'boards') return 'Project boards';
  return referenceFocus({ family: ref.family, room: referenceSpace(ref), kind: !ref.kind || ref.kind === 'existing-curated' ? 'render-or-inspiration' : ref.kind });
}
function referenceAuthorityLabel(ref: CuratedReference): string {
  const type = referenceType(ref);
  if (type === 'technical') return 'Technical reference · verify dimensions';
  if (type === 'materials') return 'Material inspiration · not a supplier spec';
  if (type === 'boards') return 'Design board · visual guidance';
  return 'Style inspiration · not measured';
}
function referenceDescription(ref: CuratedReference): string {
  const type = referenceType(ref);
  if (type === 'technical') return 'Reference image only. Verify every annotation and dimension against an approved source drawing before use.';
  if (type === 'materials') return 'Visual finish inspiration only. This image does not identify a supplier, product code, finish specification, or calibrated colour.';
  if (type === 'boards') return 'A presentation or project board for visual direction. Confirm all products, dimensions, and finishes against approved project records.';
  return 'Style inspiration only. The image does not define measured dimensions or certified construction geometry.';
}

const SAMPLE_MATERIAL_PALETTE: Material[] = [
  { id: 'sample-white-gloss', name: 'Porcelain white · gloss', code: 'SAMPLE-FINISH-01', category: 'laminate', finish: 'Illustrative finish', metadata: { colorHex: '#F7F6F2' } },
  { id: 'sample-warm-ivory', name: 'Warm ivory · matte', code: 'SAMPLE-FINISH-02', category: 'laminate', finish: 'Illustrative finish', metadata: { colorHex: '#E8DFD1' } },
  { id: 'sample-stone-grey', name: 'Soft stone grey · textured', code: 'SAMPLE-FINISH-03', category: 'laminate', finish: 'Illustrative finish', metadata: { colorHex: '#9A9891' } },
  { id: 'sample-sage', name: 'Muted sage · matte', code: 'SAMPLE-FINISH-04', category: 'laminate', finish: 'Illustrative finish', metadata: { colorHex: '#849283' } },
  { id: 'sample-oak', name: 'Natural oak · grain direction to confirm', code: 'SAMPLE-FINISH-05', category: 'laminate', finish: 'Illustrative finish', metadata: { colorHex: '#B58A60' } },
  { id: 'sample-walnut', name: 'Smoked walnut · grain direction to confirm', code: 'SAMPLE-FINISH-06', category: 'laminate', finish: 'Illustrative finish', metadata: { colorHex: '#5B4133' } },
  { id: 'sample-charcoal', name: 'Deep charcoal · soft matte', code: 'SAMPLE-FINISH-07', category: 'laminate', finish: 'Illustrative finish', metadata: { colorHex: '#343536' } },
  { id: 'sample-stone', name: 'Warm travertine · visual reference', code: 'SAMPLE-FINISH-08', category: 'countertop', finish: 'Illustrative finish', metadata: { colorHex: '#C9B99F' } },
];

function stableImageForModule(module: CatalogModule) {
  const isVanity = /vanity|washroom|cistern|toilet/i.test(`${module.id} ${module.name} ${module.tags.join(' ')}`);
  const images = (isVanity ? MODULE_REFERENCE_IMAGES.vanity : undefined)
    ?? MODULE_REFERENCE_IMAGES[module.family]
    ?? MODULE_REFERENCE_IMAGES[module.family.split('-')[0]];
  if (!images?.length) return null;
  const seed = [...module.id].reduce((total, character) => total + character.charCodeAt(0), 0);
  return images[seed % images.length];
}

function moduleSupportsRoom(module: CatalogModule, room: string) {
  if (module.roomTypes.includes(room)) return true;
  if (room === 'master_bedroom' || room === 'kids_bedroom') return module.roomTypes.includes('bedroom');
  return false;
}

const apiBase = getApiBase;

function materialSubtitle(material: Material) {
  const thickness = material.thickness_mm ? `${material.thickness_mm}mm` : '';
  const edge = material.edge_band_status === 'not_required' ? 'Seamless' : material.edge_band_thickness_mm ? `${material.edge_band_thickness_mm}mm edge` : '';
  return [material.supplier, material.finish, thickness, edge]
    .filter(Boolean)
    .join(' · ');
}

function materialColour(material: Material) {
  const candidate = material.metadata?.colourHex ?? material.metadata?.colorHex;
  return /^#[0-9a-f]{6}$/i.test(candidate ?? '') ? candidate! : '#d6c1a7';
}

const DEFAULT_MODULAR_CATALOG: CatalogModule[] = [
  // KITCHEN
  { id: 'kit-base-600', family: 'kitchen-base', name: '600 Base Single-Door Cabinet', roomTypes: ['kitchen'], widthMm: 600, depthMm: 600, heightMm: 750, sku: 'ULT-KB-600', tags: ['kitchen', 'base'], description: 'Standard 600mm base unit with single soft-close shutter and one adjustable shelf.', production: { cutlistSupported: true } },
  { id: 'kit-base-cutlery-600', family: 'kitchen-base', name: '600 3-Drawer Cutlery & Tandem Base', roomTypes: ['kitchen'], widthMm: 600, depthMm: 600, heightMm: 750, sku: 'ULT-KB-DR3-600', tags: ['kitchen', 'base', 'cutlery', 'tandem'], description: 'Triple drawer stack with top cutlery tray, middle utensil drawer, and deep lower pot drawer.', production: { cutlistSupported: true } },
  { id: 'kit-base-tandem-2pot-600', family: 'kitchen-base', name: '600 2-Pot Deep Tandem Base', roomTypes: ['kitchen'], widthMm: 600, depthMm: 600, heightMm: 750, sku: 'ULT-KB-TDM2-600', tags: ['kitchen', 'base', 'pots'], description: 'Dual heavy-duty soft-close tandem drawers (65kg rating) for heavy pots.', production: { cutlistSupported: true } },
  { id: 'kit-base-sink-900', family: 'kitchen-base', name: '900 Waterproof Sink Base with Drip Tray', roomTypes: ['kitchen', 'utility'], widthMm: 900, depthMm: 600, heightMm: 750, sku: 'ULT-KS-900', tags: ['kitchen', 'sink'], description: 'Sink unit with marine-grade core and waterproof bottom tray.', production: { cutlistSupported: true } },
  { id: 'kit-corner-lemans-1050', family: 'kitchen-corner', name: '1050 LeMans II Blind Corner Carousel', roomTypes: ['kitchen'], widthMm: 1050, depthMm: 600, heightMm: 750, sku: 'ULT-KC-LEM-1050', tags: ['kitchen', 'corner', 'lemans'], description: 'Blind corner unit equipped with smooth double LeMans articulating trays.', production: { cutlistSupported: true } },
  { id: 'kit-wall-600', family: 'kitchen-wall', name: '600 Single Overhead Shutter Unit', roomTypes: ['kitchen'], widthMm: 600, depthMm: 350, heightMm: 720, sku: 'ULT-KW-600', tags: ['kitchen', 'wall', 'overhead'], description: 'Wall-mounted 600mm overhead cabinet with two adjustable shelves.', production: { cutlistSupported: true } },
  { id: 'kit-wall-liftup-900', family: 'kitchen-wall', name: '900 Bi-Fold Lift-Up Glass Unit', roomTypes: ['kitchen'], widthMm: 900, depthMm: 350, heightMm: 720, sku: 'ULT-KW-LFT-900', tags: ['kitchen', 'wall', 'lift-up', 'glass'], description: 'Modern bi-fold lift-up overhead unit with tinted glass shutter.', production: { cutlistSupported: true } },
  { id: 'kit-tall-pantry-600', family: 'kitchen-tall', name: '600 Full-Height Pull-Out Pantry Tower', roomTypes: ['kitchen'], widthMm: 600, depthMm: 600, heightMm: 2100, sku: 'ULT-KT-PNT-600', tags: ['kitchen', 'tall', 'pantry'], description: '6-tier internal pull-out chrome basket pantry tower.', production: { cutlistSupported: true } },
  { id: 'kit-tall-appliance-600', family: 'kitchen-tall', name: '600 Built-In Oven & Microwave Tall Unit', roomTypes: ['kitchen'], widthMm: 600, depthMm: 600, heightMm: 2100, sku: 'ULT-KT-APP-600', tags: ['kitchen', 'tall', 'oven'], description: 'Dedicated appliance tower with built-in oven and microwave cavities.', production: { cutlistSupported: true } },

  // LIVING & TV UNITS
  { id: 'tv-profile-2400', family: 'tv-unit', name: '2400 Floating TV Wall with Profile Glass & Warm LED', roomTypes: ['living'], widthMm: 2400, depthMm: 400, heightMm: 2400, sku: 'ULT-TV-PRF-2400', tags: ['tv-wall', 'floating', 'led', 'profile-glass'], description: 'Feature TV media wall with floating console, profile-glass display, and fluted paneling.', production: { cutlistSupported: true } },
  { id: 'tv-fluted-2100', family: 'tv-unit', name: '2100 Fluted-Panel Floating TV Console', roomTypes: ['living'], widthMm: 2100, depthMm: 400, heightMm: 2300, sku: 'ULT-TV-FLUTE-2100', tags: ['tv-wall', 'fluted'], description: 'Contemporary TV wall with vertical fluted texture and dual push-to-open drawers.', production: { cutlistSupported: true } },
  { id: 'sofa-curved-boucle-2800', family: 'sofa', name: '2800 Curved Bouclé Sectional Sofa', roomTypes: ['living'], widthMm: 2800, depthMm: 1600, heightMm: 800, sku: 'ULT-SF-CRV-2800', tags: ['sofa', 'sectional', 'boucle'], description: 'Sculptural organic contours in soft cream bouclé fabric with high-density core.', production: { cutlistSupported: false } },
  { id: 'sofa-l-2800', family: 'sofa', name: '2800 L-Shaped Sectional Cloud Couch', roomTypes: ['living'], widthMm: 2800, depthMm: 1700, heightMm: 850, sku: 'ULT-SF-L2800', tags: ['sofa', 'sectional'], description: 'Deep conversational sectional with feather-blend cushions and hardwood frame.', production: { cutlistSupported: false } },

  // BEDROOM & WARDROBES
  { id: 'wardrobe-2100-four-shutter', family: 'wardrobe', name: '2100 Four-Shutter Wardrobe with Overhead Loft', roomTypes: ['bedroom', 'master_bedroom'], widthMm: 2100, depthMm: 600, heightMm: 2700, sku: 'ULT-WD-4S-2100', tags: ['wardrobe', 'swing', 'loft'], description: 'Floor-to-ceiling 4-shutter wardrobe with 600mm overhead loft and internal drawers.', production: { cutlistSupported: true } },
  { id: 'wardrobe-sliding-2400', family: 'wardrobe', name: '2400 2-Door Soft-Close Sliding Wardrobe', roomTypes: ['bedroom', 'master_bedroom'], widthMm: 2400, depthMm: 650, heightMm: 2400, sku: 'ULT-WD-SLD-2400', tags: ['wardrobe', 'sliding'], description: 'Smooth bottom-running sliding wardrobe with anti-jump rollers and full-length mirror.', production: { cutlistSupported: true } },
  { id: 'wardrobe-walkin-glass-3000', family: 'wardrobe', name: '3000 Luxury Profile-Glass Walk-In Closet', roomTypes: ['bedroom', 'master_bedroom'], widthMm: 3000, depthMm: 600, heightMm: 2700, sku: 'ULT-WD-WIK-3000', tags: ['wardrobe', 'walk-in', 'glass'], description: 'Tinted glass shutters with integrated vertical LED profiles and leatherette shelving.', production: { cutlistSupported: true } },
  { id: 'bed-floating-led-1800', family: 'bed', name: '1800 King Floating Bed with Concealed Underglow', roomTypes: ['bedroom', 'master_bedroom'], widthMm: 1800, depthMm: 2100, heightMm: 1100, sku: 'ULT-BD-FLT-1800', tags: ['bed', 'floating', 'hydraulic'], description: 'Anti-gravity cantilevered frame with warm LED ground wash and hydraulic storage base.', production: { cutlistSupported: true } },
  { id: 'bed-1800-extended-headboard', family: 'bed', name: '1800 King Bed with Extended Fluted Headboard & Nightstands', roomTypes: ['bedroom', 'master_bedroom'], widthMm: 2800, depthMm: 2100, heightMm: 1200, sku: 'ULT-BD-EXT-1800', tags: ['bed', 'headboard', 'fluted'], description: 'Full-wall upholstered headboard panel with integrated floating bedside ledges.', production: { cutlistSupported: true } },

  // DINING & CROCKERY
  { id: 'dining-calacatta-gold-2100', family: 'dining', name: '2100 Calacatta Gold Marble Dining Table', roomTypes: ['dining'], widthMm: 2100, depthMm: 1000, heightMm: 750, sku: 'ULT-DN-CAL-2100', tags: ['dining', 'marble'], description: '20mm sintered marble slab table with rounded bullnose edges on dual fluted pedestals.', production: { cutlistSupported: false } },
  { id: 'dining-1600', family: 'dining', name: '1600 Solid Oak Six-Seat Dining Ensemble', roomTypes: ['dining'], widthMm: 1600, depthMm: 900, heightMm: 750, sku: 'ULT-DN-OAK-1600', tags: ['dining', 'oak'], description: 'Mid-century solid oak table with 6 matching bucket dining chairs.', production: { cutlistSupported: false } },
  { id: 'crockery-1800', family: 'crockery', name: '1800 Full-Wall Crockery & Wine Bar Unit', roomTypes: ['dining', 'living'], widthMm: 1800, depthMm: 450, heightMm: 2400, sku: 'ULT-CR-1800', tags: ['crockery', 'bar', 'wine'], description: 'Fluted glass display cabinet with stemware racks and bottle drawers below.', production: { cutlistSupported: true } },

  // POOJA & MANDIR
  { id: 'pooja-jaali-1200', family: 'pooja', name: '1200 CNC Jaali Teakwood Pooja Mandir', roomTypes: ['pooja', 'living'], widthMm: 1200, depthMm: 600, heightMm: 2100, sku: 'ULT-PJ-JAL-1200', tags: ['pooja', 'mandir', 'jaali'], description: 'Sacred mandir with CNC back-lit jaali panel, brass bell inlays, and pull-out diya tray.', production: { cutlistSupported: true } },

  // STUDY, FOYER & WASHROOM
  { id: 'study-1500', family: 'study', name: '1500 Floating Wall-Mounted Study Desk & Shelf', roomTypes: ['study', 'bedroom'], widthMm: 1500, depthMm: 600, heightMm: 2400, sku: 'ULT-ST-FLT-1500', tags: ['study', 'desk', 'floating'], description: 'Heavy-duty wall mounted study workstation with wire grommets and pinboard niche.', production: { cutlistSupported: true } },
  { id: 'foyer-shoe-1200', family: 'storage', name: '1200 Foyer Shoe Storage Bench with Cushion', roomTypes: ['foyer', 'living'], widthMm: 1200, depthMm: 400, heightMm: 1800, sku: 'ULT-ST-FOY-1200', tags: ['storage', 'shoe-rack', 'foyer'], description: 'Entryway console with 16-pair ventilated shoe cabinet and coat hooks.', production: { cutlistSupported: true } },
  { id: 'washroom-shutter-vanity-900', family: 'utility', name: '900 Washroom Concealed Cistern Vanity & Overhead Shutter Unit', roomTypes: ['utility', 'master_bedroom'], widthMm: 900, depthMm: 450, heightMm: 2100, sku: 'ULT-WR-VS-900', tags: ['washroom', 'vanity', 'overhead-shutter', 'toilet'], description: 'Washroom composition with wall-hung vanity washbasin counter, concealed cistern ledge, open niche, and top 2-door overhead shutter cabinet.', production: { cutlistSupported: true } },
];

export function UnifiedDesignLibraryWorkspace({ organizationId, projectId }: { organizationId?: string | null; projectId?: string | null }) {
  const navigate = useNavigate();
  const { projectId: urlProjectId } = useParams<{ projectId?: string }>();
  const [searchParams] = useSearchParams();
  const activeProjectId = projectId ?? urlProjectId ?? searchParams.get('projectId') ?? null;

  const [activeTab, setActiveTab] = useState<'templates' | 'modules' | 'moodboard' | 'materials' | 'research'>('modules');
  const [moduleImageMode, setModuleImageMode] = useState<'photo' | 'nobg'>('nobg');
  const [items, setItems] = useState<LibraryItem[]>([]);
  // Templates come from the canonical catalogue API. Do not briefly show the
  // legacy in-memory list: it may contain retired IDs that cannot be placed.
  const [modules, setModules] = useState<CatalogModule[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [initialMoodboard] = useState(() => readMoodboardDraft(activeProjectId));
  const [moodboardItems, setMoodboardItems] = useState<MoodboardItem[]>(initialMoodboard.items);
  const [moodboardBg, setMoodboardBg] = useState<MoodboardDraft['background']>(initialMoodboard.background);
  const [moodboardOwner, setMoodboardOwner] = useState(activeProjectId);
  const [selectedMbItem, setSelectedMbItem] = useState<string | null>(null);
  const moodboardDragRef = useRef<{ id: string; pointerId: number; x: number; y: number; itemX: number; itemY: number } | null>(null);
  const [query, setQuery] = useState('');
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceTags, setReferenceTags] = useState('');
  const [uploadingReference, setUploadingReference] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [catalogUnavailable, setCatalogUnavailable] = useState(false);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [status, setStatus] = useState('Modular catalog loaded.');
  const [vault, setVault] = useState<VaultEntry[]>([]);
  const [vaultRoom, setVaultRoom] = useState('all');
  const [vaultReferenceType, setVaultReferenceType] = useState<'all' | 'rooms' | 'technical' | 'materials' | 'boards'>('all');
  const [vaultFocus, setVaultFocus] = useState('all');
  const [vaultFamily, setVaultFamily] = useState('all');
  const [vaultState, setVaultState] = useState('all');
  const [moduleFamily, setModuleFamily] = useState('all');
  const [moduleRoom, setModuleRoom] = useState('all');
  const [moduleCapability, setModuleCapability] = useState<'all' | 'cutlist' | 'visual'>('all');
  const [materialCategory, setMaterialCategory] = useState('all');
  const [archiveTarget, setArchiveTarget] = useState<VaultEntry | null>(null);
  const [addingStarterMaterials, setAddingStarterMaterials] = useState(false);
  const [previewModalItem, setPreviewModalItem] = useState<{
    title: string;
    image: string;
    family?: string;
    dimensions?: string;
    description?: string;
    sku?: string;
    module?: CatalogModule;
    imageUnavailable?: boolean;
  } | null>(null);

  useEffect(() => {
    const draft = readMoodboardDraft(activeProjectId);
    setMoodboardItems(draft.items);
    setMoodboardBg(draft.background);
    setSelectedMbItem(null);
    setMoodboardOwner(activeProjectId);
  }, [activeProjectId]);

  useEffect(() => {
    if (moodboardOwner !== activeProjectId || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(moodboardStorageKey(activeProjectId), JSON.stringify({ items: moodboardItems, background: moodboardBg }));
    } catch {
      setStatus('The moodboard could not be saved on this device. Free some browser storage and try again.');
    }
  }, [moodboardItems, moodboardBg, moodboardOwner, activeProjectId]);

  useEffect(() => {
    if (!previewModalItem) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewModalItem(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewModalItem]);

  function arrangeMoodboard() {
    setMoodboardItems((current) => current.map((item, index) => ({
      ...item,
      x: 32 + (index % 3) * 300,
      y: 64 + Math.floor(index / 3) * 190,
      zIndex: index + 1,
    })));
    setStatus('Moodboard arranged into a clean grid. Select any item to refine its position.');
  }

  function placeModuleInProjectWallPicker(mod: CatalogModule) {
    const prepared = {
      schema: 'ultida.module-plan.v1',
      templateId: mod.id,
      family: mod.family,
      name: mod.name,
      dimensionsMm: { width: mod.widthMm, depth: mod.depthMm, height: mod.heightMm },
      wallWidthMm: 3000,
      clearanceMm: 900,
    };
    window.localStorage.setItem('ultida.pendingModulePlan.v1', JSON.stringify(prepared));
    if (activeProjectId) {
      navigate(`/projects/${activeProjectId}/spaces?pendingModule=1`);
    } else {
      navigate('/projects?placeModule=1');
    }
  }

  useEffect(() => {
    let live = true;
    async function load() {
      setLibraryLoading(true);
      setCatalogUnavailable(false);
      setStatus('Loading the catalog and project library…');
      if (activeProjectId) setMaterials([]);
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const authorization = session?.access_token ? { authorization: `Bearer ${session.access_token}` } : undefined;
      const tasks: Promise<void>[] = [];

      tasks.push(fetch(`${apiBase()}/catalog/modules`)
        .then(async (response) => {
          const payload = await response.json().catch(() => null);
          if (!response.ok) throw new Error(payload?.message ?? 'The modular catalog could not be loaded.');
          if (!Array.isArray(payload?.modules)) throw new Error('The modular catalog returned an invalid response.');
          if (live) setModules(payload.modules);
        }));

      if (supabase && activeProjectId && authorization) {
        tasks.push(fetch(`${apiBase()}/projects/${activeProjectId}/references`, { headers: authorization })
          .then(async (response) => {
            const payload = await response.json().catch(() => null);
            if (!response.ok || !Array.isArray(payload?.items)) throw new Error(payload?.message ?? 'Project visual references could not be loaded.');
            if (live) setItems(payload.items as LibraryItem[]);
          }));
      } else if (supabase && organizationId) {
        const client = supabase;
        tasks.push((async () => {
          const result = await client
            .from('reference_library_items')
            .select('id,title,kind,tags,notes,source,metadata,asset:project_assets(storage_path,mime_type)')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false });
          if (result.error) throw result.error;
          const prepared = await Promise.all(((result.data ?? []) as unknown as Array<LibraryItem & { asset?: Array<{ storage_path: string; mime_type: string }> }>).map(async (raw) => {
            const item = { ...raw, asset: raw.asset?.[0] ?? null } as LibraryItem;
            if (!item.asset?.storage_path || !item.asset.mime_type.startsWith('image/')) return item;
            const signed = await client.storage.from('project-assets').createSignedUrl(item.asset.storage_path, 3600);
            return { ...item, metadata: { ...item.metadata, previewUrl: signed.data?.signedUrl } };
          }));
          if (live) setItems(prepared);
        })());

        tasks.push((async () => {
          const user = (await supabase.auth.getUser()).data.user;
          if (!user) return;
          const membership = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).limit(1).maybeSingle();
          if (!membership.data?.organization_id) return;
          const result = await supabase.from('reference_vault_entries').select('id,title,source_path,room,module_family,style,material_tags,review_state,sha256,metadata').eq('organization_id', membership.data.organization_id).order('created_at', { ascending: false });
          if (!result.error && live) setVault((result.data ?? []) as VaultEntry[]);
        })());
      }

      if (activeProjectId && authorization) {
        tasks.push(fetch(`${apiBase()}/projects/${activeProjectId}/material-library`, { headers: authorization })
          .then(async (response) => {
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(payload?.message ?? 'The project material library could not be loaded.');
            if (live) setMaterials(Array.isArray(payload?.materials) ? payload.materials : []);
          }));
      }

      const outcomes = await Promise.allSettled(tasks);
      if (!live) return;
      setLibraryLoading(false);
      const failures = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
      const catalogFailed = outcomes[0]?.status === 'rejected';
      setCatalogUnavailable(catalogFailed);
      setStatus(catalogFailed
        ? 'The modular catalog could not be loaded. Check the API health and catalog route before placing modules.'
        : failures.length
          ? `Modular catalog loaded. ${failures.length} optional project library source${failures.length === 1 ? '' : 's'} could not be loaded.`
          : 'Modular catalog and available project library data are connected.');
    }
    void load();
    return () => { live = false; };
  }, [organizationId, activeProjectId, catalogRetry]);

  const search = query.trim().toLowerCase();
  const visibleTemplates = useMemo(() => items.filter((item) => {
    const matches = !search || `${item.title} ${item.kind} ${item.tags.join(' ')} ${item.notes}`.toLowerCase().includes(search);
    return matches && item.kind !== 'material' && item.kind !== 'module';
  }), [items, search]);
  const visibleModules = useMemo(() => modules.filter((item) =>
    (moduleFamily === 'all' || item.family === moduleFamily) &&
    (moduleRoom === 'all' || moduleSupportsRoom(item, moduleRoom)) &&
    (moduleCapability === 'all' || (moduleCapability === 'cutlist' ? item.production.cutlistSupported : !item.production.cutlistSupported)) &&
    (!search || `${item.name} ${item.family} ${item.tags.join(' ')} ${item.sku}`.toLowerCase().includes(search))),
  [modules, search, moduleFamily, moduleRoom, moduleCapability]);
  const visibleMaterials = useMemo(() => {
    // Project-scoped material records are authoritative, including an empty list.
    // The bundled samples are display-only and must never appear as project data.
    const allMaterials = activeProjectId ? materials : (materials.length ? materials : SAMPLE_MATERIAL_PALETTE);
    return allMaterials.filter((item) => {
      const matchesSearch = !search || `${item.name} ${item.code} ${item.category} ${item.finish ?? ''} ${item.supplier ?? ''}`.toLowerCase().includes(search);
      if (!matchesSearch) return false;
      if (materialCategory === 'all') return true;
      if (materialCategory === 'glossy') {
        return /gloss|acrylic|polygloss|mirror/i.test(`${item.name} ${item.finish} ${item.code}`);
      }
      if (materialCategory === 'matte') {
        return /matte|suede|zero-g|anti-fingerprint|soft-touch|velvet/i.test(`${item.name} ${item.finish} ${item.code}`) && !/gloss/i.test(`${item.name} ${item.finish}`);
      }
      if (materialCategory === 'woodgrain') {
        return /wood|oak|walnut|teak|birch|grain|veneer|flute|boiserie|slat/i.test(`${item.name} ${item.finish} ${item.category}`);
      }
      if (materialCategory === 'countertop') {
        return /countertop|slab|marble|travertine|porcelain|granite|sintered|terrazzo|stone|glass|profile|hardware|hinge|bracket/i.test(`${item.name} ${item.category} ${item.finish}`);
      }
      if (materialCategory === 'core_panel') {
        return /core|hdhmr|ply|plywood|marine|bwp|bwr|mdf|particle/i.test(`${item.name} ${item.category} ${item.code}`);
      }
      return item.category === materialCategory;
    });
  }, [materials, activeProjectId, search, materialCategory]);
  const visibleVault = useMemo(() => vault.filter((entry) => (vaultRoom === 'all' || entry.room === vaultRoom) && (vaultFamily === 'all' || entry.module_family === vaultFamily) && (vaultState === 'all' || entry.review_state === vaultState) && (!search || `${entry.title} ${entry.source_path} ${entry.room} ${entry.module_family} ${entry.style} ${(entry.material_tags ?? []).join(' ')} ${JSON.stringify(entry.metadata ?? {})}`.toLowerCase().includes(search))), [vault, vaultRoom, vaultFamily, vaultState, search]);
  const vaultValues = (field: 'room' | 'module_family' | 'review_state') => [...new Set(vault.map((entry) => entry[field]).filter(Boolean))].sort();
  async function updateVault(id: string, patch: Partial<VaultEntry>) { if (!supabase) return; const { error } = await supabase.from('reference_vault_entries').update(patch).eq('id', id); if (!error) setVault((current) => current.map((entry) => entry.id === id ? { ...entry, ...patch } : entry)); }
  async function deleteVault(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from('reference_vault_entries').update({ review_state: 'archived' }).eq('id', id);
    if (!error) setVault((current) => current.map((entry) => entry.id === id ? { ...entry, review_state: 'archived' } : entry));
    setArchiveTarget(null);
  }

  async function uploadReference() {
    if (!activeProjectId || !referenceFile || !supabase) {
      setStatus(!activeProjectId ? 'Open a project before adding a visual reference.' : 'Choose a PNG, JPEG, or WebP image to add it to this project library.');
      return;
    }
    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) { setStatus('Sign in before adding a project reference.'); return; }
    setUploadingReference(true);
    setStatus('Preparing a secure reference upload...');
    try {
      const headers = { authorization: `Bearer ${session.access_token}`, 'content-type': 'application/json' };
      const initiated = await fetch(`${apiBase()}/projects/${activeProjectId}/references/initiate`, { method: 'POST', headers, body: JSON.stringify({ fileName: referenceFile.name, mimeType: referenceFile.type, fileSize: referenceFile.size }) });
      const initiation = await initiated.json().catch(() => null);
      if (!initiated.ok || !initiation?.token || !initiation?.storagePath) throw new Error(initiation?.message ?? 'The secure upload could not be prepared.');
      const stored = await supabase.storage.from(initiation.bucket ?? 'project-assets').uploadToSignedUrl(initiation.storagePath, initiation.token, referenceFile, { contentType: referenceFile.type });
      if (stored.error) throw stored.error;
      setStatus('Verifying and indexing your reference...');
      const completed = await fetch(`${apiBase()}/projects/${activeProjectId}/references/complete`, {
        method: 'POST', headers,
        body: JSON.stringify({ assetId: initiation.assetId, storagePath: initiation.storagePath, fileName: referenceFile.name, mimeType: referenceFile.type, fileSize: referenceFile.size, title: referenceFile.name.replace(/\.[^.]+$/, ''), tags: referenceTags.split(',').map((tag) => tag.trim()).filter(Boolean) }),
      });
      const result = await completed.json().catch(() => null);
      if (!completed.ok || !result?.success) throw new Error(result?.message ?? 'The reference could not be saved.');
      if (!result.duplicate && result.item) setItems((current) => [{ ...result.item, asset: null }, ...current]);
      setActiveTab('templates'); setReferenceFile(null); setReferenceTags('');
      setStatus(result.duplicate ? 'Duplicate found: the existing reference was kept, and the extra upload was removed.' : 'Reference saved to this project library. It can now guide moodboards and renders.');
    } catch (error: any) {
      setStatus(error?.message ?? 'The reference upload could not be completed.');
    } finally { setUploadingReference(false); }
  }

  async function addStarterMaterials() {
    if (!activeProjectId || !supabase) {
      setStatus('Open this library from a project before creating its shared material palette.');
      return;
    }
    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) { setStatus('Sign in before creating a project material palette.'); return; }
    setAddingStarterMaterials(true);
    setStatus('Adding the curated laminate and edge-band starter palette…');
    try {
      const response = await fetch(`${apiBase()}/projects/${activeProjectId}/material-library/starter`, {
        method: 'POST',
        headers: { authorization: `Bearer ${session.access_token}`, 'content-type': 'application/json' },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) throw new Error(payload?.message ?? 'The starter material palette could not be created.');
      setMaterials(Array.isArray(payload.materials) ? payload.materials : []);
      setActiveTab('materials');
      setStatus(payload.note ?? 'Starter materials are ready for component-level assignment. Confirm supplier SKU and technical sheets before production.');
    } catch (error: any) {
      setStatus(error?.message ?? 'The starter material palette could not be created.');
    } finally {
      setAddingStarterMaterials(false);
    }
  }

  function emptyState(message: string) {
    return <div style={{ padding: '28px 0', color: '#78716c', fontSize: 14 }}>{message}</div>;
  }

  return (
    <div className="reference-library-workspace" style={{ padding: '24px 32px', maxWidth: 1440, margin: '0 auto' }}>
      {/* Lightbox Modal for High-Resolution Visual Inspection */}
      {previewModalItem && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(9, 9, 11, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'grid',
            placeItems: 'center',
            padding: 24,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPreviewModalItem(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="library-preview-title"
            style={{
              width: 'min(900px, 95vw)',
              background: '#18181b',
              border: '1.5px solid #3f3f46',
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: '0 25px 70px rgba(0, 0, 0, 0.8)',
              color: '#f4f4f5',
              maxHeight: '90vh',
            }}
            className="library-preview-dialog"
          >
            {/* Image Preview Container */}
            <div style={{ position: 'relative', minHeight: 280, height: 'min(62vh, 560px)', background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {previewModalItem.imageUnavailable ? (
                previewModalItem.module
                  ? <ModulePreview module={previewModalItem.module} interactive={false} />
                  : <span role="status" style={{ color: '#d6d3d1', padding: 24, textAlign: 'center' }}>This reference image is unavailable. The saved library entry is still here.</span>
              ) : (
                <img
                  src={previewModalItem.image}
                  alt={`Visual inspiration: ${previewModalItem.title}`}
                  onError={() => setPreviewModalItem((current) => current ? { ...current, imageUnavailable: true } : current)}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              )}
              <span style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                {previewModalItem.family?.replace('-', ' ') ?? 'Studio Reference'}
              </span>
            </div>

            {/* Technical Detail Sidebar */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: '1px solid #27272a' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 id="library-preview-title" style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>
                    {previewModalItem.title}
                  </h3>
                  <button
                    type="button"
                    aria-label="Close image preview"
                    onClick={() => setPreviewModalItem(null)}
                    style={{ border: 0, background: 'transparent', color: '#a1a1aa', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </div>

                {previewModalItem.dimensions && (
                  <div style={{ marginTop: 12, padding: '10px 12px', background: '#27272a', borderRadius: 8, border: '1px solid #3f3f46' }}>
                    <small style={{ display: 'block', color: '#a1a1aa', fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>
                      Parametric Dimensions
                    </small>
                    <strong style={{ fontSize: 13, fontFamily: 'monospace', color: '#34d399' }}>
                      {previewModalItem.dimensions}
                    </strong>
                  </div>
                )}

                {previewModalItem.sku && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#a1a1aa', fontFamily: 'monospace' }}>
                    SKU: <span style={{ color: '#fff' }}>{previewModalItem.sku}</span>
                  </div>
                )}

                <p style={{ marginTop: 16, fontSize: 12, color: '#d4d4d8', lineHeight: 1.5 }}>
                  {previewModalItem.description ?? 'Curated manufacturing-ready modular specification with verifiable technical clearances and panel cutlists.'}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {previewModalItem.module && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const mod = previewModalItem.module!;
                        const newItem: MoodboardItem = {
                          id: `mb-${Date.now()}`,
                          type: 'module',
                          title: mod.name,
                          subtitle: `${mod.widthMm}×${mod.heightMm}mm`,
                          x: 80 + Math.random() * 80,
                          y: 80 + Math.random() * 80,
                          width: 260,
                          height: 160,
                          zIndex: moodboardItems.length + 1,
                          module: mod,
                        };
                        setMoodboardItems((prev) => [...prev, newItem]);
                        setPreviewModalItem(null);
                        setActiveTab('moodboard');
                      }}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 10,
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: '#000',
                        fontWeight: 800,
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        border: 0,
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={15} /> Add to Active Moodboard
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const mod = previewModalItem.module!;
                        setPreviewModalItem(null);
                        placeModuleInProjectWallPicker(mod);
                      }}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 10,
                        background: 'linear-gradient(135deg, #c59c2d, #a0782c)',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        border: 0,
                        cursor: 'pointer',
                      }}
                    >
                      <Home size={15} /> 📐 Place in Room &amp; Wall Picker
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewModalItem(null)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: '#27272a',
                    border: '1px solid #3f3f46',
                    color: '#d4d4d8',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {archiveTarget && (
        <div role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(28,25,23,.38)', display: 'grid', placeItems: 'center', padding: 20 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setArchiveTarget(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="archive-reference-title" style={{ width: 'min(420px, 100%)', background: '#fff', borderRadius: 12, padding: 22, boxShadow: '0 20px 60px rgba(28,25,23,.2)' }}>
            <h2 id="archive-reference-title" style={{ margin: '0 0 8px', fontSize: 18, color: '#1c1917' }}>Archive this reference?</h2>
            <p style={{ margin: '0 0 18px', color: '#57534e', fontSize: 13, lineHeight: 1.5 }}>{archiveTarget.title} will leave active vault results but remain recoverable as archived.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setArchiveTarget(null)} style={{ border: '1px solid #d6d3d1', background: '#fff', color: '#57534e', borderRadius: 6, padding: '8px 12px', fontWeight: 700 }}>Cancel</button>
              <button type="button" onClick={() => void deleteVault(archiveTarget.id)} style={{ border: 0, background: '#991b1b', color: '#fff', borderRadius: 6, padding: '8px 12px', fontWeight: 700 }}>Archive reference</button>
            </div>
          </section>
        </div>
      )}

      {/* Header & Live Search Bar */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'end', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1c1917', margin: '0 0 6px' }}>Design Library</h1>
          <p style={{ color: '#78716c', fontSize: 14, margin: 0 }}>Choose a parametric module, build a client-facing finish board, or browse visual references. Measured project data stays separate.</p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, width: 320, border: '1.5px solid #d6d3d1', borderRadius: 10, background: '#fff', padding: '10px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <Search size={16} color="#78716c" />
          <input aria-label="Search design library" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search furniture, SKUs, finishes..." style={{ border: 0, outline: 0, width: '100%', fontSize: 13, color: '#1c1917' }} />
        </label>
      </div>

      <p role="status" style={{ margin: '0 0 16px', color: status.includes('could not') ? '#b45309' : '#78716c', fontSize: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
        {libraryLoading && <Loader2 className="ultida-spinner" size={14} aria-hidden="true" />}
        {status}
        {catalogUnavailable && <button type="button" onClick={() => setCatalogRetry((current) => current + 1)} disabled={libraryLoading} style={{ border: '1px solid #d6c7b4', borderRadius: 6, background: '#fff', color: '#5b4633', padding: '4px 8px', fontSize: 11, fontWeight: 700 }}>Retry catalog</button>}
      </p>

      {/* Add Reference Card */}
      <Card className="workflow" style={{ marginBottom: 20 }}>
        <CardContent style={{ display: 'flex', alignItems: 'end', gap: 12, flexWrap: 'wrap', padding: 16 }}>
          <div style={{ flex: '1 1 260px' }}>
            <strong style={{ display: 'block', fontSize: 14, color: '#1c1917', marginBottom: 4 }}>Add a visual reference</strong>
            <small style={{ color: '#78716c' }}>Use client or product images for style inspiration. They never set dimensions or production geometry.</small>
          </div>
          <label style={{ display: 'grid', gap: 5, fontSize: 12, color: '#57534e' }}>
            Image
            <input aria-label="Reference image" type="file" accept="image/png,image/jpeg,image/webp" disabled={!activeProjectId || uploadingReference} onChange={(event) => setReferenceFile(event.target.files?.[0] ?? null)} />
          </label>
          <label style={{ display: 'grid', gap: 5, fontSize: 12, color: '#57534e' }}>
            Tags
            <input aria-label="Reference tags" value={referenceTags} onChange={(event) => setReferenceTags(event.target.value)} placeholder="tv unit, fluted, warm wood" disabled={!activeProjectId || uploadingReference} style={{ border: '1px solid #d6d3d1', borderRadius: 6, padding: '8px 10px', fontSize: 13 }} />
          </label>
          <button type="button" onClick={() => void uploadReference()} disabled={!activeProjectId || !referenceFile || uploadingReference} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 0, borderRadius: 6, padding: '9px 12px', background: !activeProjectId || !referenceFile || uploadingReference ? '#d6d3d1' : '#3d2a1a', color: '#fff', fontWeight: 700, cursor: !activeProjectId || !referenceFile || uploadingReference ? 'not-allowed' : 'pointer' }}>
            <Upload size={15} /> {uploadingReference ? 'Adding...' : 'Add to library'}
          </button>
        </CardContent>
      </Card>

      {/* Main Tab Navigation */}
      <div role="tablist" aria-label="Design library sections" style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e7e5e4', marginBottom: 20, overflowX: 'auto' }}>
        {([
          ['modules', 'Modular Templates', LibraryIcon, visibleModules.length],
          ['moodboard', 'Moodboard Studio', Sparkles, moodboardItems.length],
          ['templates', activeProjectId ? 'Visual References' : 'Studio References', BookOpen, visibleTemplates.length + CURATED_VAULT_REFERENCES.length],
          ['materials', 'Project Materials', Palette, visibleMaterials.length],
          ['research', 'Research & Sourcing', Search, 4],
        ] as const).map(([id, label, Icon, count]) => (
          <button key={id} type="button" role="tab" aria-selected={activeTab === id} onClick={() => setActiveTab(id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', fontSize: 14, fontWeight: 700, color: activeTab === id ? '#8a6244' : '#78716c', borderBottom: activeTab === id ? '2.5px solid #c59c2d' : '2.5px solid transparent', background: activeTab === id ? 'rgba(197,156,45,0.06)' : 'none', borderRadius: '8px 8px 0 0', borderTop: 0, borderLeft: 0, borderRight: 0, cursor: 'pointer', transition: 'all 0.15s ease' }}>
            <Icon size={16} color={activeTab === id ? '#c59c2d' : '#78716c'} /> {label} <span style={{ color: activeTab === id ? '#c59c2d' : '#a8a29e', background: activeTab === id ? 'rgba(197,156,45,0.14)' : '#f3efe7', padding: '2px 7px', borderRadius: 999, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: MODULAR TEMPLATES */}
      {activeTab === 'research' && <ResearchSourcingPanel />}
      {activeTab === 'modules' && (
        <Card className="workflow">
          {/* Quick Filter Category Chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px 16px', background: '#faf8f5', borderBottom: '1px solid #ebdccb' }}>
            {[
              ['all', '✨ All Categories', null, null],
              ['living', '🛋️ Living & Lounges', null, 'living'],
              ['bedroom', '🛏️ Bedrooms & Beds', null, 'bedroom'],
              ['wardrobe', '🚪 Wardrobes', 'wardrobe', null],
              ['tv-unit', '📺 TV & Media Walls', 'tv-unit', null],
              ['kitchen', '🍳 Modular Kitchens', null, 'kitchen'],
              ['dining', '🍽️ Dining & Bars', null, 'dining'],
              ['pooja', '🪔 Sacred Mandirs', 'pooja', null],
              ['study', '💼 Study & Desks', 'study', null],
              ['lighting', '💡 Lighting & Decor', 'lighting', null],
              ['washroom', '🚿 Washrooms & Vanity', 'utility', 'utility'],
            ].map(([k, label, fFam, fRoom]) => {
              const isActive = (fFam ? moduleFamily === fFam : moduleRoom === (fRoom ?? 'all'));
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    if (fFam) {
                      setModuleFamily(moduleFamily === fFam ? 'all' : fFam);
                      setModuleRoom('all');
                    } else if (fRoom) {
                      setModuleRoom(moduleRoom === fRoom ? 'all' : fRoom);
                      setModuleFamily('all');
                    } else {
                      setModuleFamily('all');
                      setModuleRoom('all');
                    }
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 999,
                    border: isActive ? '1.5px solid var(--gold)' : '1px solid #d6d3d1',
                    background: isActive ? 'rgba(197,156,45,0.12)' : '#fff',
                    color: isActive ? 'var(--gold-dim)' : '#57534e',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div aria-label="Module production filter" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 16px', borderBottom: '1px solid #ebdccb' }}>
            <span style={{ color: '#78716c', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', marginRight: 4 }}>Catalog status</span>
            {([
              ['all', 'All templates'],
              ['cutlist', 'Cutlist-supported'],
              ['visual', 'Visual-only'],
            ] as const).map(([key, label]) => (
              <button key={key} type="button" aria-pressed={moduleCapability === key} onClick={() => setModuleCapability(key)} style={{ border: moduleCapability === key ? '1px solid #8a6244' : '1px solid #d6d3d1', borderRadius: 999, padding: '6px 11px', background: moduleCapability === key ? '#f2e8d8' : '#fff', color: moduleCapability === key ? '#593d29' : '#57534e', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {label}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', color: '#78716c', fontSize: 12 }}>{visibleModules.length} matching</span>
          </div>

          <CardHeader className="section-title">
            <div>
              <small>PARAMETRIC FURNITURE CATALOG</small>
              <h2>Choose a module that fits the design</h2>
              <p style={{ margin: '5px 0 0', fontSize: 12, color: '#78716c' }}>
                The technical preview comes from module data. Photos are style inspiration and do not define the built geometry.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                display: 'inline-flex',
                background: '#f5f4f0',
                padding: 3,
                borderRadius: 10,
                border: '1.5px solid #e7e3dc',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)',
              }}>
                <button
                  type="button"
                  onClick={() => setModuleImageMode('photo')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 7,
                    border: moduleImageMode === 'photo' ? '1px solid #dcd3c4' : 'none',
                    background: moduleImageMode === 'photo' ? '#ffffff' : 'transparent',
                    color: moduleImageMode === 'photo' ? '#1c1917' : '#78716c',
                    fontWeight: moduleImageMode === 'photo' ? 800 : 600,
                    fontSize: 12,
                    cursor: 'pointer',
                    boxShadow: moduleImageMode === 'photo' ? '0 2px 6px rgba(44, 34, 20, 0.08)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Camera size={13} style={{ color: moduleImageMode === 'photo' ? 'var(--gold, #c59c2d)' : '#a8a29e' }} />
                  Photorealistic Renders
                </button>
                <button
                  type="button"
                  onClick={() => setModuleImageMode('nobg')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 7,
                    border: moduleImageMode === 'nobg' ? '1px solid #dcd3c4' : 'none',
                    background: moduleImageMode === 'nobg' ? '#ffffff' : 'transparent',
                    color: moduleImageMode === 'nobg' ? '#1c1917' : '#78716c',
                    fontWeight: moduleImageMode === 'nobg' ? 800 : 600,
                    fontSize: 12,
                    cursor: 'pointer',
                    boxShadow: moduleImageMode === 'nobg' ? '0 2px 6px rgba(44, 34, 20, 0.08)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Layers size={13} style={{ color: moduleImageMode === 'nobg' ? 'var(--gold, #c59c2d)' : '#a8a29e' }} />
                  Isolated 3D Modules (No BG)
                </button>
              </div>
              <Badge tone="neutral">{visibleModules.filter((module) => module.production.cutlistSupported).length} cutlist-supported templates</Badge>
            </div>
          </CardHeader>

          <CardContent>
            {visibleModules.length ? (
              <div className="library-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
                {visibleModules.map((module) => {
                  const referenceImage = stableImageForModule(module);
                  const openModulePreview = () => {
                    if (!referenceImage) return;
                    setPreviewModalItem({
                      title: module.name,
                      image: referenceImage,
                      family: module.family,
                      dimensions: `${module.widthMm}W × ${module.depthMm}D × ${module.heightMm}H mm`,
                      description: module.description,
                      sku: module.sku,
                      module,
                    });
                  };
                  return (
                    <article key={module.id} className="library-item module-catalog-card">
                      <div
                        className="module-reference-frame"
                        role={referenceImage ? 'button' : undefined}
                        tabIndex={referenceImage ? 0 : undefined}
                        aria-label={referenceImage ? `Inspect visual reference for ${module.name}` : undefined}
                        onKeyDown={(event) => {
                          if (referenceImage && (event.key === 'Enter' || event.key === ' ')) {
                            event.preventDefault();
                            openModulePreview();
                          }
                        }}
                        style={{
                          cursor: referenceImage ? 'pointer' : 'default',
                          background: moduleImageMode === 'nobg' ? 'radial-gradient(circle at center, #ffffff 0%, #f4f2ee 100%)' : undefined,
                        }}
                        onClick={openModulePreview}
                      >
                        {moduleImageMode === 'nobg' || !referenceImage ? (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
                            <ModulePreview module={module} interactive={false} />
                          </div>
                        ) : (
                          <img
                            src={referenceImage}
                            alt={`${module.name} approved visual reference`}
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const sibling = e.currentTarget.parentElement?.querySelector('.module-preview-fallback') as HTMLElement | null;
                              if (sibling) sibling.style.display = 'flex';
                            }}
                          />
                        )}
                        <div className="module-preview-fallback" style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
                          <ModulePreview module={module} interactive={false} />
                        </div>
                        <span>{moduleImageMode === 'nobg' ? '📐 3D Parametric CAD Schematic (No BG)' : '📷 REFERENCE / INSPIRATION (Click to inspect)'}</span>
                      </div>
                      <div className="module-technical-strip">
                        <ModulePreview module={module} compact interactive={false} />
                        <div>
                          <strong>Parametric build</strong>
                          <small>{module.widthMm}W × {module.depthMm}D × {module.heightMm}H mm</small>
                          <small>{module.production.cutlistSupported ? 'Cutlist-supported template · placement still needs fit review' : 'Visual template · not supported for cutlist output'}</small>
                        </div>
                      </div>
                      <div className="module-card-copy">
                        <strong>{module.name}</strong>
                         <span>{module.family.replaceAll('-', ' ')} {module.digitalTwin ? `· ${module.digitalTwin.catalogVersion}` : ''}</span>
                        <p>{module.description ?? 'Configurable modular assembly with editable dimensions and component-level finishes.'}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                          <small>{module.sku} · {module.roomTypes.join(', ')}</small>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => {
                                const newItem: MoodboardItem = {
                                  id: `mb-${Date.now()}`,
                                  type: 'module',
                                  title: module.name,
                                  subtitle: `${module.widthMm}×${module.heightMm}mm`,
                                  x: 100 + Math.random() * 60,
                                  y: 100 + Math.random() * 60,
                                  width: 260,
                                  height: 160,
                                  zIndex: moodboardItems.length + 1,
                                  module,
                                };
                                setMoodboardItems((prev) => [...prev, newItem]);
                                setActiveTab('moodboard');
                              }}
                              style={{
                                border: '1.5px solid #d97706',
                                background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
                                color: '#92400e',
                                borderRadius: 8,
                                padding: '6px 11px',
                                fontSize: '11px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                boxShadow: '0 1px 3px rgba(217, 119, 6, 0.15)',
                                transition: 'all 0.15s ease',
                              }}
                              title="Add to project moodboard"
                            >
                              <Plus size={13} style={{ strokeWidth: 2.5 }} /> Board
                            </button>
                            {!module.tags.includes('scene-asset') && <button
                              type="button"
                              onClick={() => {
                                try {
                                  window.localStorage.setItem('ultida.pendingModulePlan.v1', JSON.stringify({
                                    schema: 'ultida.module-plan.v1',
                                    templateId: module.id,
                                    family: module.family,
                                    name: module.name,
                                    dimensionsMm: { width: module.widthMm, depth: module.depthMm, height: module.heightMm },
                                    wallWidthMm: module.widthMm,
                                    clearanceMm: 50,
                                  }));
                                } catch {
                                  // ignore
                                }
                                if (activeProjectId) {
                                  navigate(`/projects/${activeProjectId}/spaces?pendingModule=1`);
                                } else {
                                  navigate('/projects');
                                }
                              }}
                              style={{
                                border: '1.5px solid #15803d',
                                background: 'linear-gradient(135deg, #16a34a, #15803d)',
                                color: '#ffffff',
                                borderRadius: 8,
                                padding: '6px 13px',
                                fontSize: '11px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.28)',
                                transition: 'all 0.15s ease',
                              }}
                              title="Place this module directly on measured space wall elevation"
                            >
                              <Home size={13} style={{ strokeWidth: 2.2 }} /> Use in Room
                            </button>}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              emptyState(catalogUnavailable ? 'The furniture catalog is temporarily unavailable. Retry when the studio service is connected.' : 'No furniture modules match your search.')
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 2: MOODBOARD STUDIO */}
      {activeTab === 'moodboard' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
          <Card className="workflow">
            <CardHeader className="section-title">
              <div>
                <small>CUTOUT ASSETS</small>
                <h3 style={{ margin: '4px 0 0', fontSize: 15 }}>Add Items to Board</h3>
              </div>
            </CardHeader>
            <CardContent style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <strong style={{ display: 'block', fontSize: 11, color: '#78716c', textTransform: 'uppercase', marginBottom: 8 }}>Preset Themes</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button type="button" onClick={() => setMoodboardItems(MOODBOARD_PRESETS.living)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #ebdccb', background: '#fff', textAlign: 'left', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                    <span>🛋️ Warm Contemporary Living</span>
                    <span style={{ color: '#c59c2d' }}>5 items</span>
                  </button>
                  <button type="button" onClick={() => setMoodboardItems(MOODBOARD_PRESETS.bedroom)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #ebdccb', background: '#fff', textAlign: 'left', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                    <span>🛏️ Luxe Neutral Master Suite</span>
                    <span style={{ color: '#c59c2d' }}>4 items</span>
                  </button>
                  <button type="button" onClick={() => setMoodboardItems(MOODBOARD_PRESETS.dining)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #ebdccb', background: '#fff', textAlign: 'left', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                    <span>🍽️ Calacatta Gold Dining</span>
                    <span style={{ color: '#c59c2d' }}>4 items</span>
                  </button>
                </div>
              </div>

              <div>
                <strong style={{ display: 'block', fontSize: 11, color: '#78716c', textTransform: 'uppercase', marginBottom: 8 }}>Quick Add Cutouts</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button type="button" onClick={() => {
                    const newItem: MoodboardItem = { id: `mb-${Date.now()}`, type: 'module', title: 'Fluted TV Wall', subtitle: '2400mm floating unit', x: 80 + Math.random() * 80, y: 80 + Math.random() * 80, width: 260, height: 160, zIndex: moodboardItems.length + 1, module: { id: 'tv-fluted-2400', family: 'tv-unit', name: '2400 fluted media wall with floating console', roomTypes: ['living'], widthMm: 2400, depthMm: 400, heightMm: 2400, sku: 'ULT-TV-FLT-2400', tags: ['tv-wall', 'fluted'], production: { cutlistSupported: true } } };
                    setMoodboardItems(prev => [...prev, newItem]);
                  }} style={{ padding: '10px 8px', borderRadius: 8, border: '1px solid #e7e5e4', background: '#faf8f5', cursor: 'pointer', textAlign: 'center', fontSize: 11, fontWeight: 700 }}>
                    + Fluted TV Wall
                  </button>
                  <button type="button" onClick={() => {
                    const newItem: MoodboardItem = { id: `mb-${Date.now()}`, type: 'module', title: 'Curved Sofa', subtitle: '2800mm Boucle sectional', x: 80 + Math.random() * 80, y: 80 + Math.random() * 80, width: 270, height: 160, zIndex: moodboardItems.length + 1, module: { id: 'sofa-curved-boucle-2800', family: 'sofa', name: 'Curved Boucle Sofa', roomTypes: ['living'], widthMm: 2800, depthMm: 1600, heightMm: 800, sku: 'ULT-SF-CRV-2800', tags: ['sofa'], production: { cutlistSupported: false } } };
                    setMoodboardItems(prev => [...prev, newItem]);
                  }} style={{ padding: '10px 8px', borderRadius: 8, border: '1px solid #e7e5e4', background: '#faf8f5', cursor: 'pointer', textAlign: 'center', fontSize: 11, fontWeight: 700 }}>
                    + Curved Sofa
                  </button>
                  <button type="button" onClick={() => {
                    const newItem: MoodboardItem = { id: `mb-${Date.now()}`, type: 'module', title: 'Storage Bed', subtitle: '1800mm Hydraulic bed', x: 80 + Math.random() * 80, y: 80 + Math.random() * 80, width: 260, height: 160, zIndex: moodboardItems.length + 1, module: { id: 'bed-1800', family: 'bed', name: 'Hydraulic Storage Bed', roomTypes: ['bedroom'], widthMm: 1800, depthMm: 2100, heightMm: 1200, sku: 'ULT-BED-1800', tags: ['bed'], production: { cutlistSupported: true } } };
                    setMoodboardItems(prev => [...prev, newItem]);
                  }} style={{ padding: '10px 8px', borderRadius: 8, border: '1px solid #e7e5e4', background: '#faf8f5', cursor: 'pointer', textAlign: 'center', fontSize: 11, fontWeight: 700 }}>
                    + King Bed
                  </button>
                  <button type="button" onClick={() => {
                    const newItem: MoodboardItem = { id: `mb-${Date.now()}`, type: 'module', title: '4-Shutter Wardrobe', subtitle: '2100mm loft wardrobe', x: 80 + Math.random() * 80, y: 80 + Math.random() * 80, width: 260, height: 180, zIndex: moodboardItems.length + 1, module: { id: 'wardrobe-2100', family: 'wardrobe', name: '2100 4-Shutter Wardrobe', roomTypes: ['bedroom'], widthMm: 2100, depthMm: 600, heightMm: 2700, sku: 'ULT-WD-2100', tags: ['wardrobe'], production: { cutlistSupported: true } } };
                    setMoodboardItems(prev => [...prev, newItem]);
                  }} style={{ padding: '10px 8px', borderRadius: 8, border: '1px solid #e7e5e4', background: '#faf8f5', cursor: 'pointer', textAlign: 'center', fontSize: 11, fontWeight: 700 }}>
                    + Wardrobe
                  </button>
                  <button type="button" onClick={() => {
                    const newItem: MoodboardItem = { id: `mb-${Date.now()}`, type: 'module', title: 'Crockery & Bar', subtitle: '1800mm display unit', x: 80 + Math.random() * 80, y: 80 + Math.random() * 80, width: 250, height: 160, zIndex: moodboardItems.length + 1, module: { id: 'crockery-1800', family: 'crockery', name: '1800 Crockery Unit', roomTypes: ['dining'], widthMm: 1800, depthMm: 450, heightMm: 2400, sku: 'ULT-CR-1800', tags: ['crockery'], production: { cutlistSupported: true } } };
                    setMoodboardItems(prev => [...prev, newItem]);
                  }} style={{ padding: '10px 8px', borderRadius: 8, border: '1px solid #e7e5e4', background: '#faf8f5', cursor: 'pointer', textAlign: 'center', fontSize: 11, fontWeight: 700 }}>
                    + Crockery Unit
                  </button>
                  <button type="button" onClick={() => {
                    const newItem: MoodboardItem = { id: `mb-${Date.now()}`, type: 'module', title: 'Linen Floor Lamp', subtitle: '1650mm · warm 2700K', x: 80 + Math.random() * 80, y: 80 + Math.random() * 80, width: 180, height: 180, zIndex: moodboardItems.length + 1, module: { id: 'light-floor-linen-1650', family: 'lighting', name: '1650 Linen Shade Floor Lamp', roomTypes: ['living'], widthMm: 380, depthMm: 380, heightMm: 1650, sku: 'ULT-LGT-FLR-1650', tags: ['scene-asset', 'lighting', 'floor-lamp'], production: { cutlistSupported: false } } };
                    setMoodboardItems(prev => [...prev, newItem]);
                  }} style={{ padding: '10px 8px', borderRadius: 8, border: '1px solid #f0cf83', background: '#fff8eb', cursor: 'pointer', textAlign: 'center', fontSize: 11, fontWeight: 700 }}>
                    + Linen Floor Lamp
                  </button>
                  <button type="button" onClick={() => {
                    const newItem: MoodboardItem = { id: `mb-${Date.now()}`, type: 'module', title: 'Bronze Pendant', subtitle: '360mm · warm 3000K', x: 80 + Math.random() * 80, y: 80 + Math.random() * 80, width: 180, height: 180, zIndex: moodboardItems.length + 1, module: { id: 'light-pendant-bronze-360', family: 'lighting', name: '360 Bronze Dining Pendant', roomTypes: ['dining'], widthMm: 360, depthMm: 360, heightMm: 1650, sku: 'ULT-LGT-PND-360', tags: ['scene-asset', 'lighting', 'pendant'], production: { cutlistSupported: false } } };
                    setMoodboardItems(prev => [...prev, newItem]);
                  }} style={{ padding: '10px 8px', borderRadius: 8, border: '1px solid #f0cf83', background: '#fff8eb', cursor: 'pointer', textAlign: 'center', fontSize: 11, fontWeight: 700 }}>
                    + Bronze Pendant
                  </button>
                  <button type="button" onClick={() => {
                    const newItem: MoodboardItem = { id: `mb-${Date.now()}`, type: 'swatch', title: 'Italian Marble', subtitle: 'Polished Botticino', colorHex: '#E8DFD0', x: 80 + Math.random() * 80, y: 80 + Math.random() * 80, width: 140, height: 100, zIndex: moodboardItems.length + 1 };
                    setMoodboardItems(prev => [...prev, newItem]);
                  }} style={{ padding: '10px 8px', borderRadius: 8, border: '1px solid #e7e5e4', background: '#faf8f5', cursor: 'pointer', textAlign: 'center', fontSize: 11, fontWeight: 700 }}>
                    + Marble Swatch
                  </button>
                </div>
              </div>

              <p style={{ margin: 0, padding: '8px 10px', borderRadius: 7, background: '#fff8eb', color: '#7c5a22', fontSize: 10.5, lineHeight: 1.45 }}>
                Lighting assets are visual scene ingredients. They enrich moodboards and the compiled 3D schedule, and are deliberately excluded from fabrication cutlists.
              </p>

              <div>
                <strong style={{ display: 'block', fontSize: 11, color: '#78716c', textTransform: 'uppercase', marginBottom: 8 }}>Canvas Background</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {[
                    ['linen', '#f5f0e8', 'Linen'],
                    ['clay', '#ebe1d3', 'Clay'],
                    ['dark', '#221e1b', 'Dark'],
                    ['white', '#ffffff', 'White'],
                  ].map(([k, hex, label]) => (
                    <button key={k} type="button" onClick={() => setMoodboardBg(k as any)} style={{ padding: '6px 4px', borderRadius: 6, border: moodboardBg === k ? '2px solid var(--gold)' : '1px solid #d6d3d1', background: hex, color: k === 'dark' ? '#fff' : '#000', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button type="button" onClick={arrangeMoodboard} style={{ marginTop: 8, padding: '8px', borderRadius: 6, border: '1px solid #e7d7b7', background: '#fffaf0', color: '#7a5a22', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                Arrange board
              </button>
              <button type="button" onClick={() => setMoodboardItems([])} style={{ marginTop: 8, padding: '8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Trash2 size={13} /> Clear Moodboard
              </button>
            </CardContent>
          </Card>

          <div className="moodboard-board" style={{ background: moodboardBg === 'linen' ? '#f5f0e8' : moodboardBg === 'clay' ? '#ebe1d3' : moodboardBg === 'dark' ? '#1c1815' : '#ffffff', border: '1.5px solid #dfd5c7', borderRadius: 16, minHeight: 620, position: 'relative', padding: 24, boxShadow: '0 12px 36px rgba(0,0,0,0.08)' }}>
            <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 100, display: 'flex', gap: 8 }}>
              <span style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', fontSize: 11, fontWeight: 700, color: '#635243', border: '1px solid rgba(0,0,0,0.08)' }}>
                {moodboardItems.length} items · saved on this device
              </span>
            </div>
            <div role="note" style={{ position: 'absolute', left: 16, top: 16, maxWidth: 'min(420px, 72%)', padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.88)', color: '#635243', fontSize: 11 }}>
              Visual presentation only. These cards do not define measured room or construction geometry.
            </div>

            <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 560 }}>
              {moodboardItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedMbItem(item.id)}
                  onPointerDown={(event) => {
                    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
                    moodboardDragRef.current = { id: item.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, itemX: item.x, itemY: item.y };
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setSelectedMbItem(item.id);
                  }}
                  onPointerMove={(event) => {
                    const drag = moodboardDragRef.current;
                    if (!drag || drag.id !== item.id || drag.pointerId !== event.pointerId) return;
                    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
                    const maxX = bounds ? Math.max(0, bounds.width - item.width) : Number.POSITIVE_INFINITY;
                    const x = Math.max(0, Math.min(maxX, drag.itemX + event.clientX - drag.x));
                    const y = Math.max(0, drag.itemY + event.clientY - drag.y);
                    setMoodboardItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, x, y } : entry));
                  }}
                  onPointerUp={(event) => {
                    if (moodboardDragRef.current?.id !== item.id) return;
                    moodboardDragRef.current = null;
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                  }}
                  onPointerCancel={() => { moodboardDragRef.current = null; }}
                  onKeyDown={(event) => {
                    const delta = event.shiftKey ? 25 : 10;
                    const movement = event.key === 'ArrowLeft' ? [-delta, 0] : event.key === 'ArrowRight' ? [delta, 0] : event.key === 'ArrowUp' ? [0, -delta] : event.key === 'ArrowDown' ? [0, delta] : null;
                    if (!movement) return;
                    event.preventDefault();
                    setSelectedMbItem(item.id);
                    setMoodboardItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, x: Math.max(0, entry.x + movement[0]), y: Math.max(0, entry.y + movement[1]) } : entry));
                  }}
                  tabIndex={0}
                  aria-label={`${item.title}. Drag to move, or use arrow keys. Hold Shift for larger moves.`}
                  style={{
                    position: 'absolute',
                    left: item.x,
                    top: item.y,
                    width: item.width,
                    zIndex: item.zIndex,
                    background: item.type === 'swatch' ? item.colorHex : 'rgba(255,255,255,0.92)',
                    backdropFilter: item.type === 'swatch' ? undefined : 'blur(8px)',
                    border: selectedMbItem === item.id ? '2px solid var(--gold)' : '1px solid rgba(0,0,0,0.12)',
                    borderRadius: item.type === 'swatch' ? 12 : 14,
                    padding: item.type === 'reference' ? 0 : item.type === 'swatch' ? 12 : 10,
                    boxShadow: selectedMbItem === item.id ? '0 12px 28px rgba(197,156,45,0.25)' : '0 8px 24px rgba(0,0,0,0.12)',
                    cursor: 'grab',
                    touchAction: 'none',
                    transition: 'box-shadow 0.15s ease',
                  }}
                >
                  {item.type === 'module' && item.module && (
                    <div>
                      <div style={{ height: 110, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ModulePreview module={item.module} style={{ border: 0, background: 'transparent' }} />
                      </div>
                      <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ display: 'block', fontSize: 11, color: '#1c1917' }}>{item.title}</strong>
                          <small style={{ fontSize: 9.5, color: '#78716c' }}>{item.subtitle}</small>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMoodboardItems(prev => prev.filter(x => x.id !== item.id));
                          }}
                          style={{ border: 0, background: 'transparent', color: '#991b1b', cursor: 'pointer', padding: 2 }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}

                  {item.type === 'reference' && item.image && (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 12 }}>
                      <img src={item.image} alt={`Visual inspiration: ${item.title}`} loading="lazy" style={{ width: '100%', height: Math.max(80, item.height - 52), objectFit: 'cover', display: 'block' }} />
                      <div style={{ padding: '6px 8px', minHeight: 40, display: 'flex', gap: 6, justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ display: 'block', fontSize: 10, color: '#1c1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</strong>
                          <small style={{ fontSize: 9, color: '#78716c' }}>Inspiration only</small>
                        </div>
                        <button type="button" aria-label={`Remove ${item.title} from moodboard`} onClick={(event) => { event.stopPropagation(); setMoodboardItems((prev) => prev.filter((entry) => entry.id !== item.id)); }} style={{ border: 0, background: 'transparent', color: '#991b1b', cursor: 'pointer', padding: 2 }}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  )}

                  {item.type === 'swatch' && (
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', color: '#1c1917' }}>
                      <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', background: 'rgba(255,255,255,0.85)', padding: '2px 6px', borderRadius: 4, width: 'fit-content' }}>
                        Material
                      </span>
                      <div style={{ marginTop: 24, background: 'rgba(255,255,255,0.88)', padding: '4px 6px', borderRadius: 6 }}>
                        <strong style={{ display: 'block', fontSize: 11 }}>{item.title}</strong>
                        <small style={{ fontSize: 9.5, color: '#57534e' }}>{item.subtitle}</small>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Imported project imagery remains advisory and separate from certified module geometry. */}
      {activeTab === 'templates' && (
        <Card className="workflow">
          <div role="note" style={{ margin: 16, marginBottom: 0, padding: '10px 12px', border: '1px solid #ead8b5', borderRadius: 9, background: '#fffaf0', color: '#684c22', fontSize: 12 }}>
            <strong>Visual references only.</strong> Renders, collected inspiration, elevations, and material details do not establish room dimensions, module construction, supplier availability, or fabrication approval. Use measured project geometry and verified catalog data for those decisions.
          </div>
          {activeProjectId && <section aria-label="Imported visual references" style={{ padding: 16, borderBottom: '1px solid #ebdccb' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div><h2 style={{ margin: 0, fontSize: 16, color: '#29231e' }}>This project’s images</h2><p style={{ margin: '4px 0 0', color: '#78716c', fontSize: 12 }}>Visual guidance only · module sizes still come from the measured catalog.</p></div>
              <span style={{ fontSize: 12, color: '#78716c' }}>{visibleTemplates.length} imported</span>
            </div>
            {visibleTemplates.length ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
              {visibleTemplates.map((item) => <article key={item.id} style={{ overflow: 'hidden', border: '1px solid #e7e5e4', borderRadius: 9, background: '#fff' }}>
                {item.metadata?.previewUrl ? <img src={item.metadata.previewUrl} alt={`Visual reference: ${item.title}`} loading="lazy" style={{ width: '100%', height: 112, objectFit: 'cover', display: 'block' }} /> : <div style={{ height: 112, display: 'grid', placeItems: 'center', background: '#f5f1e8', color: '#8a6244', fontSize: 12 }}>Preview unavailable</div>}
                <div style={{ padding: 9 }}><strong style={{ display: 'block', fontSize: 12, color: '#29231e' }}>{item.title}</strong><small style={{ color: '#78716c' }}>{(item.tags ?? []).slice(0, 3).join(' · ') || 'Project reference'}</small></div>
              </article>)}
            </div> : <p style={{ margin: 0, padding: 14, borderRadius: 8, background: '#faf8f5', color: '#78716c', fontSize: 13 }}>No images added yet. Use “Add a visual reference” above to import a client or style image.</p>}
          </section>}
          {/* Browse by reference type, room, and design focus independently. */}
          <div style={{ display: 'grid', gap: 9, padding: '14px 16px', background: '#faf8f5', borderBottom: '1px solid #ebdccb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ width: 76, color: '#78716c', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>Reference</span>
              {REFERENCE_TYPE_FILTERS.map(([key, label]) => {
                const active = vaultReferenceType === key;
                const count = key === 'all' ? CURATED_VAULT_REFERENCES.length : CURATED_VAULT_REFERENCES.filter((ref) => referenceType(ref) === key).length;
                return <button key={key} type="button" aria-pressed={active} onClick={() => { setVaultReferenceType(key); setVaultRoom('all'); if (key !== 'rooms') setVaultFocus('all'); }} style={{ padding: '6px 10px', borderRadius: 999, border: active ? '1.5px solid var(--gold)' : '1px solid #d6d3d1', background: active ? 'rgba(197,156,45,.12)' : '#fff', color: active ? 'var(--gold-dim)' : '#57534e', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{label} <span style={{ opacity: .65 }}>{count}</span></button>;
              })}
            </div>
            {(vaultReferenceType === 'all' || vaultReferenceType === 'rooms') && <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <span style={{ width: 76, color: '#78716c', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>Room</span>
              {([['all', 'All rooms'], ...ROOM_REFERENCE_FILTERS] as const).map(([key, label]) => {
                const active = vaultRoom === key;
                const count = key === 'all' ? CURATED_VAULT_REFERENCES.filter((ref) => referenceType(ref) === 'rooms').length : CURATED_VAULT_REFERENCES.filter((ref) => referenceType(ref) === 'rooms' && referenceSpace(ref) === key).length;
                return <button key={key} type="button" aria-pressed={active} onClick={() => { setVaultRoom(key); setVaultReferenceType('rooms'); setVaultFocus('all'); }} style={{ padding: '5px 9px', borderRadius: 999, border: active ? '1.5px solid var(--gold)' : '1px solid #e7e0d6', background: active ? '#fff4d7' : '#fff', color: active ? '#765516' : '#57534e', fontSize: 11, fontWeight: 650, cursor: 'pointer' }}>{label} <span style={{ opacity: .6 }}>{count}</span></button>;
              })}
            </div>}
            {vaultReferenceType === 'rooms' && <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <span style={{ width: 76, color: '#78716c', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>Design focus</span>
              {['all', ...new Set(CURATED_VAULT_REFERENCES.filter((ref) => referenceType(ref) === 'rooms' && (vaultRoom === 'all' || referenceSpace(ref) === vaultRoom)).map(referenceFocusLabel))].map((focus) => {
                const active = vaultFocus === focus;
                const count = focus === 'all' ? CURATED_VAULT_REFERENCES.filter((ref) => referenceType(ref) === 'rooms' && (vaultRoom === 'all' || referenceSpace(ref) === vaultRoom)).length : CURATED_VAULT_REFERENCES.filter((ref) => referenceType(ref) === 'rooms' && (vaultRoom === 'all' || referenceSpace(ref) === vaultRoom) && referenceFocusLabel(ref) === focus).length;
                return <button key={focus} type="button" aria-pressed={active} onClick={() => { setVaultFocus(focus); setVaultReferenceType('rooms'); }} style={{ padding: '5px 9px', borderRadius: 999, border: active ? '1.5px solid #9c7740' : '1px solid #e7e0d6', background: active ? '#f3eada' : '#fff', color: active ? '#634720' : '#57534e', fontSize: 11, fontWeight: 650, cursor: 'pointer' }}>{focus === 'all' ? 'All design types' : focus} <span style={{ opacity: .6 }}>{count}</span></button>;
              })}
            </div>}
          </div>

          <CardContent style={{ padding: 16 }}>
            {(() => {
              const filteredReferences = CURATED_VAULT_REFERENCES.filter((ref) => {
                const matchType = vaultReferenceType === 'all' || referenceType(ref) === vaultReferenceType;
                const matchRoom = vaultRoom === 'all' || referenceSpace(ref) === vaultRoom;
                const matchFocus = vaultFocus === 'all' || referenceFocusLabel(ref) === vaultFocus;
                const matchQuery = !search || `${ref.title} ${ref.room} ${ref.family} ${ref.tags.join(' ')} ${ref.sourceName ?? ''} ${ref.kind ?? ''}`.toLowerCase().includes(search);
                return matchType && matchRoom && matchFocus && matchQuery;
              });

              if (!filteredReferences.length) {
                return emptyState('No studio references match your search.');
              }

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {filteredReferences.map((ref) => (
                    <article
                      key={ref.id}
                      style={{
                        background: '#fff',
                        borderRadius: 12,
                        overflow: 'hidden',
                        border: '1px solid #e7e5e4',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div
                        onClick={() => {
                          setPreviewModalItem({
                            image: ref.img,
                            title: ref.title,
                            family: ref.family,
                            description: referenceDescription(ref),
                          });
                        }}
                        style={{ position: 'relative', height: 190, background: '#1c1917', cursor: 'pointer', overflow: 'hidden' }}
                      >
                        <img
                          src={ref.img}
                          alt={ref.title}
                          loading="lazy"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            left: 10,
                            bottom: 10,
                            padding: '4px 8px',
                            borderRadius: 999,
                            background: 'rgba(0,0,0,0.75)',
                            backdropFilter: 'blur(6px)',
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                          }}
                        >
                          {referenceAuthorityLabel(ref)}
                        </span>
                      </div>

                      <div style={{ padding: '12px 14px 14px' }}>
                        <strong style={{ display: 'block', fontSize: 13.5, color: '#1c1917', marginBottom: 4 }}>
                          {referenceDisplayTitle(ref as RecentGalleryReference)}
                        </strong>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 7 }}>
                          {[REFERENCE_SPACE_LABELS[referenceSpace(ref)] ?? 'Interior reference', referenceFocusLabel(ref)].map((label, index) => <span key={`${ref.id}-label-${index}`} style={{ borderRadius: 999, padding: '3px 7px', background: '#f5efe3', color: '#71542c', fontSize: 10, fontWeight: 700 }}>{label}</span>)}
                        </div>
                        <small style={{ display: 'block', color: '#78716c', fontSize: 10, marginBottom: 8 }}>
                          Source: {ref.sourceBatch ?? 'Existing studio gallery'} · visual only
                        </small>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
                          {ref.tags.map((tag, index) => (
                            <span key={`${ref.id}-${tag}-${index}`} style={{ background: '#f5f5f4', color: '#78716c', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>
                              #{tag}
                            </span>
                          ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewModalItem({
                                image: ref.img,
                                title: ref.title,
                                family: ref.family,
                                description: referenceDescription(ref),
                              });
                            }}
                            style={{
                              border: 0,
                              background: 'transparent',
                              color: '#c59c2d',
                              fontSize: 11.5,
                              fontWeight: 700,
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            Inspect Full-Res ↗
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const newItem: MoodboardItem = {
                                id: `mb-${Date.now()}`,
                                type: 'reference',
                                title: ref.title,
                                subtitle: 'Visual inspiration only',
                                image: ref.img,
                                x: 100 + Math.random() * 60,
                                y: 100 + Math.random() * 60,
                                width: 200,
                                height: 120,
                                zIndex: moodboardItems.length + 1,
                              };
                              setMoodboardItems((prev) => [...prev, newItem]);
                              setActiveTab('moodboard');
                            }}
                            style={{
                              border: '1px solid var(--gold)',
                              background: 'rgba(197,156,45,0.1)',
                              color: 'var(--gold-dim)',
                              borderRadius: 6,
                              padding: '4px 8px',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Plus size={11} /> + To Board
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* TAB 4: PROJECT MATERIALS */}
      {activeTab === 'materials' && (
        <Card className="workflow">
          {/* Quick Filter Category Chips for Materials */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px 16px', background: '#faf8f5', borderBottom: '1px solid #ebdccb' }}>
            {[
              ['all', '✨ All', 'all'],
              ['glossy', '💎 High-Gloss & Acrylic', 'glossy'],
              ['matte', '🛡️ Super-Matte', 'matte'],
              ['woodgrain', '🪵 Woodgrain & Fluted', 'woodgrain'],
              ['countertop', '🏛️ Stone, Glass & Hardware', 'countertop'],
              ['core_panel', '🪵 Base Ply & Core', 'core_panel'],
            ].map(([k, label, fCat]) => {
              const isActive = (materialCategory === fCat);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMaterialCategory(fCat)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 999,
                    border: isActive ? '1.5px solid var(--gold)' : '1px solid #d6d3d1',
                    background: isActive ? 'rgba(197,156,45,0.12)' : '#fff',
                    color: isActive ? 'var(--gold-dim)' : '#57534e',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <CardHeader className="section-title">
            <div>
              <small>PALETTE, FINISHES &amp; SUBSTRATE SPECIFICATIONS</small>
              <h3 style={{ margin: '4px 0 0', fontSize: 16 }}>{activeProjectId ? 'This project’s material palette' : 'Sample finish palette'}</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#78716c' }}>
                {activeProjectId ? 'Saved project materials for client boards and component assignments. Verify supplier details before production.' : 'Visual examples only. These swatches have no supplier, stock, price, or production specification.'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Badge tone="neutral">{visibleMaterials.length} {activeProjectId ? 'saved materials' : 'visual samples'}</Badge>
              {activeProjectId && <button type="button" onClick={() => void addStarterMaterials()} disabled={addingStarterMaterials || libraryLoading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, borderRadius: 7, padding: '8px 11px', background: addingStarterMaterials ? '#d6d3d1' : '#3d2a1a', color: '#fff', fontSize: 12, fontWeight: 700, cursor: addingStarterMaterials ? 'wait' : 'pointer' }}>
                {addingStarterMaterials ? <Loader2 size={14} className="ultida-spinner" /> : <Plus size={14} />} Add starter palette
              </button>}
            </div>
          </CardHeader>
          <CardContent style={{ padding: 16 }}>
            {(() => {
              if (!visibleMaterials.length) {
                if (libraryLoading) return emptyState('Loading saved project materials…');
                if (activeProjectId && !search && materialCategory === 'all') {
                  return <div style={{ padding: '24px 0', color: '#78716c', fontSize: 14 }}>No materials are saved to this project yet. Add the starter palette above, or save materials from the project material workflow.</div>;
                }
                return emptyState('No materials match your search or selected filter.');
              }

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14 }}>
                  {visibleMaterials.map((mat) => {
                    const color = materialColour(mat);
                    const supplierVerified = Boolean(mat.metadata?.supplierVerifiedAt);
                    const availabilityVerifiedAt = mat.metadata?.availabilityVerifiedAt ?? mat.metadata?.stockVerifiedAt;
                    const availabilityDate = availabilityVerifiedAt ? Date.parse(availabilityVerifiedAt) : Number.NaN;
                    const availabilityLabel = Number.isFinite(availabilityDate)
                      ? `${mat.availability ?? 'Availability checked'} · ${new Date(availabilityDate).toLocaleDateString()}`
                      : 'Availability to confirm';
                    const isGloss = /gloss|acrylic|polygloss|mirror/i.test(`${mat.name} ${mat.finish}`);
                    const isMatte = /matte|suede|zero-g|anti-fingerprint|soft-touch/i.test(`${mat.name} ${mat.finish}`);
                    const isWood = /wood|oak|walnut|teak|birch|grain|veneer/i.test(`${mat.name} ${mat.finish}`);
                    const isCore = /hdhmr|ply|plywood|marine|bwp|bwr|mdf/i.test(`${mat.name} ${mat.category}`);
                    const isStone = /marble|travertine|porcelain|granite|sintered|terrazzo|slab/i.test(`${mat.name} ${mat.category}`);

                    return (
                      <article
                        key={mat.id}
                        style={{
                          background: '#fff',
                          borderRadius: 12,
                          overflow: 'hidden',
                          border: '1px solid #e7e5e4',
                          padding: 14,
                          boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          position: 'relative',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                            <div
                              style={{
                                width: 50,
                                height: 50,
                                borderRadius: 10,
                                background: color,
                                border: '1.5px solid rgba(0,0,0,0.15)',
                                flexShrink: 0,
                                boxShadow: isGloss ? '0 4px 12px rgba(255,255,255,0.4), inset 0 2px 6px rgba(255,255,255,0.6)' : 'inset 0 1px 4px rgba(0,0,0,0.2)',
                                position: 'relative',
                                overflow: 'hidden',
                              }}
                            >
                              {/* Gloss Sheen Reflection */}
                              {isGloss && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.1) 40%, transparent 60%)',
                                    pointerEvents: 'none',
                                  }}
                                />
                              )}
                              {/* Wood Grain Lines */}
                              {isWood && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    inset: 0,
                                    opacity: 0.25,
                                    backgroundImage: 'repeating-linear-gradient(90deg, #000 0px, #000 1px, transparent 1px, transparent 6px)',
                                    pointerEvents: 'none',
                                  }}
                                />
                              )}
                              {/* Core Board Green / Layer Stamp */}
                              {isCore && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    bottom: 2,
                                    right: 2,
                                    fontSize: 8,
                                    fontWeight: 900,
                                    color: '#fff',
                                    background: '#15803d',
                                    padding: '1px 3px',
                                    borderRadius: 3,
                                  }}
                                >
                                  CORE
                                </div>
                              )}
                            </div>
                            <div style={{ flex: 1 }}>
                              <strong style={{ fontSize: 13, color: '#1c1917', display: 'block', lineHeight: 1.3 }}>{mat.name}</strong>
                              <small style={{ fontSize: 10.5, color: '#78716c', fontFamily: 'monospace' }}>{mat.code}</small>
                            </div>
                          </div>

                          <div style={{ fontSize: 11.5, color: '#57534e', marginBottom: 12, lineHeight: 1.4 }}>
                            {materialSubtitle(mat)}
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid #f5f5f4' }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#785b22', background: '#fbf4e3', padding: '4px 7px', borderRadius: 5, lineHeight: 1.35 }} title="Supplier and stock claims require a dated verification before they are presented as confirmed.">
                            {mat.supplier ? `${mat.supplier}${supplierVerified ? '' : ' · verify supplier'}` : 'Supplier to confirm'} • {availabilityLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const newItem: MoodboardItem = {
                                id: `mb-${Date.now()}`,
                                type: 'swatch',
                                title: mat.name,
                                subtitle: mat.code,
                                colorHex: color,
                                x: 100 + Math.random() * 60,
                                y: 100 + Math.random() * 60,
                                width: 140,
                                height: 100,
                                zIndex: moodboardItems.length + 1,
                              };
                              setMoodboardItems((prev) => [...prev, newItem]);
                              setActiveTab('moodboard');
                            }}
                            style={{
                              border: '1px solid var(--gold)',
                              background: 'rgba(197,156,45,0.1)',
                              color: 'var(--gold-dim)',
                              borderRadius: 6,
                              padding: '4px 8px',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Plus size={11} /> + To Board
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Contextual actions stay in document flow so they never cover library cards. */}
      <div
        style={{
          marginTop: 28,
          marginBottom: 12,
          minHeight: 54,
          padding: '12px 16px',
          background: '#201b17',
          border: '1px solid rgba(197, 156, 45, 0.3)',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#c59c2d', boxShadow: '0 0 8px #c59c2d' }} />
          <div>
            <strong style={{ color: '#fff', fontSize: 12.5, display: 'inline', marginRight: 8 }}>
              Design Library &amp; Materials Vault
            </strong>
            <span style={{ color: '#a8a29e', fontSize: 11.5 }}>
              • {visibleModules.length} matching modules • {visibleMaterials.length} finishes shown
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => navigate(activeProjectId ? `/projects/${activeProjectId}/plan` : '/projects')}
            style={{
              background: '#2b2622',
              color: '#e7e5e4',
              border: '1px solid #44403c',
              borderRadius: 7,
              padding: '6px 14px',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 34,
            }}
          >
            Back to Studio
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeProjectId) {
                navigate(`/projects/${activeProjectId}/spaces`);
              } else {
                navigate('/projects');
              }
            }}
            style={{
              background: 'linear-gradient(135deg, #c59c2d, #a88220)',
              color: '#1c1917',
              border: 0,
              borderRadius: 7,
              padding: '6px 16px',
              fontWeight: 800,
              fontSize: 12.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 34,
              boxShadow: '0 2px 8px rgba(197,156,45,0.3)',
            }}
          >
            Open Configured Spaces <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export { UnifiedDesignLibraryWorkspace as ReferenceLibraryWorkspace };
