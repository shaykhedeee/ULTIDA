/**
 * Curated, source-linked references. These are not licensed 3D assets, physically
 * sampled swatches, live stock reports or fabrication-certified product records.
 * Dimensions are from current published manufacturer product pages.
 * Store and surface provenance instead of generating fictional SKUs/assets.
 */
export type SupplierEvidence = 'manufacturer-listed';
export type AssetReadiness = 'reference-only' | 'manufacturer-approved-asset';
export type MerinoReference = {
  id: string;
  kind: 'laminate' | 'decorative-panel';
  supplier: 'Merino';
  productLine: string;
  decorCode: string;
  name: string;
  finishCode: string | null;
  finish: string | null;
  designCategory: 'woodgrain' | 'stone' | 'solid';
  suggestedRooms: readonly string[];
  sourceUrl: string;
  evidence: SupplierEvidence;
  assetReadiness: AssetReadiness;
  sheetSizesMm: ReadonlyArray<readonly [number, number]>;
  actualThicknessMm: null;
  visualSwatchUrl: null;
  priceInr: null;
  verifiedAt: string;
  specificationNote: string;
};

export type IkeaReference = {
  id: string;
  supplier: 'IKEA';
  category: 'storage' | 'media' | 'study' | 'table' | 'seating';
  productNumber: string;
  series: string;
  name: string;
  dimensionsMm: { width: number; depth: number; height: number };
  roomTypes: readonly string[];
  productUrl: string;
  installationNotice: string | null;
  evidence: SupplierEvidence;
  /** User states they obtained IKEA permission, but its particular asset scope is not established here. */
  integrationRights: 'user-reported-permission-scope-unverified';
  assetReadiness: AssetReadiness;
  modelUrl: null;
  photoUrl: null;
  priceInr: null;
  stockStatus: 'not-checked';
  verifiedAt: string;
  productionRole: 'purchased-item-only';
};

const verifiedAt = '2026-10-13';
const merinoSense = 'https://www.merinolaminates.com/en/product-category/panels/merino-senses/';
const merinoLaminate = 'https://www.merinolaminates.com/en/product-category/laminates/merinolam/';
const merinoNature = 'https://www.merinolaminates.com/en/product-category/special-laminates/laminature/';
const merinoHarmony = 'https://www.merinolaminates.com/en/product-category/coordinated-surfaces-harmony/';
const commonSpec = 'Manufacturer-listed reference only. Confirm the exact surface, substrate, physical sample, real thickness, finish, current stock, sheet and edge compatibility before project approval.';
const woodRooms = ['kitchen', 'wardrobe', 'living', 'bedroom', 'study', 'tv-unit', 'crockery'] as const;

/** Do not fabricate visual color codes or image URLs from a decor name. */
export const VERIFIED_MERINO_REFERENCES: readonly MerinoReference[] = [
  {id:'merino-senses-14149-rs',kind:'decorative-panel',supplier:'Merino',productLine:'Merino Senses Roble Sync',decorCode:'14149',name:'Alameda Oak Dune',finishCode:'RS',finish:'Roble Sync',designCategory:'woodgrain',suggestedRooms:woodRooms,sourceUrl:merinoSense,evidence:'manufacturer-listed',assetReadiness:'reference-only',sheetSizesMm:[[1220,2745]],actualThicknessMm:null,visualSwatchUrl:null,priceInr:null,verifiedAt,specificationNote:commonSpec},
  {id:'merino-senses-14151-rs',kind:'decorative-panel',supplier:'Merino',productLine:'Merino Senses Roble Sync',decorCode:'14151',name:'Alameda Oak Pelican',finishCode:'RS',finish:'Roble Sync',designCategory:'woodgrain',suggestedRooms:woodRooms,sourceUrl:merinoSense,evidence:'manufacturer-listed',assetReadiness:'reference-only',sheetSizesMm:[[1220,2745]],actualThicknessMm:null,visualSwatchUrl:null,priceInr:null,verifiedAt,specificationNote:commonSpec},
  {id:'merino-senses-14172-os',kind:'decorative-panel',supplier:'Merino',productLine:'Merino Senses Oak Sync',decorCode:'14172',name:'Light Drift Oak',finishCode:'OS',finish:'Oak Sync',designCategory:'woodgrain',suggestedRooms:woodRooms,sourceUrl:merinoSense,evidence:'manufacturer-listed',assetReadiness:'reference-only',sheetSizesMm:[[1220,2745]],actualThicknessMm:null,visualSwatchUrl:null,priceInr:null,verifiedAt,specificationNote:commonSpec},
  {id:'merino-senses-14189-os',kind:'decorative-panel',supplier:'Merino',productLine:'Merino Senses Oak Sync',decorCode:'14189',name:'Honey Oak Wood',finishCode:'OS',finish:'Oak Sync',designCategory:'woodgrain',suggestedRooms:woodRooms,sourceUrl:merinoSense,evidence:'manufacturer-listed',assetReadiness:'reference-only',sheetSizesMm:[[1220,2745]],actualThicknessMm:null,visualSwatchUrl:null,priceInr:null,verifiedAt,specificationNote:commonSpec},
  {id:'merino-senses-14101-ns',kind:'decorative-panel',supplier:'Merino',productLine:'Merino Senses Noce Sync',decorCode:'14101',name:'Cinder Walnut',finishCode:'NS',finish:'Noce Sync',designCategory:'woodgrain',suggestedRooms:woodRooms,sourceUrl:merinoSense,evidence:'manufacturer-listed',assetReadiness:'reference-only',sheetSizesMm:[[1220,2745],[1220,3050]],actualThicknessMm:null,visualSwatchUrl:null,priceInr:null,verifiedAt,specificationNote:commonSpec},
  {id:'merino-senses-14103-ns',kind:'decorative-panel',supplier:'Merino',productLine:'Merino Senses Noce Sync',decorCode:'14103',name:'Ground Walnut',finishCode:'NS',finish:'Noce Sync',designCategory:'woodgrain',suggestedRooms:woodRooms,sourceUrl:merinoSense,evidence:'manufacturer-listed',assetReadiness:'reference-only',sheetSizesMm:[[1220,2745],[1220,3050]],actualThicknessMm:null,visualSwatchUrl:null,priceInr:null,verifiedAt,specificationNote:commonSpec},
  {id:'merino-laminature-14183',kind:'laminate',supplier:'Merino',productLine:'Merino Laminature',decorCode:'14183',name:'Mille Ontario Oak',finishCode:null,finish:'Laminature textured',designCategory:'woodgrain',suggestedRooms:woodRooms,sourceUrl:merinoNature,evidence:'manufacturer-listed',assetReadiness:'reference-only',sheetSizesMm:[],actualThicknessMm:null,visualSwatchUrl:null,priceInr:null,verifiedAt,specificationNote:commonSpec},
  {id:'merino-laminature-14190',kind:'laminate',supplier:'Merino',productLine:'Merino Laminature',decorCode:'14190',name:'Nuptse Lavito Walnut',finishCode:null,finish:'Laminature textured',designCategory:'woodgrain',suggestedRooms:woodRooms,sourceUrl:merinoNature,evidence:'manufacturer-listed',assetReadiness:'reference-only',sheetSizesMm:[],actualThicknessMm:null,visualSwatchUrl:null,priceInr:null,verifiedAt,specificationNote:commonSpec},
  {id:'merino-merinolam-10031',kind:'laminate',supplier:'Merino',productLine:'MerinoLam HPL',decorCode:'10031',name:'Fine Oak',finishCode:null,finish:null,designCategory:'woodgrain',suggestedRooms:woodRooms,sourceUrl:merinoLaminate,evidence:'manufacturer-listed',assetReadiness:'reference-only',sheetSizesMm:[],actualThicknessMm:null,visualSwatchUrl:null,priceInr:null,verifiedAt,specificationNote:commonSpec},
  {id:'merino-merinolam-10099',kind:'laminate',supplier:'Merino',productLine:'MerinoLam HPL',decorCode:'10099',name:'Alaskan Walnut',finishCode:null,finish:null,designCategory:'woodgrain',suggestedRooms:woodRooms,sourceUrl:merinoLaminate,evidence:'manufacturer-listed',assetReadiness:'reference-only',sheetSizesMm:[],actualThicknessMm:null,visualSwatchUrl:null,priceInr:null,verifiedAt,specificationNote:commonSpec},
  {id:'merino-merinolam-10002',kind:'laminate',supplier:'Merino',productLine:'MerinoLam HPL',decorCode:'10002',name:'Mangfall Beech',finishCode:null,finish:null,designCategory:'woodgrain',suggestedRooms:woodRooms,sourceUrl:merinoLaminate,evidence:'manufacturer-listed',assetReadiness:'reference-only',sheetSizesMm:[],actualThicknessMm:null,visualSwatchUrl:null,priceInr:null,verifiedAt,specificationNote:commonSpec},
  {id:'merino-merinolam-10012',kind:'laminate',supplier:'Merino',productLine:'MerinoLam HPL',decorCode:'10012',name:'Oxford Cherry',finishCode:null,finish:null,designCategory:'woodgrain',suggestedRooms:woodRooms,sourceUrl:merinoLaminate,evidence:'manufacturer-listed',assetReadiness:'reference-only',sheetSizesMm:[],actualThicknessMm:null,visualSwatchUrl:null,priceInr:null,verifiedAt,specificationNote:commonSpec},
  {id:'merino-merinolam-10042',kind:'laminate',supplier:'Merino',productLine:'MerinoLam HPL',decorCode:'10042',name:'Golden Beech',finishCode:null,finish:null,designCategory:'woodgrain',suggestedRooms:woodRooms,sourceUrl:merinoLaminate,evidence:'manufacturer-listed',assetReadiness:'reference-only',sheetSizesMm:[],actualThicknessMm:null,visualSwatchUrl:null,priceInr:null,verifiedAt,specificationNote:commonSpec},
  {id:'merino-merinolam-10168',kind:'laminate',supplier:'Merino',productLine:'MerinoLam HPL',decorCode:'10168',name:'Mediterranean Oak',finishCode:null,finish:null,designCategory:'woodgrain',suggestedRooms:woodRooms,sourceUrl:merinoLaminate,evidence:'manufacturer-listed',assetReadiness:'reference-only',sheetSizesMm:[],actualThicknessMm:null,visualSwatchUrl:null,priceInr:null,verifiedAt,specificationNote:commonSpec},
  {id:'merino-merinolam-10184',kind:'laminate',supplier:'Merino',productLine:'MerinoLam HPL',decorCode:'10184',name:'Arizona Walnut',finishCode:null,finish:null,designCategory:'woodgrain',suggestedRooms:woodRooms,sourceUrl:merinoLaminate,evidence:'manufacturer-listed',assetReadiness:'reference-only',sheetSizesMm:[],actualThicknessMm:null,visualSwatchUrl:null,priceInr:null,verifiedAt,specificationNote:commonSpec},
  {id:'merino-harmony-14682',kind:'laminate',supplier:'Merino',productLine:'Merino Harmony',decorCode:'14682',name:'Mellow Oak',finishCode:null,finish:'Coordinated surfaces',designCategory:'woodgrain',suggestedRooms:woodRooms,sourceUrl:merinoHarmony,evidence:'manufacturer-listed',assetReadiness:'reference-only',sheetSizesMm:[],actualThicknessMm:null,visualSwatchUrl:null,priceInr:null,verifiedAt,specificationNote:commonSpec}
] as const;

/** Representative genuine IKEA India SKUs; not a substitute for live inventory. */
export const VERIFIED_IKEA_REFERENCES: readonly IkeaReference[] = [
  {id:'ikea-billy-00522047',supplier:'IKEA',category:'storage',productNumber:'005.220.47',series:'BILLY',name:'BILLY Bookcase White',dimensionsMm:{width:800,depth:280,height:2020},roomTypes:['study','living','bedroom'],productUrl:'https://www.ikea.com/in/en/p/billy-bookcase-white-00522047/',installationNotice:'Wall anchoring required to prevent tipping.',evidence:'manufacturer-listed',integrationRights:'user-reported-permission-scope-unverified',assetReadiness:'reference-only',modelUrl:null,photoUrl:null,priceInr:null,stockStatus:'not-checked',verifiedAt,productionRole:'purchased-item-only'},
  {id:'ikea-kallax-20351884',supplier:'IKEA',category:'storage',productNumber:'203.518.84',series:'KALLAX',name:'KALLAX Shelving Unit White',dimensionsMm:{width:765,depth:390,height:1465},roomTypes:['study','living','bedroom'],productUrl:'https://www.ikea.com/in/en/p/kallax-shelving-unit-white-20351884/',installationNotice:'Follow IKEA installation and securing instructions; do not infer mounting loads.',evidence:'manufacturer-listed',integrationRights:'user-reported-permission-scope-unverified',assetReadiness:'reference-only',modelUrl:null,photoUrl:null,priceInr:null,stockStatus:'not-checked',verifiedAt,productionRole:'purchased-item-only'},
  {id:'ikea-besta-10294525',supplier:'IKEA',category:'media',productNumber:'102.945.25',series:'BESTÅ',name:'BESTÅ TV Bench White',dimensionsMm:{width:1200,depth:400,height:380},roomTypes:['living','bedroom'],productUrl:'https://www.ikea.com/in/en/p/besta-tv-bench-white-10294525/',installationNotice:'IKEA specifies wall fixing for floor-standing units; follow supplied hardware and load limits.',evidence:'manufacturer-listed',integrationRights:'user-reported-permission-scope-unverified',assetReadiness:'reference-only',modelUrl:null,photoUrl:null,priceInr:null,stockStatus:'not-checked',verifiedAt,productionRole:'purchased-item-only'},
  {id:'ikea-micke-80354276',supplier:'IKEA',category:'study',productNumber:'803.542.76',series:'MICKE',name:'MICKE Desk White',dimensionsMm:{width:1050,depth:500,height:750},roomTypes:['study','bedroom'],productUrl:'https://www.ikea.com/in/en/p/micke-desk-white-80354276/',installationNotice:'Observe published load limits and assembly constraints.',evidence:'manufacturer-listed',integrationRights:'user-reported-permission-scope-unverified',assetReadiness:'reference-only',modelUrl:null,photoUrl:null,priceInr:null,stockStatus:'not-checked',verifiedAt,productionRole:'purchased-item-only'},
  {id:'ikea-lack-70449906',supplier:'IKEA',category:'table',productNumber:'704.499.06',series:'LACK',name:'LACK Coffee Table White',dimensionsMm:{width:900,depth:550,height:450},roomTypes:['living'],productUrl:'https://www.ikea.com/in/en/p/lack-coffee-table-white-70449906/',installationNotice:'Observe table-top loading and assembly instructions.',evidence:'manufacturer-listed',integrationRights:'user-reported-permission-scope-unverified',assetReadiness:'reference-only',modelUrl:null,photoUrl:null,priceInr:null,stockStatus:'not-checked',verifiedAt,productionRole:'purchased-item-only'},
  {id:'ikea-poaeng-49240824',supplier:'IKEA',category:'seating',productNumber:'492.408.24',series:'POÄNG',name:'POÄNG Armchair Birch Veneer / Knisa Black',dimensionsMm:{width:680,depth:830,height:1000},roomTypes:['living','bedroom'],productUrl:'https://www.ikea.com/in/en/p/poaeng-armchair-birch-veneer-knisa-black-s49240824/',installationNotice:'Use as a purchased complete chair; do not substitute bare frame dimensions for complete product.',evidence:'manufacturer-listed',integrationRights:'user-reported-permission-scope-unverified',assetReadiness:'reference-only',modelUrl:null,photoUrl:null,priceInr:null,stockStatus:'not-checked',verifiedAt,productionRole:'purchased-item-only'}
] as const;

export function findVerifiedProduct(id: string): MerinoReference | IkeaReference | undefined {
  return VERIFIED_IKEA_REFERENCES.find(item => item.id === id) ?? VERIFIED_MERINO_REFERENCES.find(item => item.id === id);
}

export function assertRetailIsNotCutlistPart(item: IkeaReference): boolean {
  return item.productionRole === 'purchased-item-only' && item.modelUrl === null;
}
