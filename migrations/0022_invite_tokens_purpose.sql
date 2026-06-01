-- Generalise invite_tokens so the same table can also carry password-reset and
-- magic-link sign-in tokens. Existing rows are invite tokens.
ALTER TABLE invite_tokens ADD COLUMN purpose TEXT NOT NULL DEFAULT 'invite';
