-- Patch 001: keep the typed location as free text.
--
-- Decided during step 4: the IT Support Request and the four forms keep a
-- free-text Location box for now, instead of a site dropdown. site_id stays in
-- place for when a site list is introduced.
--
-- Run once in the Supabase SQL Editor. Safe to run again. Already included in
-- db/schema.sql for new databases.
-- SQL Server: IF COL_LENGTH('tickets','location_text') IS NULL ALTER TABLE tickets ADD location_text NVARCHAR(200);

ALTER TABLE tickets          ADD COLUMN IF NOT EXISTS location_text VARCHAR(200);
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS location_text VARCHAR(200);

-- Make the new columns visible to the REST API straight away.
NOTIFY pgrst, 'reload schema';
