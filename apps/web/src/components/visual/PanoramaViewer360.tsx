import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  RotateCcw, Play, Pause, Maximize2, Minimize2, ZoomIn, ZoomOut,
  Camera, ShieldCheck, Sparkles, Compass, Eye, Info
} from 'lucide-react';

export interface PanoramaHotspot {
  id: string;
  yaw: number; // horizontal angle in degrees (-180 to 180)
  pitch: number; // vertical angle in degrees (-90 to 90)
  title: string;
  category: string;
  specification: string;
  priceInr?: number;
}

export interface PanoramaViewer360Props {
  initialImageUrl?: string;
  roomTitle?: string;
  hotspots?: PanoramaHotspot[];
  watermarkText?: string;
  showWatermarkDefault?: boolean;
  onHotspotClick?: (hotspot: PanoramaHotspot) => void;
}

export interface RoomPreset {
  id: string;
  name: string;
  category: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  floorColor: string;
  ceilingColor: string;
  defaultHotspots: PanoramaHotspot[];
}

export const ROOM_PRESETS: RoomPreset[] = [
  {
    id: 'master-suite',
    name: 'Master Bed Suite',
    category: 'Bedroom',
    description: 'Smoked Walnut panelling, fluted acoustic headboard & walk-in wardrobe',
    primaryColor: '#2b231d',
    secondaryColor: '#926c48',
    floorColor: '#3d3024',
    ceilingColor: '#f5f0e8',
    defaultHotspots: [
      { id: 'h1', yaw: 10, pitch: -8, title: 'King Floating Platform Bed', category: 'Modular Joinery', specification: 'Smoked oak veneer with recessed 3000K warm LED profile', priceInr: 145000 },
      { id: 'h2', yaw: 85, pitch: 5, title: 'Fluted Glass Wardrobe Suite', category: 'Wardrobe', specification: 'System 32 carcass with anodized champagne aluminium profile', priceInr: 285000 },
      { id: 'h3', yaw: -80, pitch: -4, title: 'Cantilever Vanity Desk', category: 'Study / Vanity', specification: 'Italian Calacatta quartz top with soft-close drawer stack', priceInr: 68000 },
    ]
  },
  {
    id: 'living-lounge',
    name: 'Living & Dining Sanctuary',
    category: 'Living',
    description: 'Calacatta gold marble, bookmatched TV console & cove illumination',
    primaryColor: '#1e242b',
    secondaryColor: '#c59c2d',
    floorColor: '#d6cebe',
    ceilingColor: '#faf8f5',
    defaultHotspots: [
      { id: 'h4', yaw: 5, pitch: -2, title: 'Architectural TV Console', category: 'Casework', specification: 'Bookmatched sintered stone back with floating drawer credenza', priceInr: 195000 },
      { id: 'h5', yaw: -95, pitch: -10, title: 'Italian Bouclé Sectional', category: 'Loose Furniture', specification: 'Curved modular lounge in high-rub woven bouclé fabric', priceInr: 220000 },
      { id: 'h6', yaw: 110, pitch: -5, title: '6-Seater Monolith Dining Table', category: 'Dining', specification: 'Solid travertine oval top with fluted timber pedestal legs', priceInr: 175000 },
    ]
  },
  {
    id: 'modular-kitchen',
    name: 'Italian Modular Kitchen',
    category: 'Kitchen',
    description: 'Satin matt charcoal acrylic, quartz waterfall island & Blum Blumotion hardware',
    primaryColor: '#22252a',
    secondaryColor: '#64748b',
    floorColor: '#cbd5e1',
    ceilingColor: '#f8fafc',
    defaultHotspots: [
      { id: 'h7', yaw: 0, pitch: -12, title: 'Quartz Waterfall Island', category: 'Kitchen Island', specification: '40mm mitred edge quartz with integrated breakfast counter', priceInr: 185000 },
      { id: 'h8', yaw: 65, pitch: 8, title: 'Handleless Gola Wall Cabinets', category: 'Wall Casework', specification: 'Satin anti-fingerprint acrylic with servo-drive bi-fold lifts', priceInr: 165000 },
      { id: 'h9', yaw: -70, pitch: -2, title: 'Tall Appliance Pantry Tower', category: 'Pantry Tower', specification: 'Built-in oven niche and Hafele tandem pullout larder', priceInr: 210000 },
    ]
  },
  {
    id: 'mandir-sanctuary',
    name: 'Pooja Mandir Sanctum',
    category: 'Sanctuary',
    description: 'Precision CNC teak jaali lattice, backlit translucent onyx & Corian altar',
    primaryColor: '#382212',
    secondaryColor: '#eab308',
    floorColor: '#fef3c7',
    ceilingColor: '#fffbeb',
    defaultHotspots: [
      { id: 'h10', yaw: 0, pitch: 0, title: 'Backlit Translucent Onyx Backdrop', category: 'Feature Wall', specification: 'Illuminated semi-precious stone panel with warm 2700K diffusion', priceInr: 125000 },
      { id: 'h11', yaw: -45, pitch: 10, title: 'CNC Teak Wood Jaali Lattice', category: 'CNC Screen', specification: 'System 32 indexed geometric jaali panel in 18mm Burma teak', priceInr: 78000 },
      { id: 'h12', yaw: 45, pitch: -15, title: 'Stepped Corian Sacred Altar', category: 'Mandir Altar', specification: 'Seamless thermoformed Glacier White Corian with soft-close brass storage', priceInr: 92000 },
    ]
  }
];

function createEquirectangularCanvas(preset: RoomPreset): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // 1. Sky / Ceiling Gradient
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, preset.ceilingColor);
  grad.addColorStop(0.35, '#eae5dc');
  grad.addColorStop(0.5, preset.primaryColor);
  grad.addColorStop(0.65, preset.secondaryColor);
  grad.addColorStop(1, preset.floorColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Perspective Wall Grid & Architecture Lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 2;

  // Horizontal datums: Ceiling line, eye level horizon (50%), floor datum
  ctx.beginPath();
  ctx.moveTo(0, canvas.height * 0.25);
  ctx.lineTo(canvas.width, canvas.height * 0.25);
  ctx.moveTo(0, canvas.height * 0.5);
  ctx.lineTo(canvas.width, canvas.height * 0.5);
  ctx.moveTo(0, canvas.height * 0.75);
  ctx.lineTo(canvas.width, canvas.height * 0.75);
  ctx.stroke();

  // 4 Cardinal Wall Corners (0°, 90°, 180°, 270°)
  for (let i = 0; i < 4; i++) {
    const x = (canvas.width / 4) * i;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath();
    ctx.moveTo(x, canvas.height * 0.25);
    ctx.lineTo(x, canvas.height * 0.75);
    ctx.stroke();

    // Decorative wall panel fluting
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.lineWidth = 1;
    for (let f = 1; f < 8; f++) {
      const fx = x + (canvas.width / 32) * f;
      ctx.beginPath();
      ctx.moveTo(fx, canvas.height * 0.32);
      ctx.lineTo(fx, canvas.height * 0.7);
      ctx.stroke();
    }
  }

  // 3. Architectural Room Name & Horizon Markers
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ULTIDA 360° ARCHITECTURAL SPACE · ' + preset.name.toUpperCase(), canvas.width / 2, canvas.height * 0.48);

  ctx.font = '16px sans-serif';
  ctx.fillText('FRONT NORTH (0°)', canvas.width * 0.5, canvas.height * 0.53);
  ctx.fillText('EAST ELEVATION (+90°)', canvas.width * 0.75, canvas.height * 0.53);
  ctx.fillText('WEST ELEVATION (-90°)', canvas.width * 0.25, canvas.height * 0.53);

  // Floor grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  for (let y = canvas.height * 0.75; y < canvas.height; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  return canvas;
}

export function PanoramaViewer360({
  initialImageUrl,
  roomTitle,
  hotspots,
  watermarkText = 'ULTIDA ATELIER · 360° CLIENT PRESENTATION',
  showWatermarkDefault = true,
  onHotspotClick,
}: PanoramaViewer360Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Active room preset or custom image
  const [selectedPreset, setSelectedPreset] = useState<RoomPreset>(ROOM_PRESETS[0]);
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(initialImageUrl ?? null);
  const [activeHotspots, setActiveHotspots] = useState<PanoramaHotspot[]>(hotspots ?? ROOM_PRESETS[0].defaultHotspots);

  // Navigation & Control States
  const [fov, setFov] = useState<number>(65);
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(true);
  const [rotationSpeed] = useState<number>(0.12);
  const [showWatermark, setShowWatermark] = useState<boolean>(showWatermarkDefault);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [selectedHotspot, setSelectedHotspot] = useState<PanoramaHotspot | null>(null);

  // Three.js internal references
  const threeRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    sphere: THREE.Mesh;
    textureLoader: THREE.TextureLoader;
    lon: number;
    lat: number;
    isUserInteracting: boolean;
    onPointerDownPointerX: number;
    onPointerDownPointerY: number;
    onPointerDownLon: number;
    onPointerDownLat: number;
    animFrameId: number;
    cameraTarget: THREE.Vector3;
  } | null>(null);

  // Initialize Three.js WebGL Scene
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 550;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(fov, width / height, 1, 1100);
    const cameraTarget = new THREE.Vector3(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);

    // Inverted Sphere for Equirectangular projection
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);

    // Initial texture from procedural canvas
    const initCanvas = createEquirectangularCanvas(selectedPreset);
    const initialTexture = new THREE.CanvasTexture(initCanvas);
    initialTexture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.MeshBasicMaterial({ map: initialTexture });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    const state = {
      renderer,
      scene,
      camera,
      cameraTarget,
      sphere,
      textureLoader: new THREE.TextureLoader(),
      lon: 0,
      lat: 0,
      isUserInteracting: false,
      onPointerDownPointerX: 0,
      onPointerDownPointerY: 0,
      onPointerDownLon: 0,
      onPointerDownLat: 0,
      animFrameId: 0,
    };
    threeRef.current = state;

    // Animation Loop
    const animate = () => {
      state.animFrameId = requestAnimationFrame(animate);

      if (isAutoRotating && !state.isUserInteracting) {
        state.lon += rotationSpeed;
      }

      state.lat = Math.max(-85, Math.min(85, state.lat));
      const phi = THREE.MathUtils.degToRad(90 - state.lat);
      const theta = THREE.MathUtils.degToRad(state.lon);

      cameraTarget.x = 500 * Math.sin(phi) * Math.cos(theta);
      cameraTarget.y = 500 * Math.cos(phi);
      cameraTarget.z = 500 * Math.sin(phi) * Math.sin(theta);

      camera.lookAt(cameraTarget);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(state.animFrameId);
      geometry.dispose();
      material.dispose();
      initialTexture.dispose();
      renderer.dispose();
    };
  }, []);

  // Update FOV when slider changes
  useEffect(() => {
    if (threeRef.current) {
      threeRef.current.camera.fov = fov;
      threeRef.current.camera.updateProjectionMatrix();
    }
  }, [fov]);

  // Update Texture when room preset or image changes
  useEffect(() => {
    if (!threeRef.current) return;
    const { sphere, textureLoader } = threeRef.current;

    if (customImageUrl) {
      textureLoader.load(
        customImageUrl,
        (loadedTex) => {
          loadedTex.colorSpace = THREE.SRGBColorSpace;
          (sphere.material as THREE.MeshBasicMaterial).map = loadedTex;
          (sphere.material as THREE.MeshBasicMaterial).needsUpdate = true;
        },
        undefined,
        () => {
          // Fallback to procedural on image load failure
          const c = createEquirectangularCanvas(selectedPreset);
          const tex = new THREE.CanvasTexture(c);
          tex.colorSpace = THREE.SRGBColorSpace;
          (sphere.material as THREE.MeshBasicMaterial).map = tex;
          (sphere.material as THREE.MeshBasicMaterial).needsUpdate = true;
        }
      );
    } else {
      const c = createEquirectangularCanvas(selectedPreset);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      (sphere.material as THREE.MeshBasicMaterial).map = tex;
      (sphere.material as THREE.MeshBasicMaterial).needsUpdate = true;
    }
  }, [selectedPreset, customImageUrl]);

  // Pointer Interaction Handlers (Orbit Drag)
  const onPointerDown = (e: React.PointerEvent) => {
    if (!threeRef.current) return;
    threeRef.current.isUserInteracting = true;
    threeRef.current.onPointerDownPointerX = e.clientX;
    threeRef.current.onPointerDownPointerY = e.clientY;
    threeRef.current.onPointerDownLon = threeRef.current.lon;
    threeRef.current.onPointerDownLat = threeRef.current.lat;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!threeRef.current || !threeRef.current.isUserInteracting) return;
    threeRef.current.lon = (threeRef.current.onPointerDownPointerX - e.clientX) * 0.18 + threeRef.current.onPointerDownLon;
    threeRef.current.lat = (e.clientY - threeRef.current.onPointerDownPointerY) * 0.18 + threeRef.current.onPointerDownLat;
  };

  const onPointerUp = () => {
    if (threeRef.current) threeRef.current.isUserInteracting = false;
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setFov((prev) => Math.max(35, Math.min(95, prev + e.deltaY * 0.05)));
  };

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Capture High-Res Snapshot
  const captureSnapshot = useCallback(() => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `ultida-360-view-${selectedPreset.id}-${Date.now()}.png`;
    a.click();
  }, [selectedPreset]);

  // Select Preset Handler
  const handleSelectPreset = (preset: RoomPreset) => {
    setSelectedPreset(preset);
    setCustomImageUrl(null);
    setActiveHotspots(preset.defaultHotspots);
    setSelectedHotspot(null);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: isFullscreen ? '100vh' : '620px',
        backgroundColor: '#0c0a09',
        borderRadius: isFullscreen ? 0 : 12,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 360 Canvas Viewport */}
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
        style={{
          width: '100%',
          height: '100%',
          cursor: threeRef.current?.isUserInteracting ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
      />

      {/* Watermark Overlay (Presentation / Confidential mode) */}
      {showWatermark && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            borderRadius: 8,
            border: '1px solid rgba(197, 156, 45, 0.4)',
            color: '#fbbf24',
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          <ShieldCheck size={14} color="#fbbf24" />
          <span>{watermarkText}</span>
        </div>
      )}

      {/* Top Left: Active Room Badge */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            background: 'rgba(15, 12, 10, 0.75)',
            backdropFilter: 'blur(10px)',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#fff',
          }}
        >
          <Compass size={15} color="#c59c2d" />
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            {roomTitle ?? selectedPreset.name}
          </span>
          <span
            style={{
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 4,
              background: 'rgba(197, 156, 45, 0.25)',
              color: '#fbbf24',
              fontWeight: 800,
            }}
          >
            360° VR
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.65)', paddingLeft: 4 }}>
          {selectedPreset.description}
        </span>
      </div>

      {/* Bottom Floating Toolbar */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 16px',
          background: 'rgba(15, 12, 10, 0.85)',
          backdropFilter: 'blur(12px)',
          borderRadius: 30,
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
          zIndex: 10,
        }}
      >
        {/* Preset Selector Dropdown */}
        <select
          value={selectedPreset.id}
          onChange={(e) => {
            const p = ROOM_PRESETS.find((x) => x.id === e.target.value);
            if (p) handleSelectPreset(p);
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 16,
            color: '#fff',
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {ROOM_PRESETS.map((p) => (
            <option key={p.id} value={p.id} style={{ background: '#1c1917', color: '#fff' }}>
              {p.name}
            </option>
          ))}
        </select>

        {/* Auto-Rotation Toggle */}
        <button
          type="button"
          onClick={() => setIsAutoRotating((v) => !v)}
          title={isAutoRotating ? 'Pause 360 Orbit' : 'Start Smooth 360 Orbit'}
          style={{
            background: isAutoRotating ? 'rgba(197, 156, 45, 0.3)' : 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: isAutoRotating ? '#fbbf24' : '#fff',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
          }}
        >
          {isAutoRotating ? <Pause size={14} /> : <Play size={14} />}
        </button>

        {/* Reset View */}
        <button
          type="button"
          onClick={() => {
            if (threeRef.current) {
              threeRef.current.lon = 0;
              threeRef.current.lat = 0;
            }
            setFov(65);
          }}
          title="Reset Horizon & North View"
          style={{
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#fff',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={14} />
        </button>

        {/* Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={() => setFov((f) => Math.max(35, f - 8))}
            title="Zoom In"
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#fff',
              borderRadius: '50%',
              width: 30,
              height: 30,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            <ZoomIn size={13} />
          </button>
          <input
            type="range"
            min="35"
            max="95"
            value={fov}
            onChange={(e) => setFov(Number(e.target.value))}
            style={{ width: 60, accentColor: '#c59c2d', cursor: 'pointer' }}
            title="Field of View"
          />
          <button
            type="button"
            onClick={() => setFov((f) => Math.min(95, f + 8))}
            title="Zoom Out"
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#fff',
              borderRadius: '50%',
              width: 30,
              height: 30,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            <ZoomOut size={13} />
          </button>
        </div>

        {/* Watermark Toggle */}
        <button
          type="button"
          onClick={() => setShowWatermark((v) => !v)}
          title="Toggle Presentation Watermark"
          style={{
            background: showWatermark ? 'rgba(197, 156, 45, 0.3)' : 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: showWatermark ? '#fbbf24' : 'rgba(255, 255, 255, 0.65)',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
          }}
        >
          <ShieldCheck size={14} />
        </button>

        {/* Snapshot Capture */}
        <button
          type="button"
          onClick={captureSnapshot}
          title="Capture High-Res View Snapshot"
          style={{
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#fff',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
          }}
        >
          <Camera size={14} />
        </button>

        {/* Fullscreen Toggle */}
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#fff',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
          }}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {/* Hotspots Quick Drawer (Bottom Left) */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          maxWidth: 280,
          zIndex: 5,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Interactive Points of Interest ({activeHotspots.length})
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {activeHotspots.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => {
                setSelectedHotspot(h);
                if (threeRef.current) {
                  threeRef.current.lon = -h.yaw;
                  threeRef.current.lat = h.pitch;
                }
                onHotspotClick?.(h);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                background: selectedHotspot?.id === h.id ? 'rgba(197, 156, 45, 0.35)' : 'rgba(15, 12, 10, 0.75)',
                backdropFilter: 'blur(8px)',
                border: `1px solid ${selectedHotspot?.id === h.id ? '#c59c2d' : 'rgba(255, 255, 255, 0.1)'}`,
                borderRadius: 6,
                color: '#fff',
                fontSize: 11.5,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c59c2d', flexShrink: 0 }} />
                <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{h.title}</span>
              </div>
              {h.priceInr && (
                <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 11, marginLeft: 8 }}>
                  ₹{(h.priceInr / 1000).toFixed(0)}k
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Hotspot Detail Card Modal */}
      {selectedHotspot && (
        <div
          style={{
            position: 'absolute',
            top: 70,
            left: 20,
            width: 320,
            padding: 16,
            background: 'rgba(24, 20, 16, 0.95)',
            backdropFilter: 'blur(16px)',
            borderRadius: 10,
            border: '1px solid rgba(197, 156, 45, 0.4)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            color: '#fff',
            zIndex: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#fbbf24', fontWeight: 800 }}>
              {selectedHotspot.category}
            </span>
            <button
              type="button"
              onClick={() => setSelectedHotspot(null)}
              style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: 14 }}
            >
              ✕
            </button>
          </div>
          <h4 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700 }}>{selectedHotspot.title}</h4>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: 'rgba(255, 255, 255, 0.75)', lineHeight: 1.4 }}>
            {selectedHotspot.specification}
          </p>
          {selectedHotspot.priceInr && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <span style={{ fontSize: 11, color: '#aaa' }}>Estimated Cost</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fbbf24' }}>
                ₹{selectedHotspot.priceInr.toLocaleString('en-IN')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
