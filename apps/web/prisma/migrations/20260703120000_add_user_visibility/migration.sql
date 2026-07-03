-- Account privacy: PUBLIC (default) vs PRIVATE.
-- Idempotent so it's safe to re-run.

DO $$ BEGIN
  CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'PRIVATE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC';
