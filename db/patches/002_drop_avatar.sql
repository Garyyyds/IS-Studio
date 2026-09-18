-- Patch 002: drop the unused avatar column.
--
-- The avatar feature was removed from the app (version 15092026ver014). The
-- column only holds auto-generated picture links, no uploaded files, and
-- nothing in the app reads or writes it any more.
--
-- Run once in the Supabase SQL Editor. Safe to run again.
-- This deletes the column and its values for good, so take a backup first if
-- you want to keep them.

ALTER TABLE app_users DROP COLUMN IF EXISTS avatar;

-- Make the change visible to the REST API straight away.
NOTIFY pgrst, 'reload schema';
