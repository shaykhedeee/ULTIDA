import { BookOpen, Library as LibraryIcon, Loader2, Palette, Search, Upload, Sparkles, Plus, Trash2, Layers, Move, Download, Layout, Check, ArrowRight, Home } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Card, CardContent, CardHeader } from '../ui/primitives';
import { supabase } from '../../lib/supabase';
import { ModulePreview } from './ModulePreview';

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
  } | null;
};

export type MoodboardItem = {
  id: string;
  type: 'module' | 'material' | 'swatch';
  title: string;
  subtitle?: string;
  colorHex?: string;
  module?: CatalogModule;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
};

const MOODBOARD_PRESETS: Record<string, MoodboardItem[]> = {
  living: [
    { id: 'mb-tv', type: 'module', title: 'Fluted TV Wall (2100mm)', subtitle: 'Floating console with warm LED', x: 40, y: 40, width: 280, height: 180, zIndex: 2, module: { id: 'tv-fluted-2100', family: 'tv-unit', name: '2100 fluted-panel TV wall', roomTypes: ['living'], widthMm: 2100, depthMm: 400, heightMm: 2300, sku: 'ULT-TV-FLUTE-2100', tags: ['tv-wall', 'fluted'], production: { cutlistSupported: true } } },
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
  kitchen: ['/reference-vault/001-ddc1891636f7.png', '/reference-vault/002-cab37cfa0bb2.png', '/reference-vault/003-1f61a8aabde4.png', '/reference-vault/004-ee04b56efde7.png', '/reference-vault/005-7919b88e0dc1.png', '/reference-vault/006-e36e2c7c9b1a.png'],
  'kitchen-base': ['/reference-vault/001-ddc1891636f7.png', '/reference-vault/003-1f61a8aabde4.png', '/reference-vault/034-355f624f691c.png'],
  'kitchen-wall': ['/reference-vault/002-cab37cfa0bb2.png', '/reference-vault/004-ee04b56efde7.png', '/reference-vault/035-78733d79d595.png'],
  'kitchen-tall': ['/reference-vault/003-1f61a8aabde4.png', '/reference-vault/005-7919b88e0dc1.png', '/reference-vault/036-de959cf3df44.png'],
  'kitchen-corner': ['/reference-vault/001-ddc1891636f7.png', '/reference-vault/006-e36e2c7c9b1a.png'],
  'tv-unit': ['/reference-vault/013-52a29a1053dc.png', '/reference-vault/014-685f67e3ff6f.png', '/reference-vault/015-5705e2ee9cb1.png', '/reference-vault/016-f106846da92c.png', '/reference-vault/017-cd2b9919c856.png', '/reference-vault/037-4dd8b6a25dc7.png', '/reference-vault/038-73c6d08adf93.png'],
  wardrobe: ['/reference-vault/007-2b9d568ff444.png', '/reference-vault/008-5fd497f005d8.png', '/reference-vault/009-f68e47674ead.png', '/reference-vault/010-a0dbdf361a50.png', '/reference-vault/011-6c55d3439149.png', '/reference-vault/012-5c60a01e5b86.png', '/reference-vault/039-1786da704c5a.png', '/reference-vault/040-a7dcd66e4242.png'],
  crockery: ['/reference-vault/013-52a29a1053dc.png', '/reference-vault/018-b7dd5f1492fe.png', '/reference-vault/019-a06a89855436.png', '/reference-vault/041-6770bf54ce43.png'],
  sofa: ['/reference-vault/020-ea872c640df6.png', '/reference-vault/021-5a47b71bad49.png', '/reference-vault/022-d6f4e9ee57d1.png', '/reference-vault/023-ae1e9b70744f.png', '/reference-vault/042-7eaf3dbfd306.png', '/reference-vault/043-71833d244d0d.png'],
  bed: ['/reference-vault/024-5976bb27ca03.png', '/reference-vault/025-adb09122c8d1.png', '/reference-vault/026-ebca5fba9a3f.png', '/reference-vault/027-3ee9dcdaca5c.png', '/reference-vault/044-577ed741688e.png', '/reference-vault/045-7ec65f321496.png'],
  dining: ['/reference-vault/028-a8f62ab3d392.png', '/reference-vault/029-640527178f8d.png', '/reference-vault/030-7bd7e8a977bf.png', '/reference-vault/046-fe27dfd45c96.png', '/reference-vault/047-c1ce4511e83d.png'],
  pooja: ['/reference-vault/031-6f3948f48928.png', '/reference-vault/032-ae224c73b5dc.png', '/reference-vault/048-ac94a44309b6.png', '/reference-vault/049-d1a18590223e.png'],
  study: ['/reference-vault/033-9d09b620a75e.png', '/reference-vault/050-a2b533693ac2.png', '/reference-vault/051-999d353af1d8.png', '/reference-vault/052-1d6904ef55a3.png'],
  utility: ['/reference-vault/053-edfb0eca9b46.png', '/reference-vault/054-c8fa00bd2c4b.png', '/reference-vault/055-e94b19f0e93f.png'],
  storage: ['/reference-vault/056-3bb2275767d2.png', '/reference-vault/057-da6cb4575090.png', '/reference-vault/058-b3d36c0c874b.png'],
  'false-ceiling': ['/reference-vault/059-28205fff47ae.png', '/reference-vault/060-70075531f7e7.png'],
};

const CURATED_VAULT_REFERENCES = [
  { id: 'ref-001', img: '/reference-vault/001-ddc1891636f7.png', room: 'kitchen', family: 'kitchen-base', title: 'Modular Kitchen Island & Suede Cabinets', tags: ['kitchen', 'island', 'matte-suede'] },
  { id: 'ref-002', img: '/reference-vault/002-cab37cfa0bb2.png', room: 'kitchen', family: 'kitchen-wall', title: 'Fluted Overhead Kitchen Units', tags: ['kitchen', 'overhead', 'fluted'] },
  { id: 'ref-003', img: '/reference-vault/003-1f61a8aabde4.png', room: 'kitchen', family: 'kitchen-tall', title: 'Full Height Appliance Pantry Tower', tags: ['kitchen', 'appliance', 'pantry'] },
  { id: 'ref-004', img: '/reference-vault/004-ee04b56efde7.png', room: 'kitchen', family: 'kitchen-wall', title: 'Glass Lift-Up Overhead Storage', tags: ['kitchen', 'lift-up', 'glass'] },
  { id: 'ref-005', img: '/reference-vault/005-7919b88e0dc1.png', room: 'kitchen', family: 'kitchen-tall', title: 'Integrated Refrigerator Tall Unit', tags: ['kitchen', 'built-in', 'tall'] },
  { id: 'ref-006', img: '/reference-vault/006-e36e2c7c9b1a.png', room: 'kitchen', family: 'kitchen-corner', title: 'Blind Corner Carousel Cabinet', tags: ['kitchen', 'corner', 'lemans'] },
  { id: 'ref-007', img: '/reference-vault/007-2b9d568ff444.png', room: 'bedroom', family: 'wardrobe', title: 'Tinted Profile-Glass Walk-In Wardrobe', tags: ['wardrobe', 'glass', 'walk-in'] },
  { id: 'ref-008', img: '/reference-vault/008-5fd497f005d8.png', room: 'bedroom', family: 'wardrobe', title: 'Floor-to-Ceiling 6-Shutter Wardrobe', tags: ['wardrobe', 'swing', 'loft'] },
  { id: 'ref-009', img: '/reference-vault/009-f68e47674ead.png', room: 'bedroom', family: 'wardrobe', title: 'Sliding Wardrobe with Fluted Veneer Center', tags: ['wardrobe', 'sliding', 'fluted'] },
  { id: 'ref-010', img: '/reference-vault/010-a0dbdf361a50.png', room: 'bedroom', family: 'wardrobe', title: 'Open Dressing Island with Watch Tray', tags: ['wardrobe', 'island', 'vanity'] },
  { id: 'ref-011', img: '/reference-vault/011-6c55d3439149.png', room: 'bedroom', family: 'wardrobe', title: 'Corner L-Shaped Wardrobe System', tags: ['wardrobe', 'corner', 'l-shaped'] },
  { id: 'ref-012', img: '/reference-vault/012-5c60a01e5b86.png', room: 'bedroom', family: 'wardrobe', title: 'Minimalist Gola Profile Wardrobe', tags: ['wardrobe', 'gola', 'handleless'] },
  { id: 'ref-013', img: '/reference-vault/013-52a29a1053dc.png', room: 'living', family: 'tv-unit', title: '2400mm Fluted TV Console Wall', tags: ['living', 'tv-wall', 'fluted'] },
  { id: 'ref-014', img: '/reference-vault/014-685f67e3ff6f.png', room: 'living', family: 'tv-unit', title: 'Minimalist Floating Backlit Media Wall', tags: ['living', 'tv-unit', 'floating'] },
  { id: 'ref-015', img: '/reference-vault/015-5705e2ee9cb1.png', room: 'living', family: 'tv-unit', title: 'TV Wall with Open Display Bookshelf', tags: ['living', 'tv-unit', 'bookshelf'] },
  { id: 'ref-016', img: '/reference-vault/016-f106846da92c.png', room: 'living', family: 'tv-unit', title: 'Acoustic Slat Partition TV Media Wall', tags: ['living', 'tv-unit', 'partition'] },
  { id: 'ref-017', img: '/reference-vault/017-cd2b9919c856.png', room: 'living', family: 'tv-unit', title: 'Curved Asymmetric Plaster & Wood TV Unit', tags: ['living', 'tv-unit', 'curved'] },
  { id: 'ref-018', img: '/reference-vault/018-b7dd5f1492fe.png', room: 'dining', family: 'crockery', title: '1800mm Full Height Bar & Wine Cabinet', tags: ['dining', 'bar', 'crockery'] },
  { id: 'ref-019', img: '/reference-vault/019-a06a89855436.png', room: 'dining', family: 'crockery', title: 'Floating Dining Sideboard Buffet', tags: ['dining', 'sideboard', 'floating'] },
  { id: 'ref-020', img: '/reference-vault/020-ea872c640df6.png', room: 'living', family: 'sofa', title: 'Curved Organic Bouclé Sectional Sofa', tags: ['living', 'sofa', 'boucle'] },
  { id: 'ref-021', img: '/reference-vault/021-5a47b71bad49.png', room: 'living', family: 'sofa', title: 'Deep Modular 3-Seater Cloud Couch', tags: ['living', 'sofa', 'lounge'] },
  { id: 'ref-022', img: '/reference-vault/022-d6f4e9ee57d1.png', room: 'living', family: 'sofa', title: 'Low-Slung Japandi Linen Sectional', tags: ['living', 'sofa', 'japandi'] },
  { id: 'ref-023', img: '/reference-vault/023-ae1e9b70744f.png', room: 'living', family: 'sofa', title: 'Cognac Saddle Leather Lounge Chairs', tags: ['living', 'armchair', 'leather'] },
  { id: 'ref-024', img: '/reference-vault/024-5976bb27ca03.png', room: 'bedroom', family: 'bed', title: 'Floating King Bed with Warm Underglow', tags: ['bedroom', 'bed', 'floating'] },
  { id: 'ref-025', img: '/reference-vault/025-adb09122c8d1.png', room: 'bedroom', family: 'bed', title: 'Extended Fluted Panel Headboard Bed', tags: ['bedroom', 'bed', 'headboard'] },
  { id: 'ref-026', img: '/reference-vault/026-ebca5fba9a3f.png', room: 'bedroom', family: 'bed', title: 'Upholstered Storage Bed with Nightstands', tags: ['bedroom', 'bed', 'storage'] },
  { id: 'ref-027', img: '/reference-vault/027-3ee9dcdaca5c.png', room: 'bedroom', family: 'bed', title: 'Japandi Platform Bed with Woven Accents', tags: ['bedroom', 'bed', 'platform'] },
  { id: 'ref-028', img: '/reference-vault/028-a8f62ab3d392.png', room: 'dining', family: 'dining', title: '2100mm Calacatta Marble Dining Table', tags: ['dining', 'table', 'calacatta'] },
  { id: 'ref-029', img: '/reference-vault/029-640527178f8d.png', room: 'dining', family: 'dining', title: 'Solid Smoked Oak 8-Seater Dining Set', tags: ['dining', 'table', 'oak'] },
  { id: 'ref-030', img: '/reference-vault/030-7bd7e8a977bf.png', room: 'dining', family: 'dining', title: 'Sculptural Round Travertine Dining Table', tags: ['dining', 'table', 'travertine'] },
  { id: 'ref-031', img: '/reference-vault/031-6f3948f48928.png', room: 'pooja', family: 'pooja', title: '1200mm Teakwood Pooja Mandir with CNC Jaali', tags: ['pooja', 'mandir', 'jaali'] },
  { id: 'ref-032', img: '/reference-vault/032-ae224c73b5dc.png', room: 'pooja', family: 'pooja', title: 'Modern Backlit Corian Mandir Shrine', tags: ['pooja', 'mandir', 'backlit'] },
  { id: 'ref-033', img: '/reference-vault/033-9d09b620a75e.png', room: 'study', family: 'study', title: 'Ergonomic Wall-Mounted Floating Study Desk', tags: ['study', 'desk', 'floating'] },
  { id: 'ref-034', img: '/reference-vault/034-355f624f691c.png', room: 'kitchen', family: 'kitchen-base', title: 'Tandem Cutlery & Pot Base Drawers', tags: ['kitchen', 'base', 'drawers'] },
  { id: 'ref-035', img: '/reference-vault/035-78733d79d595.png', room: 'kitchen', family: 'kitchen-wall', title: 'Integrated Task Lighting Overhead Cabinet', tags: ['kitchen', 'overhead', 'lighting'] },
  { id: 'ref-036', img: '/reference-vault/036-de959cf3df44.png', room: 'kitchen', family: 'kitchen-tall', title: 'Mid-Way Spice & Microwave Tall Unit', tags: ['kitchen', 'tall', 'microwave'] },
  { id: 'ref-037', img: '/reference-vault/037-4dd8b6a25dc7.png', room: 'living', family: 'tv-unit', title: 'Marble Sintered Stone TV Feature Panel', tags: ['living', 'tv-unit', 'stone'] },
  { id: 'ref-038', img: '/reference-vault/038-73c6d08adf93.png', room: 'living', family: 'tv-unit', title: 'French Wainscoting & Beading TV Wall', tags: ['living', 'tv-unit', 'wainscoting'] },
  { id: 'ref-039', img: '/reference-vault/039-1786da704c5a.png', room: 'bedroom', family: 'wardrobe', title: 'Integrated Vanity with Mirror LED Wardrobe', tags: ['wardrobe', 'vanity', 'mirror'] },
  { id: 'ref-040', img: '/reference-vault/040-a7dcd66e4242.png', room: 'bedroom', family: 'wardrobe', title: 'Leatherette Insert Shutter Wardrobe', tags: ['wardrobe', 'leather', 'luxe'] },
  { id: 'ref-041', img: '/reference-vault/041-6770bf54ce43.png', room: 'dining', family: 'crockery', title: 'Gold Brushed Trim Glass Crockery Shelf', tags: ['dining', 'crockery', 'brass'] },
  { id: 'ref-042', img: '/reference-vault/042-7eaf3dbfd306.png', room: 'living', family: 'sofa', title: 'Corner Sectional with Integrated End Table', tags: ['living', 'sofa', 'corner'] },
  { id: 'ref-043', img: '/reference-vault/043-71833d244d0d.png', room: 'living', family: 'sofa', title: 'Velvet Emerald Green Accent Armchairs', tags: ['living', 'armchair', 'velvet'] },
  { id: 'ref-044', img: '/reference-vault/044-577ed741688e.png', room: 'bedroom', family: 'bed', title: 'Tufted Velvet Headboard with Brass Trim', tags: ['bedroom', 'bed', 'velvet'] },
  { id: 'ref-045', img: '/reference-vault/045-7ec65f321496.png', room: 'bedroom', family: 'bed', title: 'Kids Bunk Bed System with Study & Stairs', tags: ['bedroom', 'kids', 'bunk-bed'] },
  { id: 'ref-046', img: '/reference-vault/046-fe27dfd45c96.png', room: 'dining', family: 'dining', title: '6-Seater Ceramic Top Expandable Table', tags: ['dining', 'table', 'ceramic'] },
  { id: 'ref-047', img: '/reference-vault/047-c1ce4511e83d.png', room: 'dining', family: 'dining', title: 'Leather Upholstered Bucket Dining Chairs', tags: ['dining', 'chairs', 'leather'] },
  { id: 'ref-048', img: '/reference-vault/048-ac94a44309b6.png', room: 'pooja', family: 'pooja', title: 'Brass Inlay Wooden Sacred Pooja Unit', tags: ['pooja', 'mandir', 'brass'] },
  { id: 'ref-049', img: '/reference-vault/049-d1a18590223e.png', room: 'pooja', family: 'pooja', title: 'Pooja Cabinet with Sliding Jaali Doors', tags: ['pooja', 'mandir', 'sliding'] },
  { id: 'ref-050', img: '/reference-vault/050-a2b533693ac2.png', room: 'study', family: 'study', title: 'Dual Workstation Home Office Library', tags: ['study', 'office', 'dual'] },
  { id: 'ref-051', img: '/reference-vault/051-999d353af1d8.png', room: 'study', family: 'study', title: 'Compact Niche Study with Pinboard & Shelf', tags: ['study', 'niche', 'shelf'] },
  { id: 'ref-052', img: '/reference-vault/052-1d6904ef55a3.png', room: 'study', family: 'study', title: 'Executive Walnut Desk with Leather Blotter', tags: ['study', 'desk', 'walnut'] },
  { id: 'ref-053', img: '/reference-vault/053-edfb0eca9b46.png', room: 'utility', family: 'utility', title: 'Washing Machine Surround & Ironing Unit', tags: ['utility', 'laundry', 'storage'] },
  { id: 'ref-054', img: '/reference-vault/054-c8fa00bd2c4b.png', room: 'utility', family: 'utility', title: 'Utility Sink Base Cabinet & Broom Tall Unit', tags: ['utility', 'sink', 'broom'] },
  { id: 'ref-055', img: '/reference-vault/055-e94b19f0e93f.png', room: 'utility', family: 'utility', title: 'Overhead Drying Rack & Laundry Basket Niche', tags: ['utility', 'drying', 'laundry'] },
  { id: 'ref-056', img: '/reference-vault/056-3bb2275767d2.png', room: 'storage', family: 'storage', title: 'Foyer Shoe Storage Bench with Cushion', tags: ['storage', 'foyer', 'shoe-rack'] },
  { id: 'ref-057', img: '/reference-vault/057-da6cb4575090.png', room: 'storage', family: 'storage', title: 'Linen Closet with Slatted Ventilated Trays', tags: ['storage', 'linen', 'closet'] },
  { id: 'ref-058', img: '/reference-vault/058-b3d36c0c874b.png', room: 'storage', family: 'storage', title: 'Under-Stair Pull-Out Storage Modules', tags: ['storage', 'under-stair', 'modular'] },
  { id: 'ref-059', img: '/reference-vault/059-28205fff47ae.png', room: 'false-ceiling', family: 'false-ceiling', title: 'Cove Light Floating Gypsum False Ceiling', tags: ['false-ceiling', 'cove', 'lighting'] },
  { id: 'ref-060', img: '/reference-vault/060-70075531f7e7.png', room: 'false-ceiling', family: 'false-ceiling', title: 'Wooden Rafters & Perimeter Magnetic Track Ceiling', tags: ['false-ceiling', 'rafter', 'magnetic-track'] },
];

const DEFAULT_PROJECT_MATERIALS: Material[] = [
  { id: 'mat-1', name: 'Action TESA HDHMR Core', code: 'CORE-HDHMR-18', category: 'core_panel', finish: 'Unlaminated Pre-primed', thickness_mm: 18, edge_band_status: 'required', edge_band_thickness_mm: 1, supplier: 'Action TESA', availability: 'in_stock', metadata: { colorHex: '#84735c' } },
  { id: 'mat-2', name: '710 Grade BWR Marine Plywood', code: 'CORE-BWR-19', category: 'core_panel', finish: 'Calibrated Hardwood Core', thickness_mm: 19, edge_band_status: 'required', edge_band_thickness_mm: 1, supplier: 'Century Ply', availability: 'in_stock', metadata: { colorHex: '#9b744a' } },
  { id: 'mat-3', name: 'Fluted Charcoal Matte PU Panel', code: 'SHUT-FLUTE-PU', category: 'laminate', finish: 'Fluted Suede PU Touch', thickness_mm: 18, edge_band_status: 'not_required', supplier: 'Royal Crown', availability: 'in_stock', metadata: { colorHex: '#332f2c' } },
  { id: 'mat-4', name: 'Zero-G 2mm Matte Suede Laminate', code: 'SHUT-LAM-SUEDE', category: 'laminate', finish: 'Anti-Fingerprint Matte', thickness_mm: 2, edge_band_status: 'required', edge_band_thickness_mm: 2, supplier: 'Merino Laminates', availability: 'in_stock', metadata: { colorHex: '#d8cbbe' } },
  { id: 'mat-5', name: 'Calacatta Gold Sintered Porcelain Slab', code: 'SLAB-CAL-GOLD', category: 'countertop', finish: 'Bookmatched Polished', thickness_mm: 12, edge_band_status: 'not_required', supplier: 'Laminam', availability: 'in_stock', metadata: { colorHex: '#f3efe8' } },
  { id: 'mat-6', name: 'Roman Travertine Honed Stone Slab', code: 'SLAB-TRAV-ROMAN', category: 'countertop', finish: 'Honed Matte Unfilled', thickness_mm: 20, edge_band_status: 'not_required', supplier: 'Artisan Stone Works', availability: 'in_stock', metadata: { colorHex: '#cfbc9f' } },
  { id: 'mat-7', name: 'Tinted Fluted Aluminium Profile Glass', code: 'GLAS-FLUTED-TINT', category: 'profile_glass', finish: 'Graphite Anodized Profile', thickness_mm: 8, edge_band_status: 'not_required', supplier: 'Hafele Glass', availability: 'in_stock', metadata: { colorHex: '#4d5557' } },
  { id: 'mat-8', name: 'Camar 807 Heavy Duty Wall Hanging Bracket', code: 'HARD-CAMAR-807', category: 'hardware', finish: 'Zinc Plated Steel (240kg)', thickness_mm: 0, edge_band_status: 'not_required', supplier: 'Camar Italy', availability: 'in_stock', metadata: { colorHex: '#a1a1aa' } },
  { id: 'mat-9', name: 'Blum Tandembox Antaro Soft-Close Drawers', code: 'HARD-BLUM-ANTARO', category: 'hardware', finish: 'Silk White 500mm / 65kg', thickness_mm: 0, edge_band_status: 'not_required', supplier: 'Blum Austria', availability: 'in_stock', metadata: { colorHex: '#e4e4e7' } },
];

function stableImageForModule(module: CatalogModule) {
  const images = MODULE_REFERENCE_IMAGES[module.family] ?? MODULE_REFERENCE_IMAGES[module.family.split('-')[0]];
  if (!images?.length) return null;
  const seed = [...module.id].reduce((total, character) => total + character.charCodeAt(0), 0);
  return images[seed % images.length];
}

function apiBase() {
  const configured = String(import.meta.env.VITE_API_BASE ?? '').trim();
  const isLocalTarget = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/api\/?$/i.test(configured);
  if (typeof window !== 'undefined' && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(window.location.origin) && isLocalTarget) return '/api';
  return configured || '/api';
}

function materialSubtitle(material: Material) {
  const thickness = material.thickness_mm ? `${material.thickness_mm}mm sheet` : '';
  const edge = material.edge_band_status === 'not_required' ? 'edge band integrated' : material.edge_band_thickness_mm ? `${material.edge_band_thickness_mm}mm edge` : '';
  return [material.category, material.finish, thickness, edge, material.supplier, material.availability]
    .filter(Boolean)
    .join(' · ');
}

function materialColour(material: Material) {
  const candidate = material.metadata?.colourHex ?? material.metadata?.colorHex;
  return /^#[0-9a-f]{6}$/i.test(candidate ?? '') ? candidate! : '#d6c1a7';
}

export function UnifiedDesignLibraryWorkspace({ organizationId, projectId }: { organizationId?: string | null; projectId?: string | null }) {
  const navigate = useNavigate();
  const { projectId: urlProjectId } = useParams<{ projectId?: string }>();
  const activeProjectId = projectId ?? urlProjectId ?? null;

  const [activeTab, setActiveTab] = useState<'templates' | 'modules' | 'moodboard' | 'materials'>('modules');
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [modules, setModules] = useState<CatalogModule[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [moodboardItems, setMoodboardItems] = useState<MoodboardItem[]>(MOODBOARD_PRESETS.living);
  const [moodboardBg, setMoodboardBg] = useState<'linen' | 'clay' | 'dark' | 'white'>('linen');
  const [selectedMbItem, setSelectedMbItem] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceTags, setReferenceTags] = useState('');
  const [uploadingReference, setUploadingReference] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [status, setStatus] = useState('Loading modular catalog…');
  const [vault, setVault] = useState<VaultEntry[]>([]);
  const [vaultRoom, setVaultRoom] = useState('all');
  const [vaultFamily, setVaultFamily] = useState('all');
  const [vaultState, setVaultState] = useState('all');
  const [moduleFamily, setModuleFamily] = useState('all');
  const [moduleRoom, setModuleRoom] = useState('all');
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
  } | null>(null);

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
      navigate(`/projects/${activeProjectId}/spaces?tab=modules`);
    } else {
      navigate('/projects?placeModule=1');
    }
  }

  useEffect(() => {
    let live = true;
    async function load() {
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

      if (supabase && organizationId) {
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

      if (projectId && authorization) {
        tasks.push(fetch(`${apiBase()}/projects/${projectId}/material-library`, { headers: authorization })
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
      setStatus(catalogFailed
        ? 'The modular catalog could not be loaded. Check the API health and catalog route before placing modules.'
        : failures.length
          ? `Modular catalog loaded. ${failures.length} optional project library source${failures.length === 1 ? '' : 's'} could not be loaded.`
          : 'Modular catalog and available project library data are connected.');
    }
    void load();
    return () => { live = false; };
  }, [organizationId, projectId]);

  const search = query.trim().toLowerCase();
  const visibleTemplates = useMemo(() => items.filter((item) => {
    const matches = !search || `${item.title} ${item.kind} ${item.tags.join(' ')} ${item.notes}`.toLowerCase().includes(search);
    return matches && item.kind !== 'material' && item.kind !== 'module';
  }), [items, search]);
  const visibleModules = useMemo(() => modules.filter((item) => (moduleFamily === 'all' || item.family === moduleFamily) && (moduleRoom === 'all' || item.roomTypes.includes(moduleRoom)) && (!search || `${item.name} ${item.family} ${item.tags.join(' ')} ${item.sku}`.toLowerCase().includes(search))), [modules, search, moduleFamily, moduleRoom]);
  const visibleMaterials = useMemo(() => materials.filter((item) => !search || `${item.name} ${item.code} ${item.category} ${item.supplier ?? ''}`.toLowerCase().includes(search)), [materials, search]);
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
    if (!projectId || !referenceFile || !supabase) {
      setStatus(!projectId ? 'Open a project before adding studio references.' : 'Choose a PNG, JPEG, or WebP image to add it to this project library.');
      return;
    }
    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) { setStatus('Sign in before adding a project reference.'); return; }
    setUploadingReference(true);
    setStatus('Preparing a secure reference upload...');
    try {
      const headers = { authorization: `Bearer ${session.access_token}`, 'content-type': 'application/json' };
      const initiated = await fetch(`${apiBase()}/projects/${projectId}/references/initiate`, { method: 'POST', headers, body: JSON.stringify({ fileName: referenceFile.name, mimeType: referenceFile.type, fileSize: referenceFile.size }) });
      const initiation = await initiated.json().catch(() => null);
      if (!initiated.ok || !initiation?.token || !initiation?.storagePath) throw new Error(initiation?.message ?? 'The secure upload could not be prepared.');
      const stored = await supabase.storage.from(initiation.bucket ?? 'project-assets').uploadToSignedUrl(initiation.storagePath, initiation.token, referenceFile, { contentType: referenceFile.type });
      if (stored.error) throw stored.error;
      setStatus('Verifying and indexing your reference...');
      const completed = await fetch(`${apiBase()}/projects/${projectId}/references/complete`, {
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
    if (!projectId || !supabase) {
      setStatus('Open this library from a project before creating its shared material palette.');
      return;
    }
    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) { setStatus('Sign in before creating a project material palette.'); return; }
    setAddingStarterMaterials(true);
    setStatus('Adding the curated laminate and edge-band starter palette…');
    try {
      const response = await fetch(`${apiBase()}/projects/${projectId}/material-library/starter`, {
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
    <div style={{ padding: '24px 32px', maxWidth: 1440, margin: '0 auto' }}>
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
          <div
            style={{
              width: 'min(900px, 95vw)',
              background: '#18181b',
              border: '1.5px solid #3f3f46',
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: '0 25px 70px rgba(0, 0, 0, 0.8)',
              color: '#f4f4f5',
              display: 'grid',
              gridTemplateColumns: '1fr 340px',
            }}
          >
            {/* Image Preview Container */}
            <div style={{ position: 'relative', height: 480, background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={previewModalItem.image}
                alt={previewModalItem.title}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
              <span style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                {previewModalItem.family?.replace('-', ' ') ?? 'Studio Reference'}
              </span>
            </div>

            {/* Technical Detail Sidebar */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: '1px solid #27272a' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>
                    {previewModalItem.title}
                  </h3>
                  <button
                    type="button"
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
          </div>
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
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1c1917', margin: '0 0 6px' }}>Design Library & Moodboard Studio</h1>
          <p style={{ color: '#78716c', fontSize: 14, margin: 0 }}>Verified System 32 modular furniture, curated reference renders, and live project finish boards.</p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, width: 320, border: '1.5px solid #d6d3d1', borderRadius: 10, background: '#fff', padding: '10px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <Search size={16} color="#78716c" />
          <input aria-label="Search design library" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search furniture, SKUs, finishes..." style={{ border: 0, outline: 0, width: '100%', fontSize: 13, color: '#1c1917' }} />
        </label>
      </div>

      <p role="status" style={{ margin: '0 0 16px', color: status.includes('could not') ? '#b45309' : '#78716c', fontSize: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
        {libraryLoading && <Loader2 className="ultida-spinner" size={14} aria-hidden="true" />}
        {status}
      </p>

      {/* Add Reference Card */}
      <Card className="workflow" style={{ marginBottom: 20 }}>
        <CardContent style={{ display: 'flex', alignItems: 'end', gap: 12, flexWrap: 'wrap', padding: 16 }}>
          <div style={{ flex: '1 1 260px' }}>
            <strong style={{ display: 'block', fontSize: 14, color: '#1c1917', marginBottom: 4 }}>Add a project reference</strong>
            <small style={{ color: '#78716c' }}>Images are advisory inspiration; approved plan and scene data stay authoritative.</small>
          </div>
          <label style={{ display: 'grid', gap: 5, fontSize: 12, color: '#57534e' }}>
            Image
            <input aria-label="Reference image" type="file" accept="image/png,image/jpeg,image/webp" disabled={!projectId || uploadingReference} onChange={(event) => setReferenceFile(event.target.files?.[0] ?? null)} />
          </label>
          <label style={{ display: 'grid', gap: 5, fontSize: 12, color: '#57534e' }}>
            Tags
            <input aria-label="Reference tags" value={referenceTags} onChange={(event) => setReferenceTags(event.target.value)} placeholder="tv unit, fluted, warm wood" disabled={!projectId || uploadingReference} style={{ border: '1px solid #d6d3d1', borderRadius: 6, padding: '8px 10px', fontSize: 13 }} />
          </label>
          <button type="button" onClick={() => void uploadReference()} disabled={!projectId || !referenceFile || uploadingReference} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 0, borderRadius: 6, padding: '9px 12px', background: !projectId || !referenceFile || uploadingReference ? '#d6d3d1' : '#3d2a1a', color: '#fff', fontWeight: 700, cursor: !projectId || !referenceFile || uploadingReference ? 'not-allowed' : 'pointer' }}>
            <Upload size={15} /> {uploadingReference ? 'Adding...' : 'Add to library'}
          </button>
        </CardContent>
      </Card>

      {/* Main Tab Navigation */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e7e5e4', marginBottom: 20, overflowX: 'auto' }}>
        {([
          ['modules', 'Modular Templates', LibraryIcon, visibleModules.length],
          ['moodboard', 'Moodboard Studio', Sparkles, moodboardItems.length],
          ['templates', 'Studio References', BookOpen, visibleTemplates.length],
          ['materials', 'Project Materials', Palette, visibleMaterials.length],
        ] as const).map(([id, label, Icon, count]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', fontSize: 14, fontWeight: 700, color: activeTab === id ? '#8a6244' : '#78716c', borderBottom: activeTab === id ? '2.5px solid #c59c2d' : '2.5px solid transparent', background: activeTab === id ? 'rgba(197,156,45,0.06)' : 'none', borderRadius: '8px 8px 0 0', borderTop: 0, borderLeft: 0, borderRight: 0, cursor: 'pointer', transition: 'all 0.15s ease' }}>
            <Icon size={16} color={activeTab === id ? '#c59c2d' : '#78716c'} /> {label} <span style={{ color: activeTab === id ? '#c59c2d' : '#a8a29e', background: activeTab === id ? 'rgba(197,156,45,0.14)' : '#f3efe7', padding: '2px 7px', borderRadius: 999, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: MODULAR TEMPLATES */}
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

          <CardHeader className="section-title">
            <div>
              <small>PARAMETRIC MODULES + PRODUCTION GEOMETRY</small>
              <h2>Professional furniture catalog backed by System 32 standards</h2>
              <p style={{ margin: '5px 0 0', fontSize: 12, color: '#78716c' }}>
                Click any render reference for high-resolution inspection. Dimensions and panel cutlists are guaranteed.
              </p>
            </div>
            <Badge tone="success">{visibleModules.filter((module) => module.production.cutlistSupported).length} cutlist-ready</Badge>
          </CardHeader>

          <CardContent>
            {visibleModules.length ? (
              <div className="library-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
                {visibleModules.map((module) => {
                  const referenceImage = stableImageForModule(module);
                  return (
                    <article key={module.id} className="library-item module-catalog-card">
                      <div
                        className="module-reference-frame"
                        style={{ cursor: referenceImage ? 'pointer' : 'default' }}
                        onClick={() => {
                          if (referenceImage) {
                            setPreviewModalItem({
                              title: module.name,
                              image: referenceImage,
                              family: module.family,
                              dimensions: `${module.widthMm}W × ${module.depthMm}D × ${module.heightMm}H mm`,
                              description: module.description,
                              sku: module.sku,
                              module,
                            });
                          }
                        }}
                      >
                        {referenceImage ? (
                          <img
                            src={referenceImage}
                            alt={`${module.name} approved visual reference`}
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const sibling = e.currentTarget.parentElement?.querySelector('.module-preview-fallback') as HTMLElement | null;
                              if (sibling) sibling.style.display = 'block';
                            }}
                          />
                        ) : (
                          <ModulePreview module={module} />
                        )}
                        <div className="module-preview-fallback" style={{ display: 'none', width: '100%', height: '100%' }}>
                          <ModulePreview module={module} />
                        </div>
                        <span>Approved style reference (click to inspect)</span>
                      </div>
                      <div className="module-technical-strip">
                        <ModulePreview module={module} compact />
                        <div>
                          <strong>Parametric build</strong>
                          <small>{module.widthMm}W × {module.depthMm}D × {module.heightMm}H mm</small>
                          <small>{module.production.cutlistSupported ? 'Scene + cutlist ready' : 'Concept configuration'}</small>
                        </div>
                      </div>
                      <div className="module-card-copy">
                        <strong>{module.name}</strong>
                        <span>{module.family.replaceAll('-', ' ')}</span>
                        <p>{module.description ?? 'Configurable modular assembly with editable dimensions and component-level finishes.'}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                          <small>{module.sku} · {module.roomTypes.join(', ')}</small>
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
                              border: '1px solid var(--gold)',
                              background: 'rgba(197,156,45,0.1)',
                              color: 'var(--gold-dim)',
                              borderRadius: 6,
                              padding: '5px 10px',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Plus size={12} /> Add to Board
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              emptyState('No furniture modules match your search.')
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
                    const newItem: MoodboardItem = { id: `mb-${Date.now()}`, type: 'module', title: 'Fluted TV Wall', subtitle: '2100mm floating unit', x: 80 + Math.random() * 80, y: 80 + Math.random() * 80, width: 260, height: 160, zIndex: moodboardItems.length + 1, module: { id: 'tv-fluted-2100', family: 'tv-unit', name: '2100 fluted-panel TV wall', roomTypes: ['living'], widthMm: 2100, depthMm: 400, heightMm: 2300, sku: 'ULT-TV-FLUTE-2100', tags: ['tv-wall', 'fluted'], production: { cutlistSupported: true } } };
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
                    const newItem: MoodboardItem = { id: `mb-${Date.now()}`, type: 'swatch', title: 'Italian Marble', subtitle: 'Polished Botticino', colorHex: '#E8DFD0', x: 80 + Math.random() * 80, y: 80 + Math.random() * 80, width: 140, height: 100, zIndex: moodboardItems.length + 1 };
                    setMoodboardItems(prev => [...prev, newItem]);
                  }} style={{ padding: '10px 8px', borderRadius: 8, border: '1px solid #e7e5e4', background: '#faf8f5', cursor: 'pointer', textAlign: 'center', fontSize: 11, fontWeight: 700 }}>
                    + Marble Swatch
                  </button>
                </div>
              </div>

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

              <button type="button" onClick={() => setMoodboardItems([])} style={{ marginTop: 8, padding: '8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Trash2 size={13} /> Clear Moodboard
              </button>
            </CardContent>
          </Card>

          <div style={{ background: moodboardBg === 'linen' ? '#f5f0e8' : moodboardBg === 'clay' ? '#ebe1d3' : moodboardBg === 'dark' ? '#1c1815' : '#ffffff', border: '1.5px solid #dfd5c7', borderRadius: 16, minHeight: 620, position: 'relative', overflow: 'hidden', padding: 24, boxShadow: '0 12px 36px rgba(0,0,0,0.08)' }}>
            <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 100, display: 'flex', gap: 8 }}>
              <span style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', fontSize: 11, fontWeight: 700, color: '#635243', border: '1px solid rgba(0,0,0,0.08)' }}>
                {moodboardItems.length} Cutout Assets Layered
              </span>
            </div>

            <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 560 }}>
              {moodboardItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedMbItem(item.id)}
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
                    padding: item.type === 'swatch' ? 12 : 10,
                    boxShadow: selectedMbItem === item.id ? '0 12px 28px rgba(197,156,45,0.25)' : '0 8px 24px rgba(0,0,0,0.12)',
                    cursor: 'grab',
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
      {/* TAB 3: STUDIO REFERENCES (ALL 60 PRODUCTION VAULT RENDERS) */}
      {activeTab === 'templates' && (
        <Card className="workflow">
          {/* Quick Filter Category Chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px 16px', background: '#faf8f5', borderBottom: '1px solid #ebdccb' }}>
            {[
              ['all', '✨ All 60 References', 'all'],
              ['living', '🛋️ Living & Lounges', 'living'],
              ['bedroom', '🛏️ Bedrooms & Beds', 'bedroom'],
              ['wardrobe', '🚪 Wardrobes & Closets', 'wardrobe'],
              ['kitchen', '🍳 Modular Kitchens', 'kitchen'],
              ['dining', '🍽️ Dining & Bars', 'dining'],
              ['pooja', '🪔 Sacred Mandirs', 'pooja'],
              ['study', '💼 Study & Desks', 'study'],
              ['utility', '🧺 Utility & Laundry', 'utility'],
              ['storage', '🗄️ Foyer & Storage', 'storage'],
              ['false-ceiling', '✨ False Ceilings', 'false-ceiling'],
            ].map(([k, label, fRoom]) => {
              const isActive = (vaultRoom === fRoom);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setVaultRoom(isActive && fRoom !== 'all' ? 'all' : (fRoom as any))}
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

          <CardContent style={{ padding: 16 }}>
            {(() => {
              const filteredReferences = CURATED_VAULT_REFERENCES.filter((ref) => {
                const matchRoom = vaultRoom === 'all' || ref.room === vaultRoom || ref.family === vaultRoom;
                const matchQuery = !search || `${ref.title} ${ref.room} ${ref.family} ${ref.tags.join(' ')}`.toLowerCase().includes(search);
                return matchRoom && matchQuery;
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
                            description: `Curated masterclass design reference for ${ref.room.toUpperCase()} - ${ref.tags.join(', ')}.`,
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
                          {ref.room} · {ref.family}
                        </span>
                      </div>

                      <div style={{ padding: '12px 14px 14px' }}>
                        <strong style={{ display: 'block', fontSize: 13.5, color: '#1c1917', marginBottom: 4 }}>
                          {ref.title}
                        </strong>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
                          {ref.tags.map((tag) => (
                            <span key={tag} style={{ background: '#f5f5f4', color: '#78716c', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>
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
                                description: `Curated masterclass design reference for ${ref.room.toUpperCase()} - ${ref.tags.join(', ')}.`,
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
                                type: 'swatch',
                                title: ref.title,
                                subtitle: `${ref.room.toUpperCase()} Reference`,
                                colorHex: '#c59c2d',
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
          <CardHeader className="section-title">
            <div>
              <small>PALETTE & FINISHES</small>
              <h3 style={{ margin: '4px 0 0', fontSize: 16 }}>Curated Materials Library</h3>
            </div>
          </CardHeader>
          <CardContent style={{ padding: 16 }}>
            {(() => {
              const allMaterials = materials.length ? materials : DEFAULT_PROJECT_MATERIALS;
              const filteredMaterials = allMaterials.filter((mat) => {
                return !search || `${mat.name} ${mat.code} ${mat.category} ${mat.supplier ?? ''}`.toLowerCase().includes(search);
              });

              if (!filteredMaterials.length) {
                return emptyState('No materials match your search.');
              }

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                  {filteredMaterials.map((mat) => {
                    const color = materialColour(mat);
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
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 8,
                                background: color,
                                border: '1px solid rgba(0,0,0,0.15)',
                                flexShrink: 0,
                                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)',
                              }}
                            />
                            <div>
                              <strong style={{ fontSize: 13, color: '#1c1917', display: 'block' }}>{mat.name}</strong>
                              <small style={{ fontSize: 10.5, color: '#78716c', fontFamily: 'monospace' }}>{mat.code}</small>
                            </div>
                          </div>

                          <div style={{ fontSize: 11.5, color: '#57534e', marginBottom: 12, lineHeight: 1.4 }}>
                            {materialSubtitle(mat)}
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid #f5f5f4' }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '2px 6px', borderRadius: 4 }}>
                            {mat.availability ?? 'In Stock'}
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
    </div>
  );
}

export { UnifiedDesignLibraryWorkspace as ReferenceLibraryWorkspace };
