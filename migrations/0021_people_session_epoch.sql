-- Per-user session epoch for server-side session revocation ("log out everywhere").
-- Each issued session cookie records the user's current epoch; bumping this value
-- invalidates every previously issued cookie for that user on the next request.
ALTER TABLE people ADD COLUMN session_epoch INTEGER NOT NULL DEFAULT 0;
