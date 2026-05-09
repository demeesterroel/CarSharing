ALTER TABLE cars ADD COLUMN owner_person_id INTEGER REFERENCES people(id);
