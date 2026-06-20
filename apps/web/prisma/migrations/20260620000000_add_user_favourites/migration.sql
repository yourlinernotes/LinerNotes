-- Add the curated Top-4 favourites column (JSON array of "track:<id>" / "album:<id>" refs)
ALTER TABLE "User" ADD COLUMN "favourites" TEXT;
