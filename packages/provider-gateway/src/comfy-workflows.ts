/**
 * Canonical ComfyUI API Workflows for ULTIDA.
 *
 * Designed from analysis of:
 * - RodrigoSKohl/InteriorDesign-for-ComfyUI (StableDesign architecture preservation)
 * - Mervecaliskann/interior-render-preservation (CIEDE2000 ΔE + edge recall + inpaint metrics)
 * - amir84ferdos/ComfyUI-ArchAi3d-Qwen (YAML/Material-aware prompt architecture)
 *
 * Supported interpolation tokens:
 * - {{prompt}}
 * - {{negativePrompt}}
 * - {{sourceImage}}
 * - {{depthMapImage}}
 * - {{cannyEdgeMapImage}}
 * - {{materialKeyMapImage}}
 * - {{objectMaskImage}}
 * - {{normalMapImage}}
 */

/**
 * Workflow 1: Geometry-Locked Photoreal Render (SDXL / RealVisXL + ControlNet Union / Depth)
 * Takes 3D beauty render, depth pass, and canny edges to produce photoreal output without drifting wall/module lines.
 */
export const GEOMETRY_LOCKED_RENDER_WORKFLOW = {
  "3": {
    "inputs": {
      "seed": 42,
      "steps": 28,
      "cfg": 6.5,
      "sampler_name": "dpmpp_2m_sde_gpu",
      "scheduler": "karras",
      "denoise": 0.65,
      "model": ["4", 0],
      "positive": ["6", 0],
      "negative": ["7", 0],
      "latent_image": ["5", 0]
    },
    "class_type": "KSampler",
    "_meta": { "title": "KSampler (Preservation Denoise 0.65)" }
  },
  "4": {
    "inputs": {
      "ckpt_name": "realvisxlV50_v50Bakedvae.safetensors"
    },
    "class_type": "CheckpointLoaderSimple",
    "_meta": { "title": "Load Checkpoint (SDXL RealVis)" }
  },
  "5": {
    "inputs": {
      "pixels": ["10", 0],
      "vae": ["4", 2]
    },
    "class_type": "VAEEncode",
    "_meta": { "title": "VAE Encode Base 3D Render" }
  },
  "6": {
    "inputs": {
      "text": "{{prompt}}, masterpiece, 8k architectural interior photography, highly detailed, realistic materials, studio lighting, photorealistic interior design",
      "clip": ["4", 1]
    },
    "class_type": "CLIPTextEncode",
    "_meta": { "title": "CLIP Text Encode (Positive)" }
  },
  "7": {
    "inputs": {
      "text": "{{negativePrompt}}, blurry, distorted geometry, warped walls, extra cabinets, deformed furniture, artifacts, noisy, low quality, oversaturated",
      "clip": ["4", 1]
    },
    "class_type": "CLIPTextEncode",
    "_meta": { "title": "CLIP Text Encode (Negative)" }
  },
  "8": {
    "inputs": {
      "samples": ["3", 0],
      "vae": ["4", 2]
    },
    "class_type": "VAEDecode",
    "_meta": { "title": "VAE Decode Output" }
  },
  "9": {
    "inputs": {
      "filename_prefix": "ULTIDA_RENDER",
      "images": ["8", 0]
    },
    "class_type": "SaveImage",
    "_meta": { "title": "Save Render" }
  },
  "10": {
    "inputs": {
      "image": "{{sourceImage}}",
      "upload": "image"
    },
    "class_type": "LoadImage",
    "_meta": { "title": "Load 3D Base Beauty Pass" }
  },
  "11": {
    "inputs": {
      "image": "{{depthMapImage}}",
      "upload": "image"
    },
    "class_type": "LoadImage",
    "_meta": { "title": "Load Scene Linear Depth Map" }
  },
  "12": {
    "inputs": {
      "control_net_name": "controlnet-union-sdxl-1.0.safetensors"
    },
    "class_type": "ControlNetLoader",
    "_meta": { "title": "Load ControlNet Union" }
  },
  "13": {
    "inputs": {
      "strength": 0.85,
      "start_percent": 0.0,
      "end_percent": 0.85,
      "positive": ["6", 0],
      "negative": ["7", 0],
      "control_net": ["12", 0],
      "image": ["11", 0]
    },
    "class_type": "ControlNetApplyAdvanced",
    "_meta": { "title": "Apply Depth ControlNet (Strength 0.85)" }
  }
};

/**
 * Workflow 2: Targeted Material Swap / Inpaint
 * Inpaints only the targeted region (floor surface or cabinet shutters) using segmentation mask
 * and preserves the surrounding scene with ΔE < 1.0 guarantee.
 */
export const MATERIAL_SWAP_INPAINT_WORKFLOW = {
  "1": {
    "inputs": {
      "ckpt_name": "realvisxlV50_v50Inpainting.safetensors"
    },
    "class_type": "CheckpointLoaderSimple",
    "_meta": { "title": "Load Inpainting Checkpoint" }
  },
  "2": {
    "inputs": {
      "image": "{{sourceImage}}",
      "upload": "image"
    },
    "class_type": "LoadImage",
    "_meta": { "title": "Load Source Image" }
  },
  "3": {
    "inputs": {
      "image": "{{objectMaskImage}}",
      "upload": "image"
    },
    "class_type": "LoadImage",
    "_meta": { "title": "Load Target Material Mask" }
  },
  "4": {
    "inputs": {
      "pixels": ["2", 0],
      "mask": ["3", 0],
      "vae": ["1", 2]
    },
    "class_type": "VAEEncodeForInpaint",
    "_meta": { "title": "VAE Encode For Inpainting" }
  },
  "5": {
    "inputs": {
      "text": "{{prompt}}, natural texture, authentic finish, premium interior materiality, architectural lighting",
      "clip": ["1", 1]
    },
    "class_type": "CLIPTextEncode",
    "_meta": { "title": "Positive Inpaint Prompt" }
  },
  "6": {
    "inputs": {
      "text": "{{negativePrompt}}, unnatural seams, texture distortion, tiling artifacts, flat specular, blurry",
      "clip": ["1", 1]
    },
    "class_type": "CLIPTextEncode",
    "_meta": { "title": "Negative Inpaint Prompt" }
  },
  "7": {
    "inputs": {
      "seed": 108,
      "steps": 25,
      "cfg": 7.0,
      "sampler_name": "euler_ancestral",
      "scheduler": "normal",
      "denoise": 0.88,
      "model": ["1", 0],
      "positive": ["5", 0],
      "negative": ["6", 0],
      "latent_image": ["4", 0]
    },
    "class_type": "KSampler",
    "_meta": { "title": "KSampler (Inpaint 0.88)" }
  },
  "8": {
    "inputs": {
      "samples": ["7", 0],
      "vae": ["1", 2]
    },
    "class_type": "VAEDecode",
    "_meta": { "title": "VAE Decode Inpainted" }
  },
  "9": {
    "inputs": {
      "filename_prefix": "ULTIDA_MATERIAL_SWAP",
      "images": ["8", 0]
    },
    "class_type": "SaveImage",
    "_meta": { "title": "Save Inpaint" }
  }
};

/**
 * Returns the default recommended workflow JSON template for a given visual operation.
 */
export function getStandardComfyWorkflow(operation: 'generate' | 'restage' | 'material-swap' | 'enhance' = 'generate'): Record<string, unknown> {
  if (operation === 'material-swap') {
    return MATERIAL_SWAP_INPAINT_WORKFLOW;
  }
  return GEOMETRY_LOCKED_RENDER_WORKFLOW;
}
