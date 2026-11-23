-- ---------------------------------------------------------------------------
-- Migration: larger private assessment-import uploads
-- ---------------------------------------------------------------------------
-- The importer now streams files directly from the browser to the private
-- assessment-imports bucket with short-lived signed upload URLs. This keeps
-- large files out of Vercel Function bodies while preserving the existing
-- owner-folder storage policies.
--
-- The server default is 50 MiB per file (ASSESSMENT_IMPORT_MAX_BYTES=52428800)
-- and never allows more than 50 MiB. The bucket limit below is the storage-side
-- backstop for the same value. No RLS policy, table or auth rule changes.
--
-- Apply with explicit approval; this file is intentionally not auto-applied.
-- ---------------------------------------------------------------------------

update storage.buckets
set file_size_limit = 52428800, -- 50 MiB
    allowed_mime_types = array[
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
where id = 'assessment-imports';
