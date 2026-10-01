# Hosted connection audit — 2026-10-01

- Production /api/health is healthy at main 24dcb270bfaf914f5f4bf65c47df4d53b77324a7, behind local integration 459c8326b13b36367dbc90ac79a0a16bcb3d21bf plus uncommitted fixes.
- Supabase ichnyfuetcucxhxilnre is ACTIVE_HEALTHY. project-assets is private. API reports durable worker dispatch and Cloudflare image generation eligible.
- Signed-in browser verified as zebbroka@gmail.com. Opened Sharma project b1ed6cfe-2965-4437-84e6-0f53dfd54a8f.
- This project has zero persisted module instances. Deployed SceneStudio displays fallback sample geometry (5 modules / 6 openings) while render correctly blocks with Scene required. Current local version removes this misleading fallback.
- Job table contains two failed PDF analyses and one succeeded analysis; no render job exists. Failed jobs report PDF_RASTERIZATION_UNAVAILABLE, absent pdftoppm and unsupported Sharp PDF decoding. Provider readiness is not proof of image generation.
- Vercel get_project connector cannot resolve its conflicting projectId/idOrName schemas; direct public health endpoint used independently. No credentials or policies changed.
- Next: portable PDF rasterization, review/release current local changes, save an actual calibrated room and certified modules, approve scene, create real render job, inspect durable asset and signed-in exports. Do not bypass approval or Preview isolation.

## Portable PDF fix (local)

Added PDF.js + bundled canvas rendering before optional Poppler/Sharp decoders. First-page output uses the original page aspect ratio, bounded to a 2400-pixel longest edge; calibration remains a separate required step. Original PDF is retained. Vercel packaging includes PDF.js fonts/maps/worker and native canvas assets. Malformed PDFs are rejected; no synthetic room fallback is introduced.

Verified: API TypeScript (exit 0), two pixel-level PDF tests, and local rendering/visual inspection of Floor Plan from Builder.pdf. Hosted verification still requires deployment. npm audit also reports pre-existing dependency advisories; do not mark security review complete.
