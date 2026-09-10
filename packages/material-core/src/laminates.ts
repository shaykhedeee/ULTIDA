import sources from './egger-source.json' with { type: 'json' };

export type MaterialVersionV1 = {
  schema: 'material.version.v1'; id: string; version: 1; supplier: string;
  supplierCode: string; name: string; category: 'laminate';
  finish: 'matte' | 'glossy' | 'textured'; thicknessMm: number;
  grainDirection: 'none' | 'lengthwise';
  allowedSlots: ('carcass' | 'shutter' | 'back-panel')[];
  swatchUrl: string; sourceUrl: string;
  pbr: { baseColorUrl: string; textureScaleMm: { width: number; height: number }; metalness: 0; roughness: number; parameterSource: 'visualization-preset'; seamless: false };
  specificationNote: string;
};

export const LaminateMaterialVersions: MaterialVersionV1[] = sources.map((source) => {
  const wood = source.code.startsWith('H');
  const glossy = /_(HG|PG)$/.test(source.code);
  return {
    schema: 'material.version.v1', id: `egger-${source.code.toLowerCase()}-v1`, version: 1,
    supplier: 'EGGER', supplierCode: source.title.split(' ').slice(0, 2).join(' '),
    name: source.title, category: 'laminate', finish: wood ? 'textured' : glossy ? 'glossy' : 'matte',
    thicknessMm: 0.8, grainDirection: wood ? 'lengthwise' : 'none',
    allowedSlots: ['carcass', 'shutter', 'back-panel'],
    swatchUrl: source.swatchUrl, sourceUrl: source.sourceUrl,
    pbr: { baseColorUrl: source.swatchUrl, textureScaleMm: { width: source.widthMm, height: source.heightMm }, metalness: 0, roughness: glossy ? 0.16 : wood ? 0.7 : 0.8, parameterSource: 'visualization-preset', seamless: false },
    specificationNote: '0.8 mm laminate specification; confirm regional finish/thickness availability before ordering. Manufacturer swatch scale is approximate. Swatch is a decor crop, not a seamless full-sheet texture; roughness is a visualization preset.',
  };
});
