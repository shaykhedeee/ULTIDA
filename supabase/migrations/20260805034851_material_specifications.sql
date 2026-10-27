-- Production material contract: laminate sheet thickness and edge-banding
-- are explicit inputs, never inferred from a reference image.
alter table public.material_library_items
  add column if not exists substrate text not null default 'plywood',
  add column if not exists edge_band_thickness_mm numeric,
  add column if not exists edge_band_material text,
  add column if not exists edge_band_code text,
  add column if not exists edge_band_status text not null default 'required';

alter table public.material_library_items drop constraint if exists material_laminate_thickness_chk;
alter table public.material_library_items add constraint material_laminate_thickness_chk
  check (lower(category) not in ('laminate','acrylic','veneer') or thickness_mm is null or thickness_mm in (0.8, 1.0));
alter table public.material_library_items drop constraint if exists material_edge_band_status_chk;
alter table public.material_library_items add constraint material_edge_band_status_chk
  check (edge_band_status in ('required','integrated','not_required','confirmed'));
create index if not exists material_library_items_thickness_idx on public.material_library_items(organization_id, category, thickness_mm, edge_band_status);
