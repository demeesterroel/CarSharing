ALTER TABLE cars ADD COLUMN owner_from TEXT;
ALTER TABLE cars ADD COLUMN owner_to   TEXT;

-- Backfill: all current cars with an owner started on 2018-01-01, no end date
UPDATE cars SET owner_from = '2018-01-01' WHERE owner_name IS NOT NULL AND owner_from IS NULL;
