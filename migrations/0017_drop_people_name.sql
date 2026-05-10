-- Remove the legacy 'name' column; first_name and last_name are authoritative.
ALTER TABLE people DROP COLUMN name;
