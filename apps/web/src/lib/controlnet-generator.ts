export interface WallConfig {
  lengthMm: number;
  heightMm: number;
}

export interface ModularUnit {
  id: string;
  name: string;
  category: 'base_drawer' | 'single_shutter' | 'double_shutter' | 'open_niche' | 'overhead_loft';
  widthMm: 300 | 450 | 600 | 900;
  heightMm: number;
  depthMm: number;
  elevationMm: number;
  posX: number;
  carcassCore: 'HDHMR' | 'BWR_Plywood' | 'MDF' | 'Particle_Board';
  shutterFinish: 'fluted_pu' | 'acrylic_gloss' | 'matte_laminate' | 'tinted_glass';
  hardware: {
    hinges: number;
    drawerChannels: number;
    hangingBrackets: number;
  };
}

export interface ControlNetMapsResult {
  depthMapDataUrl: string;
  wireframeDataUrl: string;
  depthBlob: Blob;
  wireframeBlob: Blob;
  aspectRatio: number;
  canvasDimensions: { width: number; height: number };
}

/**
 * Normalizes pixel dimensions to the nearest multiple of 64
 * (Required by Stable Diffusion / Flux / ControlNet latent autoencoders)
 */
export function snapToMultipleOf64(value: number): number {
  return Math.round(value / 64) * 64;
}

/**
 * Generates paired Depth Map and Lineart Wireframe images from modular wall state
 */
export async function generateControlNetMaps(
  wall: WallConfig,
  modules: ModularUnit[],
  targetWidth: number = 1024
): Promise<ControlNetMapsResult> {
  const rawHeight = (targetWidth * wall.heightMm) / wall.lengthMm;
  const width = snapToMultipleOf64(targetWidth);
  const height = snapToMultipleOf64(rawHeight);

  // Helper coordinate mappers (Y=0 at top of canvas, 0mm is bottom floor)
  const toPxX = (mm: number) => (mm / wall.lengthMm) * width;
  const toPxY = (mm: number) => height - (mm / wall.heightMm) * height;
  const toPxW = (mm: number) => (mm / wall.lengthMm) * width;
  const toPxH = (mm: number) => (mm / wall.heightMm) * height;

  // -----------------------------------------------------------------
  // 1. DEPTH MAP GENERATION (Grayscale: Near = White, Far = Black)
  // -----------------------------------------------------------------
  const depthCanvas = document.createElement('canvas');
  depthCanvas.width = width;
  depthCanvas.height = height;
  const dCtx = depthCanvas.getContext('2d')!;

  // Base Wall (Deepest plane: Dark Gray #181818 ~ RGB 24)
  dCtx.fillStyle = 'rgb(24, 24, 24)';
  dCtx.fillRect(0, 0, width, height);

  // Floor plane guide (Subtle gradient for spatial ground anchoring)
  const floorGradient = dCtx.createLinearGradient(0, height - 20, 0, height);
  floorGradient.addColorStop(0, 'rgb(24, 24, 24)');
  floorGradient.addColorStop(1, 'rgb(45, 45, 45)');
  dCtx.fillStyle = floorGradient;
  dCtx.fillRect(0, height - 20, width, 20);

  // Draw Cabinet Carcasses on Depth Map
  modules.forEach((mod) => {
    const x = toPxX(mod.posX);
    const y = toPxY(mod.elevationMm + mod.heightMm);
    const w = toPxW(mod.widthMm);
    const h = toPxH(mod.heightMm);

    // Calculate luminance based on unit depth (front protrusion)
    const normalizedDepth = Math.min(Math.max(mod.depthMm / 650, 0.4), 1.0);
    const luma = Math.round(50 + normalizedDepth * 195);

    // Carcass front face
    dCtx.fillStyle = `rgb(${luma}, ${luma}, ${luma})`;
    dCtx.fillRect(x, y, w, h);

    // High-contrast edge chamfer for ControlNet depth
    dCtx.strokeStyle = `rgb(${Math.min(luma + 25, 255)}, ${Math.min(luma + 25, 255)}, ${Math.min(luma + 25, 255)})`;
    dCtx.lineWidth = 2;
    dCtx.strokeRect(x, y, w, h);

    // Internal splits (Drawers / Doors) with slight inset depth
    if (mod.category === 'base_drawer' && mod.hardware.drawerChannels >= 2) {
      const splitY = y + h / 2;
      dCtx.strokeStyle = `rgb(${Math.max(luma - 30, 0)}, ${Math.max(luma - 30, 0)}, ${Math.max(luma - 30, 0)})`;
      dCtx.lineWidth = 3;
      dCtx.beginPath();
      dCtx.moveTo(x, splitY);
      dCtx.lineTo(x + w, splitY);
      dCtx.stroke();
    } else if (mod.category === 'double_shutter') {
      const splitX = x + w / 2;
      dCtx.strokeStyle = `rgb(${Math.max(luma - 30, 0)}, ${Math.max(luma - 30, 0)}, ${Math.max(luma - 30, 0)})`;
      dCtx.lineWidth = 3;
      dCtx.beginPath();
      dCtx.moveTo(splitX, y);
      dCtx.lineTo(splitX, y + h);
      dCtx.stroke();
    }
  });

  // -----------------------------------------------------------------
  // 2. WIREFRAME / CANNY MAP GENERATION (Pure White on Pure Black)
  // -----------------------------------------------------------------
  const wireCanvas = document.createElement('canvas');
  wireCanvas.width = width;
  wireCanvas.height = height;
  const wCtx = wireCanvas.getContext('2d')!;

  // Pure Black Background
  wCtx.fillStyle = '#000000';
  wCtx.fillRect(0, 0, width, height);

  // Architectural Room Bounds (Ground & Ceiling lines)
  wCtx.strokeStyle = '#ffffff';
  wCtx.lineWidth = 2;

  // Ground Line (Floor datum)
  wCtx.beginPath();
  wCtx.moveTo(0, height - 1);
  wCtx.lineTo(width, height - 1);
  wCtx.stroke();

  // Ceiling Line
  wCtx.beginPath();
  wCtx.moveTo(0, 1);
  wCtx.lineTo(width, 1);
  wCtx.stroke();

  // Draw Cabinet Wireframes & Construction Splits
  modules.forEach((mod) => {
    const x = toPxX(mod.posX);
    const y = toPxY(mod.elevationMm + mod.heightMm);
    const w = toPxW(mod.widthMm);
    const h = toPxH(mod.heightMm);

    // Carcass Outer Rectangle
    wCtx.strokeStyle = '#ffffff';
    wCtx.lineWidth = 3;
    wCtx.strokeRect(x, y, w, h);

    // Gola Profile / Shadow Channel line (for floating units)
    if (mod.elevationMm > 0) {
      wCtx.strokeStyle = '#888888';
      wCtx.lineWidth = 1.5;
      wCtx.beginPath();
      wCtx.moveTo(x + 5, y + h + 4);
      wCtx.lineTo(x + w - 5, y + h + 4);
      wCtx.stroke();
    }

    // Shutter Splits & Internal Details
    wCtx.strokeStyle = '#ffffff';
    wCtx.lineWidth = 2;
    if (mod.category === 'base_drawer') {
      const splitY = y + h / 2;
      wCtx.beginPath();
      wCtx.moveTo(x, splitY);
      wCtx.lineTo(x + w, splitY);
      wCtx.stroke();
    } else if (mod.category === 'double_shutter') {
      const splitX = x + w / 2;
      wCtx.beginPath();
      wCtx.moveTo(splitX, y);
      wCtx.lineTo(splitX, y + h);
      wCtx.stroke();
    }
  });

  const depthMapDataUrl = depthCanvas.toDataURL('image/png');
  const wireframeDataUrl = wireCanvas.toDataURL('image/png');
  const [depthBlob, wireframeBlob] = await Promise.all([
    new Promise<Blob>((res) => depthCanvas.toBlob((b) => res(b!), 'image/png')),
    new Promise<Blob>((res) => wireCanvas.toBlob((b) => res(b!), 'image/png')),
  ]);

  return {
    depthMapDataUrl,
    wireframeDataUrl,
    depthBlob,
    wireframeBlob,
    aspectRatio: width / height,
    canvasDimensions: { width, height },
  };
}
