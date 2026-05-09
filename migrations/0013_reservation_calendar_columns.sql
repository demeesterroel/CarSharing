ALTER TABLE reservations ADD COLUMN google_event_id TEXT;
ALTER TABLE reservations ADD COLUMN last_synced_etag TEXT;
ALTER TABLE reservations ADD COLUMN last_app_write_nonce TEXT;
ALTER TABLE reservations ADD COLUMN last_known_response_status TEXT;
