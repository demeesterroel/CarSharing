-- Optional start/end times for reservations (#191).
-- Both NULL = all-day (unchanged behaviour). When set (HH:MM), the reservation
-- is a single day (start_date == end_date) with a time range. Additive +
-- nullable, so existing all-day reservations are unaffected.
ALTER TABLE reservations ADD COLUMN start_time TEXT;
ALTER TABLE reservations ADD COLUMN end_time TEXT;
