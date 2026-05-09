-- migrations/0010_people_bank_account.sql
ALTER TABLE people ADD COLUMN bank_account TEXT NOT NULL DEFAULT '';
