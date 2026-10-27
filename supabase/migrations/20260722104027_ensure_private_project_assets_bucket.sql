-- Ensure project-assets bucket remains strictly private
update storage.buckets set public = false where id = 'project-assets';
