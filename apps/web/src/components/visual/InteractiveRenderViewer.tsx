import React, { useState, useRef } from 'react';
import { Tag, Check, Eye, EyeOff, ShoppingBag, ExternalLink, Sparkles } from 'lucide-react';

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MatchedObject {
  object_id: number;
  bbox: BoundingBox;
  category: string;
  matched_sku: string;
  matched_name: string;
  vendor: string;
  unit_price: number;
  confidence_score: number;
}

export interface InteractiveRenderViewerProps {
  imageUrl: string;
  items: MatchedObject[];
  onSelectItem?: (item: MatchedObject) => void;
  onAddSceneToQuote?: (items: MatchedObject[]) => void;
  currencySymbol?: string;
}

export default function InteractiveRenderViewer({
  imageUrl,
  items,
  onSelectItem,
  onAddSceneToQuote,
  currencySymbol = '$',
}: InteractiveRenderViewerProps) {
  const [naturalDimensions, setNaturalDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAllHotspots, setShowAllHotspots] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.currentTarget;
    setNaturalDimensions({
      width: target.naturalWidth,
      height: target.naturalHeight,
    });
  };

  const activeItem = items.find((item) => item.object_id === (hoveredId ?? selectedId));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, maxWidth: 1600, margin: '0 auto', padding: 20, userSelect: 'none' }}>
      {/* 1. Main Render Viewport */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              ● Live Spatial Scan
            </span>
            <span style={{ fontSize: 12, color: '#78716c' }}>
              {items.length} Smart Objects Tagged
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowAllHotspots(!showAllHotspots)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#a8a29e', background: '#292524', border: '1px solid #44403c', padding: '6px 12px', borderRadius: 8, cursor: 'pointer' }}
          >
            {showAllHotspots ? (
              <>
                <EyeOff size={14} /> Hide Markers
              </>
            ) : (
              <>
                <Eye size={14} /> Show Markers
              </>
            )}
          </button>
        </div>

        <div
          ref={containerRef}
          style={{ position: 'relative', width: '100%', aspectRatio: '16/10', borderRadius: 16, border: '1px solid #332d29', background: '#09090b', overflow: 'hidden' }}
        >
          {/* Main Interior Render Image */}
          <img
            src={imageUrl}
            alt="Ultida AI Interior Render"
            onLoad={handleImageLoad}
            style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
          />

          {/* Interactive Bounding Box & Hotspot Overlays */}
          {naturalDimensions &&
            items.map((item) => {
              const { x, y, w, h } = item.bbox;
              const left = (x / naturalDimensions.width) * 100;
              const top = (y / naturalDimensions.height) * 100;
              const width = (w / naturalDimensions.width) * 100;
              const height = (h / naturalDimensions.height) * 100;
              const isHovered = hoveredId === item.object_id;
              const isSelected = selectedId === item.object_id;
              const isActive = isHovered || isSelected;

              return (
                <div
                  key={item.object_id}
                  style={{
                    position: 'absolute',
                    left: `${left}%`,
                    top: `${top}%`,
                    width: `${width}%`,
                    height: `${height}%`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    zIndex: isActive ? 30 : 10,
                    border: isActive
                      ? '2px solid #34d399'
                      : showAllHotspots
                      ? '1px dashed rgba(255, 255, 255, 0.4)'
                      : 'none',
                    background: isActive ? 'rgba(52, 211, 153, 0.15)' : 'transparent',
                  }}
                  onMouseEnter={() => setHoveredId(item.object_id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => {
                    setSelectedId(item.object_id);
                    onSelectItem?.(item);
                  }}
                >
                  {/* Floating Hotspot Pin */}
                  <div
                    style={{
                      position: 'absolute',
                      top: -10,
                      left: -10,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: '#18181b',
                      border: '1.5px solid #34d399',
                      color: '#34d399',
                      fontSize: 10,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                      transform: isActive ? 'scale(1.15)' : 'scale(1)',
                      transition: 'transform 0.15s ease',
                    }}
                  >
                    {item.object_id}
                  </div>

                  {/* Inline Mini Floating Card on Hover */}
                  {isActive && (
                    <div
                      style={{
                        position: 'absolute',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        top: top > 60 ? 'auto' : '100%',
                        bottom: top > 60 ? '100%' : 'auto',
                        marginTop: 8,
                        marginBottom: 8,
                        width: 240,
                        background: 'rgba(24, 24, 27, 0.96)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid #3f3f46',
                        borderRadius: 12,
                        padding: 12,
                        boxShadow: '0 16px 36px rgba(0,0,0,0.6)',
                        pointerEvents: 'auto',
                        color: '#f4f4f5',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: '#34d399', background: 'rgba(5, 150, 105, 0.2)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(52, 211, 153, 0.3)' }}>
                          {item.category.replace('_', ' ')}
                        </span>
                        <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#fff' }}>
                          {currencySymbol}
                          {item.unit_price.toFixed(2)}
                        </span>
                      </div>
                      <h4 style={{ fontSize: 12, fontWeight: 600, color: '#f4f4f5', margin: '4px 0', lineHeight: 1.3 }}>
                        {item.matched_name}
                      </h4>
                      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#a1a1aa', borderTop: '1px solid #27272a', paddingTop: 6 }}>
                        <span>{item.vendor}</span>
                        <span style={{ fontFamily: 'monospace', color: '#71717a' }}>{item.matched_sku}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* 2. Interactive SKU Catalog & Dynamic BOM Sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#f4f4f5', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
            <Tag size={15} color="#34d399" /> Detected BOM Items
          </h3>
          <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#a1a1aa' }}>
            {currencySymbol}
            {items
              .reduce((acc, curr) => acc + curr.unit_price, 0)
              .toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 520, overflowY: 'auto', paddingRight: 4 }}>
          {items.map((item) => {
            const isSelected = (hoveredId ?? selectedId) === item.object_id;
            return (
              <div
                key={item.object_id}
                onMouseEnter={() => setHoveredId(item.object_id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => {
                  setSelectedId(item.object_id);
                  onSelectItem?.(item);
                }}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: isSelected ? '1.5px solid #10b981' : '1px solid #27272a',
                  background: isSelected ? '#27272a' : '#18181b',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      fontSize: 11,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isSelected ? '#10b981' : '#27272a',
                      color: isSelected ? '#000' : '#a1a1aa',
                      border: isSelected ? '1px solid #34d399' : '1px solid #3f3f46',
                      flexShrink: 0,
                    }}
                  >
                    {item.object_id}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#f4f4f5', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.matched_name}
                      </p>
                      <span style={{ fontSize: 11.5, fontFamily: 'monospace', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {currencySymbol}
                        {item.unit_price.toFixed(2)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, fontSize: 10, color: '#71717a' }}>
                      <span>{item.vendor}</span>
                      <span style={{ color: '#34d399', fontFamily: 'monospace' }}>
                        {Math.round(item.confidence_score * 100)}% match
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={() => onAddSceneToQuote?.(items)}
          style={{
            marginTop: 4,
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
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
          }}
        >
          <ShoppingBag size={15} /> Add Entire Scene to Dynamic Quote
        </button>
      </div>
    </div>
  );
}
