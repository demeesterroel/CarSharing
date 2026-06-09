-- Owner-specific notification toggles: events on cars the person owns (#358).
-- Separate from the driver/member prefs so an owner who also drives other cars
-- can follow their own reservations/trips (driver prefs) AND their car (these).
ALTER TABLE people ADD COLUMN notify_my_car_reservations TEXT NOT NULL DEFAULT 'off';
ALTER TABLE people ADD COLUMN notify_my_car_trips        TEXT NOT NULL DEFAULT 'off';

-- Reservation updates default to 'mine' (your own outcome is always delivered).
-- 0026 added the column with a column-level default of 'off'; normalise existing
-- rows so nobody is silently opted out of their own reservation outcomes. Users
-- can still choose 'off' explicitly to suppress all reservation-update notices.
UPDATE people SET notify_reservation_updates = 'mine' WHERE notify_reservation_updates = 'off';
