-- Add first_name and last_name columns to people table.
-- Populate by splitting the existing name on the first space.
ALTER TABLE people ADD COLUMN first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE people ADD COLUMN last_name  TEXT NOT NULL DEFAULT '';

UPDATE people SET
  first_name = CASE
    WHEN instr(name, ' ') > 0 THEN substr(name, 1, instr(name, ' ') - 1)
    ELSE name
  END,
  last_name = CASE
    WHEN instr(name, ' ') > 0 THEN substr(name, instr(name, ' ') + 1)
    ELSE ''
  END;
