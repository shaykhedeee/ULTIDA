-- Storage Bucket and Strict Organization-Based RLS Policies

-- 1. Ensure private project-assets bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-assets',
  'project-assets',
  false,
  52428800, -- 50 MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];

-- 2. Helper function to verify authenticated user membership in organization
CREATE OR REPLACE FUNCTION public.is_org_member(check_org_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = check_org_id
      AND om.user_id = check_user_id
  );
$$;

-- 3. Storage Object RLS Policies
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow authenticated organization members to select storage objects in their organization folder
CREATE POLICY "Org members can read project asset objects"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-assets'
  AND EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.organization_members om ON om.organization_id = p.organization_id
    WHERE om.user_id = auth.uid()
      AND storage.foldername(name)[1] = p.organization_id::text
  )
);

-- Allow authenticated organization members to insert storage objects in their organization folder
CREATE POLICY "Org members can insert project asset objects"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-assets'
  AND EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.organization_members om ON om.organization_id = p.organization_id
    WHERE om.user_id = auth.uid()
      AND storage.foldername(name)[1] = p.organization_id::text
  )
);

-- Allow authenticated organization members to update storage objects in their organization folder
CREATE POLICY "Org members can update project asset objects"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-assets'
  AND EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.organization_members om ON om.organization_id = p.organization_id
    WHERE om.user_id = auth.uid()
      AND storage.foldername(name)[1] = p.organization_id::text
  )
);

-- Allow authenticated organization members to delete storage objects in their organization folder
CREATE POLICY "Org members can delete project asset objects"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-assets'
  AND EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.organization_members om ON om.organization_id = p.organization_id
    WHERE om.user_id = auth.uid()
      AND storage.foldername(name)[1] = p.organization_id::text
  )
);
