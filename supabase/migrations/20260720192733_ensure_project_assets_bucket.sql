-- Ensure project-assets storage bucket exists
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-assets', 'project-assets', false, 52428800)
on conflict (id) do update set public = false;
