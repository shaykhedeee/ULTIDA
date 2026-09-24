import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Sparkles, Eye, Maximize2, Minimize2, Bookmark, Check, Plus,
  Search, Filter, ChevronLeft, ChevronRight, X, Download, Share2,
  Layers, Palette, Ruler, Home, ArrowRight, ShieldCheck, Image as ImageIcon
} from 'lucide-react';

export type RenderedSpace = {
  id: string;
  title: string;
  room: 'living' | 'bedroom' | 'kitchen' | 'dining' | 'pooja' | 'study' | 'vanity' | 'foyer';
  roomLabel: string;
  imageUrl: string;
  style: string;
  materials: string[];
  dimensionsDesc: string;
  highlights: string[];
  designNotes: string;
  isCustom?: boolean;
};

const DEFAULT_RENDERED_SPACES: RenderedSpace[] = [
  {
    id: 'rnd-liv-01',
    title: '5,030mm Grand TV Media Wall & Floating Console',
    room: 'living',
    roomLabel: 'Formal Living & Lounge',
    imageUrl: '/reference-vault/013-52a29a1053dc.png',
    style: 'Contemporary Minimalist Luxury',
    materials: ['Smoked Oak Veneer', 'Backlit Onyx Slab', 'Charcoal Fluted PU', 'Brushed Brass PVD'],
    dimensionsDesc: '5,030mm W × 2,850mm H × 400mm D',
    highlights: ['Warm 3000K recessed perimeter halo LED', 'Concealed push-to-open media drawers', 'Acoustic slatted side louvers'],
    designNotes: 'Designed for high-end luxury villas. Carcass built using 18mm HDHMR with synchronized oak veneer and seamless 2mm edge banding.',
  },
  {
    id: 'rnd-liv-02',
    title: 'Acoustic Slat Room Partition & Media Display',
    room: 'living',
    roomLabel: 'Formal Living & Lounge',
    imageUrl: '/reference-vault/016-f106846da92c.png',
    style: 'Modern Biophilic Architecture',
    materials: ['Natural Dune Oak', 'Black Powdercoated Aluminum', 'Soft Velvet Fabric'],
    dimensionsDesc: '3,600mm W × 2,750mm H × 350mm D',
    highlights: ['Semi-private architectural slat partition', 'Floating low-profile console box', 'Integrated cable management chase'],
    designNotes: 'Provides visual separation between foyer and formal living while maintaining spatial continuity and light diffusion.',
  },
  {
    id: 'rnd-bed-01',
    title: 'Master Bedroom Suite: 4-Door Wardrobe & Floating Desk',
    room: 'bedroom',
    roomLabel: 'Master Bedroom Suite',
    imageUrl: '/reference-vault/007-2b9d568ff444.png',
    style: 'Scandinavian Luxury',
    materials: ['Cashmere Super-Matte', 'Fluted Tinted Profile Glass', 'Natural Oak Carcass', 'Brushed Gold Handles'],
    dimensionsDesc: '2,900mm W × 2,790mm H × 600mm D',
    highlights: ['Full-height lofts with 3mm shadowline reveal', 'Sensor-activated internal LED wardrobe rods', 'Integrated work-from-home study desk'],
    designNotes: 'Floor-to-ceiling wardrobe with dedicated double hanging bays, interior pull-out accessory trays, and System 32 shelf pitch.',
  },
  {
    id: 'rnd-bed-02',
    title: '2,977mm Master 4-Shutter Wardrobe & Vanity Niche',
    room: 'bedroom',
    roomLabel: 'Master Bedroom Suite',
    imageUrl: '/reference-vault/008-5fd497f005d8.png',
    style: 'Luxury Contemporary Villa',
    materials: ['Natural Oak Grain Laminate', 'Warm Ivory Linen Carcass', 'Blum Obsidian Hinges'],
    dimensionsDesc: '2,977mm W × 2,700mm H × 600mm D',
    highlights: ['Continuous vertical grain matching', '30mm flush wall scribing fillers', '3mm perimeter door reveals'],
    designNotes: 'Master wardrobe following Singhania Villa joinery standard. Precision CNC factory bored with 37mm hinge setback.',
  },
  {
    id: 'rnd-bed-03',
    title: 'Sage Green Arched Wardrobe with LED Display Niche',
    room: 'bedroom',
    roomLabel: 'Kids / Guest Bedroom',
    imageUrl: '/reference-vault/025-adb09122c8d1.png',
    style: 'Neo-Classical Soft Luxury',
    materials: ['Velvet Sage Matte PU', 'Calacatta Quartz Ledge', 'Fluted Glass Tower'],
    dimensionsDesc: '3,200mm W × 2,700mm H × 600mm D',
    highlights: ['CNC routed archway shutter profiles', 'Vertical display tower with glass shelves', 'Warm 2700K ambient shelf lighting'],
    designNotes: 'Custom routed MDF shutters coated in automotive polyurethane lacquer with anti-yellowing UV barrier.',
  },
  {
    id: 'rnd-kit-01',
    title: 'Gourmet Show Kitchen: L-Shaped Counter & Fluted Overheads',
    room: 'kitchen',
    roomLabel: 'Gourmet Chef Kitchen',
    imageUrl: '/reference-vault/042-7eaf3dbfd306.png',
    style: 'European Ultra-Modern Minimalist',
    materials: ['High-Gloss Pure White Acrylic', 'Smoked Teak Veneer', 'Calacatta Gold Quartz Slab'],
    dimensionsDesc: '4,200mm × 3,100mm L-Shaped Run',
    highlights: ['Gola handleless profile system', 'Blum Legrabox tandem pot drawers', 'Bi-fold lift-up frosted glass cabinets'],
    designNotes: 'Built entirely from 19mm Boiling Water Proof (BWP) marine plywood carcass with acrylic shutter cladding and 2mm laser edge banding.',
  },
  {
    id: 'rnd-kit-02',
    title: 'Modular Tall Appliance Tower & Microwave Garage',
    room: 'kitchen',
    roomLabel: 'Gourmet Chef Kitchen',
    imageUrl: '/reference-vault/003-1f61a8aabde4.png',
    style: 'Sleek Built-In Architecture',
    materials: ['Anthracite Super-Matte', 'Graphite Anodized Gola', 'Tinted Fluted Glass'],
    dimensionsDesc: '1,800mm W × 2,400mm H × 600mm D',
    highlights: ['Integrated Siemens dual oven cavity', 'Heavy-duty 6-tier pullout pantry larder', 'Under-plinth continuous strip LED'],
    designNotes: 'Engineered with heavy-duty heat ventilation baffles and 65kg-rated soft-close tandem runners.',
  },
  {
    id: 'rnd-din-01',
    title: '1,800mm Fluted Crockery Console & Overhead Wine Bar',
    room: 'dining',
    roomLabel: 'Dining Room & Bar',
    imageUrl: '/reference-vault/002-cab37cfa0bb2.png',
    style: 'Modern Luxe Dining Bar',
    materials: ['Smoked Crown Walnut', 'Tinted Fluted Glass', 'Botticino Marble Countertop', 'Brushed Brass Trims'],
    dimensionsDesc: '1,800mm W × 2,400mm H × 450mm D',
    highlights: ['Stemware hanging rack with LED glow', 'Push-to-open bottom crockery drawers', 'Fluted solid wood back paneling'],
    designNotes: 'Features mirrored internal backing with tempered 8mm glass shelves supported by precision CNC brass pin sleeves.',
  },
  {
    id: 'rnd-poo-01',
    title: '1,775mm Sacred Sanctuary (Walk-In Pooja Mandir)',
    room: 'pooja',
    roomLabel: 'Sacred Sanctuary (Pooja Mandir)',
    imageUrl: '/reference-vault/020-ea872c640df6.png',
    style: 'Vedic Heritage Contemporary',
    materials: ['Pure Makrana White Marble', 'CNC Brass Jaali Lattice', 'Warm Teak Wood Shutter', 'Backlit Onyx OM'],
    dimensionsDesc: '1,775mm W × 2,700mm H × 600mm D',
    highlights: ['Traditional CNC jaali archway with back-lighting', 'Concealed pull-out brass prasadam & thali tray', 'Incense drawer with brass venting'],
    designNotes: 'Complies 100% with Ishanya (North-East) Vastu Shastra orientation. Heat-resistant stone altar bed.',
  },
  {
    id: 'rnd-stu-01',
    title: 'Executive Study Desk & Integrated Library Wall',
    room: 'study',
    roomLabel: 'Executive Study & Library',
    imageUrl: '/reference-vault/011-6c55d3439149.png',
    style: 'Mid-Century Executive Modern',
    materials: ['Smoked Crown Walnut', 'Suede Ivory Linen', 'Matte Black Hardware'],
    dimensionsDesc: '2,400mm W × 2,700mm H × 600mm D Desk',
    highlights: ['Cantilevered 50mm solid-core worktop', 'Floating overhead bookshelves with book stops', 'Built-in wireless phone chargers'],
    designNotes: 'High-density load-bearing shelves engineered to prevent sag under dense art book collections.',
  },
  {
    id: 'rnd-van-01',
    title: '1,500mm Spa Vanity Suite with Backlit Fluted Mirror',
    room: 'vanity',
    roomLabel: 'Master Vanity Spa',
    imageUrl: '/reference-vault/029-640527178f8d.png',
    style: 'Boutique Hotel Spa',
    materials: ['Waterproof Marine Ply', 'Calacatta Vein Sintered Stone', 'Matte Black PVD Faucets'],
    dimensionsDesc: '1,500mm W × 850mm H × 550mm D',
    highlights: ['Wall-hung floating vanity cabinet', 'Dual undermount ceramic basins', 'Concealed medicine cabinet behind touch-mirror'],
    designNotes: '100% waterproof construction with silicone-sealed perimeter edges and corrosion-resistant 304-grade stainless hardware.',
  },
];

export function RenderedSpacesLibrary() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId?: string }>();
  const [spaces, setSpaces] = useState<RenderedSpace[]>(() => {
    try {
      const custom = window.localStorage.getItem('ultida_custom_uploaded_renders');
      if (custom) {
        const parsed = JSON.parse(custom);
        if (Array.isArray(parsed)) return [...parsed, ...DEFAULT_RENDERED_SPACES];
      }
    } catch {}
    return DEFAULT_RENDERED_SPACES;
  });

  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [presentationSpace, setPresentationSpace] = useState<RenderedSpace | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [attachModalSpace, setAttachModalSpace] = useState<RenderedSpace | null>(null);
  const [targetRoomToAttach, setTargetRoomToAttach] = useState<string>('Master Bedroom');
  const [attachmentNote, setAttachmentNote] = useState<string>('');
  const [attachSuccess, setAttachSuccess] = useState<boolean>(false);

  // New render upload state
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadRoom, setUploadRoom] = useState<RenderedSpace['room']>('living');
  const [uploadStyle, setUploadStyle] = useState<string>('Luxury Contemporary');
  const [uploadImageUrl, setUploadImageUrl] = useState<string>('');
  const [uploadMaterials, setUploadMaterials] = useState<string>('Smoked Oak, Acrylic, Brass');
  const [uploadNotes, setUploadNotes] = useState<string>('');

  // Attached references mapping
  const [attachedReferences, setAttachedReferences] = useState<Record<string, { renderId: string; title: string; imageUrl: string; note: string }>>(() => {
    try {
      const stored = window.localStorage.getItem('ultida_room_attached_references');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const filteredSpaces = useMemo(() => {
    return spaces.filter((item) => {
      const matchesRoom = selectedRoom === 'all' || item.room === selectedRoom;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch = !query ||
        item.title.toLowerCase().includes(query) ||
        item.roomLabel.toLowerCase().includes(query) ||
        item.style.toLowerCase().includes(query) ||
        item.materials.some(m => m.toLowerCase().includes(query));
      return matchesRoom && matchesSearch;
    });
  }, [spaces, selectedRoom, searchQuery]);

  function handleAttachReference() {
    if (!attachModalSpace) return;
    const updated = {
      ...attachedReferences,
      [targetRoomToAttach]: {
        renderId: attachModalSpace.id,
        title: attachModalSpace.title,
        imageUrl: attachModalSpace.imageUrl,
        note: attachmentNote || `Reference design benchmark for ${targetRoomToAttach}`,
      },
    };
    setAttachedReferences(updated);
    window.localStorage.setItem('ultida_room_attached_references', JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('ultida:reference-attached', { detail: { room: targetRoomToAttach, reference: updated[targetRoomToAttach] } }));
    setAttachSuccess(true);
    setTimeout(() => {
      setAttachSuccess(false);
      setAttachModalSpace(null);
      setAttachmentNote('');
    }, 1200);
  }

  function handleSaveCustomRender() {
    if (!uploadTitle || !uploadImageUrl) return;
    const newRender: RenderedSpace = {
      id: `rnd-custom-${Date.now()}`,
      title: uploadTitle,
      room: uploadRoom,
      roomLabel: uploadRoom.charAt(0).toUpperCase() + uploadRoom.slice(1),
      imageUrl: uploadImageUrl,
      style: uploadStyle,
      materials: uploadMaterials.split(',').map(s => s.trim()).filter(Boolean),
      dimensionsDesc: 'Custom Client Specification',
      highlights: ['Custom design render', 'Ready for client pitch'],
      designNotes: uploadNotes || 'User uploaded client visual reference.',
      isCustom: true,
    };
    const updated = [newRender, ...spaces];
    setSpaces(updated);
    try {
      const customOnly = updated.filter(s => s.isCustom);
      window.localStorage.setItem('ultida_custom_uploaded_renders', JSON.stringify(customOnly));
    } catch {}
    setShowUploadModal(false);
    setUploadTitle('');
    setUploadImageUrl('');
    setUploadNotes('');
  }

  // Presentation Mode Navigation
  const currentIdx = presentationSpace ? filteredSpaces.findIndex(s => s.id === presentationSpace.id) : -1;
  function nextPresentation() {
    if (currentIdx >= 0 && currentIdx < filteredSpaces.length - 1) {
      setPresentationSpace(filteredSpaces[currentIdx + 1]);
      setZoomLevel(1);
    }
  }
  function prevPresentation() {
    if (currentIdx > 0) {
      setPresentationSpace(filteredSpaces[currentIdx - 1]);
      setZoomLevel(1);
    }
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1440, margin: '0 auto', color: '#1c1917' }}>
      {/* ─── Header & Client Presentation CTA ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a88220', marginBottom: 4 }}>
            <Sparkles size={13} />
            Client Visual Showcase &amp; Design Reference Library
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1c1917', margin: 0, letterSpacing: '-0.02em' }}>
            Rendered Spaces &amp; Visual Benchmarks
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#78716c' }}>
            Curate luxury 3D spaces, enter distraction-free Client Presentation Showrooms, and pin references directly to project rooms for joinery fabrication.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {filteredSpaces.length > 0 && (
            <button
              onClick={() => {
                setPresentationSpace(filteredSpaces[0]);
                setZoomLevel(1);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 18px',
                borderRadius: 8,
                border: 0,
                background: 'linear-gradient(135deg, #c59c2d, #a88220)',
                color: '#1c1917',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(197,156,45,0.3)',
              }}
            >
              <Eye size={16} /> Enter Client Show Mode
            </button>
          )}

          <button
            onClick={() => setShowUploadModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 14px',
              borderRadius: 8,
              border: '1px solid #d8cabb',
              background: '#fff',
              color: '#44403c',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Plus size={15} /> Upload Render
          </button>
        </div>
      </div>

      {/* ─── Search & Category Filters Bar ─── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 24, padding: '12px 16px', background: '#faf6f0', borderRadius: 12, border: '1px solid #e7ded4' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: '#a8a29e' }} />
          <input
            type="text"
            placeholder="Search by room, finish, material (e.g. Oak, Fluted, Acrylic)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              borderRadius: 8,
              border: '1px solid #d8cabb',
              fontSize: 13,
              background: '#fff',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { id: 'all', label: 'All Spaces' },
            { id: 'living', label: '🛋 Living & Media' },
            { id: 'bedroom', label: '🛏 Master Suite' },
            { id: 'kitchen', label: '🍳 Kitchen & Pantry' },
            { id: 'dining', label: '🍷 Dining & Bar' },
            { id: 'pooja', label: '🪔 Pooja Sanctuary' },
            { id: 'study', label: '📚 Study & Office' },
            { id: 'vanity', label: '🚿 Vanity & Spa' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedRoom(cat.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: selectedRoom === cat.id ? 800 : 600,
                border: selectedRoom === cat.id ? '1px solid #c59c2d' : '1px solid #e7ded4',
                background: selectedRoom === cat.id ? '#fff9e6' : '#fff',
                color: selectedRoom === cat.id ? '#92400e' : '#57534e',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Active Project Reference Attachments Banner ─── */}
      {Object.keys(attachedReferences).length > 0 && (
        <div style={{ marginBottom: 24, padding: 14, background: '#fdfbf7', border: '1px solid #c59c2d33', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bookmark size={18} style={{ color: '#c59c2d' }} />
            <div>
              <strong style={{ fontSize: 13, color: '#1c1917' }}>Pinned Project References: </strong>
              <span style={{ fontSize: 13, color: '#78716c' }}>
                {Object.entries(attachedReferences).map(([room, ref]) => `${room} → "${ref.title}"`).join(' · ')}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              if (projectId) navigate(`/projects/${projectId}/spaces`);
              else navigate('/tools/room-builder');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #c59c2d',
              background: '#fff',
              fontSize: 11,
              fontWeight: 800,
              color: '#92400e',
              cursor: 'pointer',
            }}
          >
            View in Spaces Studio <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* ─── Render Cards Grid ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
        {filteredSpaces.map((space) => {
          const isAttached = Object.values(attachedReferences).some(r => r.renderId === space.id);
          return (
            <div
              key={space.id}
              style={{
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #e7ded4',
                overflow: 'hidden',
                boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
            >
              {/* Image Preview Container */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '16/10',
                  background: '#1c1917',
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setPresentationSpace(space);
                  setZoomLevel(1);
                }}
              >
                <img
                  src={space.imageUrl}
                  alt={space.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    transition: 'transform 0.3s ease',
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250"><rect width="400" height="250" fill="%23262626"/><text x="50%" y="50%" fill="%23c59c2d" font-size="14" font-family="sans-serif" text-anchor="middle" dy=".3em">ULTIDA 3D Render Asset</text></svg>';
                  }}
                />

                <div
                  style={{
                    position: 'absolute',
                    top: 10,
                    left: 10,
                    padding: '4px 8px',
                    borderRadius: 4,
                    background: 'rgba(28,25,23,0.85)',
                    backdropFilter: 'blur(4px)',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {space.roomLabel}
                </div>

                {isAttached && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      padding: '4px 8px',
                      borderRadius: 4,
                      background: '#c59c2d',
                      color: '#1c1917',
                      fontSize: 10,
                      fontWeight: 900,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Bookmark size={11} /> Pinned Reference
                  </div>
                )}

                <div
                  style={{
                    position: 'absolute',
                    bottom: 10,
                    right: 10,
                    padding: '5px 10px',
                    borderRadius: 6,
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(4px)',
                    color: '#f5f5f4',
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Eye size={13} /> Present to Client
                </div>
              </div>

              {/* Card Meta & Details */}
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', flex: 1 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1c1917', margin: '0 0 6px', lineHeight: 1.3 }}>
                  {space.title}
                </h3>

                <div style={{ fontSize: 11, color: '#78716c', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Ruler size={13} style={{ color: '#a88220' }} /> {space.dimensionsDesc}
                </div>

                <p style={{ fontSize: 12, color: '#57534e', margin: '0 0 12px', lineHeight: 1.4, flex: 1 }}>
                  {space.designNotes}
                </p>

                {/* Materials Tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
                  {space.materials.map((mat, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: '#f5f5f4',
                        color: '#44403c',
                        fontSize: 10.5,
                        fontWeight: 600,
                      }}
                    >
                      {mat}
                    </span>
                  ))}
                </div>

                {/* Card Action Buttons */}
                <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #f0eae1', paddingTop: 12 }}>
                  <button
                    onClick={() => {
                      setAttachModalSpace(space);
                      setAttachmentNote(`Reference styling for ${space.title}`);
                    }}
                    style={{
                      flex: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '7px 10px',
                      borderRadius: 6,
                      border: '1px solid #c59c2d',
                      background: '#fff',
                      color: '#92400e',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    <Bookmark size={13} /> Attach as Reference
                  </button>

                  <button
                    onClick={() => {
                      setPresentationSpace(space);
                      setZoomLevel(1);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      padding: '7px 12px',
                      borderRadius: 6,
                      border: '1px solid #d8cabb',
                      background: '#fcfaf7',
                      color: '#1c1917',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    title="Fullscreen client view"
                  >
                    <Maximize2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ══════ MODAL 1: CLIENT PRESENTATION MODE ("SHOW MODE") ══════ */}
      {presentationSpace && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(12, 10, 9, 0.96)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
            color: '#f5f5f4',
          }}
        >
          {/* Top Presentation Bar */}
          <div
            style={{
              padding: '16px 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: 'linear-gradient(135deg, #c59c2d, #a88220)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#1c1917',
                  fontWeight: 900,
                  fontSize: 13,
                }}
              >
                U
              </div>
              <div>
                <strong style={{ fontSize: 16, color: '#f5f5f4', display: 'block' }}>
                  {presentationSpace.title}
                </strong>
                <small style={{ color: '#a88220', fontSize: 12, fontWeight: 700 }}>
                  {presentationSpace.roomLabel} · {presentationSpace.style}
                </small>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Zoom Controls */}
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden' }}>
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.2))}
                  style={{ padding: '6px 12px', background: 'transparent', border: 0, color: '#fff', cursor: 'pointer', fontSize: 13 }}
                >
                  −
                </button>
                <span style={{ padding: '6px 8px', fontSize: 11, fontWeight: 700, color: '#c59c2d' }}>
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
                  style={{ padding: '6px 12px', background: 'transparent', border: 0, color: '#fff', cursor: 'pointer', fontSize: 13 }}
                >
                  +
                </button>
              </div>

              <button
                onClick={() => {
                  setAttachModalSpace(presentationSpace);
                  setAttachmentNote(`Reference styling from ${presentationSpace.title}`);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 6,
                  border: '1px solid #c59c2d',
                  background: 'rgba(197,156,45,0.15)',
                  color: '#fbbf24',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <Bookmark size={14} /> Attach Reference
              </button>

              <button
                onClick={() => setPresentationSpace(null)}
                style={{
                  padding: '7px 10px',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'transparent',
                  color: '#fff',
                  cursor: 'pointer',
                }}
                aria-label="Exit client presentation"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Main Visual Presentation Stage */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            {/* Nav Arrows */}
            {currentIdx > 0 && (
              <button
                onClick={prevPresentation}
                style={{
                  position: 'absolute',
                  left: 24,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  zIndex: 10,
                }}
              >
                <ChevronLeft size={24} />
              </button>
            )}

            {currentIdx < filteredSpaces.length - 1 && (
              <button
                onClick={nextPresentation}
                style={{
                  position: 'absolute',
                  right: 24,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  zIndex: 10,
                }}
              >
                <ChevronRight size={24} />
              </button>
            )}

            {/* High-Res Image Display */}
            <div
              style={{
                maxWidth: '90%',
                maxHeight: '85vh',
                transition: 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)',
                transform: `scale(${zoomLevel})`,
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <img
                src={presentationSpace.imageUrl}
                alt={presentationSpace.title}
                style={{
                  maxWidth: '100%',
                  maxHeight: '82vh',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          </div>

          {/* Bottom Specifications Bar for Client Pitch */}
          <div
            style={{
              padding: '14px 28px',
              background: 'rgba(28,25,23,0.95)',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: 10, textTransform: 'uppercase', color: '#a88220', fontWeight: 800, display: 'block' }}>Key Specifications</span>
                <span style={{ fontSize: 13, color: '#e7e5e4', fontWeight: 600 }}>{presentationSpace.dimensionsDesc}</span>
              </div>
              <div style={{ height: 28, width: 1, background: 'rgba(255,255,255,0.1)' }} />
              <div>
                <span style={{ fontSize: 10, textTransform: 'uppercase', color: '#a88220', fontWeight: 800, display: 'block' }}>Primary Materials</span>
                <span style={{ fontSize: 13, color: '#e7e5e4' }}>{presentationSpace.materials.join(' · ')}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {presentationSpace.highlights.map((h, i) => (
                <span
                  key={i}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 4,
                    background: 'rgba(197,156,45,0.12)',
                    color: '#fef3c7',
                    fontSize: 11,
                    fontWeight: 700,
                    border: '1px solid rgba(197,156,45,0.2)',
                  }}
                >
                  ✓ {h}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════ MODAL 2: ATTACH AS REFERENCE TO PROJECT ROOM ══════ */}
      {attachModalSpace && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 14,
              padding: 24,
              maxWidth: 480,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <strong style={{ fontSize: 16, color: '#1c1917', display: 'block' }}>Attach Reference to Room</strong>
                <span style={{ fontSize: 12, color: '#78716c' }}>
                  Link this render as the design benchmark for the engineering &amp; joinery team.
                </span>
              </div>
              <button onClick={() => setAttachModalSpace(null)} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16, padding: 10, background: '#faf6f0', borderRadius: 8 }}>
              <img src={attachModalSpace.imageUrl} alt="" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6 }} />
              <div>
                <strong style={{ fontSize: 13, color: '#1c1917', display: 'block' }}>{attachModalSpace.title}</strong>
                <span style={{ fontSize: 11, color: '#a88220', fontWeight: 700 }}>{attachModalSpace.roomLabel}</span>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#44403c', marginBottom: 6 }}>
                Target Room in Project:
              </label>
              <select
                value={targetRoomToAttach}
                onChange={(e) => setTargetRoomToAttach(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d8cabb', fontSize: 13, background: '#fff' }}
              >
                <option value="Master Bedroom">Master Bedroom Suite</option>
                <option value="Formal Living">Formal Living &amp; Media Lounge</option>
                <option value="Gourmet Kitchen">Gourmet Chef Kitchen</option>
                <option value="Dining Room">Dining Room &amp; Crockery Bar</option>
                <option value="Pooja Sanctuary">Sacred Pooja Sanctuary</option>
                <option value="Kids Bedroom">Kids / Guest Bedroom</option>
                <option value="Study Office">Executive Study Lounge</option>
                <option value="Master Vanity">Master Bathroom Vanity</option>
              </select>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#44403c', marginBottom: 6 }}>
                Design Directive / Reference Note:
              </label>
              <textarea
                rows={3}
                value={attachmentNote}
                onChange={(e) => setAttachmentNote(e.target.value)}
                placeholder="e.g., Follow 3mm shutter reveals, warm 3000K LED coving, and smoked oak grain direction..."
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d8cabb', fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setAttachModalSpace(null)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d8cabb', background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAttachReference}
                disabled={attachSuccess}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: 0,
                  background: attachSuccess ? '#059669' : 'linear-gradient(135deg, #c59c2d, #a88220)',
                  color: attachSuccess ? '#fff' : '#1c1917',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {attachSuccess ? (
                  <>
                    <Check size={15} /> Attached!
                  </>
                ) : (
                  <>
                    <Bookmark size={15} /> Pin to {targetRoomToAttach}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ MODAL 3: UPLOAD CUSTOM CLIENT RENDER ══════ */}
      {showUploadModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 14,
              padding: 24,
              maxWidth: 500,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <strong style={{ fontSize: 16, color: '#1c1917', display: 'block' }}>Upload Project Render</strong>
                <span style={{ fontSize: 12, color: '#78716c' }}>
                  Add Midjourney, 3ds Max, V-Ray, or AURA renders to showcase to clients.
                </span>
              </div>
              <button onClick={() => setShowUploadModal(false)} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#44403c', marginBottom: 4 }}>
                  Render Title:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Master Bedroom Suite Twilight Render"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d8cabb', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#44403c', marginBottom: 4 }}>
                    Room Category:
                  </label>
                  <select
                    value={uploadRoom}
                    onChange={(e) => setUploadRoom(e.target.value as any)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d8cabb', fontSize: 13, background: '#fff' }}
                  >
                    <option value="living">Living Lounge</option>
                    <option value="bedroom">Master Bedroom</option>
                    <option value="kitchen">Kitchen</option>
                    <option value="dining">Dining &amp; Bar</option>
                    <option value="pooja">Pooja Mandir</option>
                    <option value="study">Study</option>
                    <option value="vanity">Vanity &amp; Bath</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#44403c', marginBottom: 4 }}>
                    Design Style:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Contemporary Luxury"
                    value={uploadStyle}
                    onChange={(e) => setUploadStyle(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d8cabb', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#44403c', marginBottom: 4 }}>
                  Image File or URL:
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Paste image URL (https://... or /reference-vault/...)"
                    value={uploadImageUrl}
                    onChange={(e) => setUploadImageUrl(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #d8cabb', fontSize: 13, boxSizing: 'border-box' }}
                  />
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #d8cabb',
                      background: '#f5f5f4',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <ImageIcon size={14} /> Local
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setUploadImageUrl(URL.createObjectURL(file));
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#44403c', marginBottom: 4 }}>
                  Finishes &amp; Materials (comma separated):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Smoked Oak, Botticino Marble, Brushed Brass"
                  value={uploadMaterials}
                  onChange={(e) => setUploadMaterials(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d8cabb', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowUploadModal(false)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d8cabb', background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustomRender}
                disabled={!uploadTitle || !uploadImageUrl}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: 0,
                  background: !uploadTitle || !uploadImageUrl ? '#e7ded4' : 'linear-gradient(135deg, #c59c2d, #a88220)',
                  color: '#1c1917',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: !uploadTitle || !uploadImageUrl ? 'not-allowed' : 'pointer',
                }}
              >
                Save to Library
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
