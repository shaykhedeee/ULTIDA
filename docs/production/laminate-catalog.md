# Laminate catalog A5

The versioned catalog lives in `packages/material-core/src/laminates.ts`, with 20 manufacturer decor records in `egger-source.json`. `catalog-core` adapts these into the existing CuratedLaminateCatalog feed. Material-library seeding preserves supplier code, swatch, source URL, allowed slots and PBR metadata.

Range: 13 matte neutrals/accents, 6 warm wood textures and 1 gloss black. Every swatch URL was extracted from its manufacturer's measured decor-crop section and responded HTTP 200 during import. These are external references, not bundled offline assets. Manufacturer imagery remains owned by EGGER.

The catalog specifies 0.8 mm laminate facing, not board thickness. Confirm regional stock and finish/thickness availability before procurement. The crop's manufacturer scale is approximate; crops are explicitly not marked seamless. Metalness and roughness are visualization presets. This catalog does not claim downloadable measured normal/roughness maps or supplier certification of a completed assembly.

Sources: individual decor URLs are stored per record. Product/availability reference: https://www.egger.com/get_download/f4863eca-08fe-4a40-990d-ba4087ab9ab9/availability.pdf?country=US

Verification:
- `npm run build:packages`: exit 0, all package builds passed.
- `node --test packages/material-core/test/laminates.test.mjs`: 1 passed, 0 failed. Verifies minimum count, unique IDs, required fields, allowed slots against MaterialSlotSchema, all three finishes, and catalog integration.
- API TypeScript check: exit 0.

Refresh source evidence using `scripts/import-egger-laminates.ps1`; unavailable pages are skipped and the count regression prevents silent shrinkage below 20.
