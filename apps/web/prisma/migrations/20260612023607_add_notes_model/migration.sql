-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "seconds" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Note_reviewId_idx" ON "Note"("reviewId");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN "featuredNoteId" TEXT;

-- Migrate existing moment data to Note table
INSERT INTO "Note" ("id", "reviewId", "seconds", "label", "createdAt")
SELECT
    gen_random_uuid()::TEXT,
    "id" as "reviewId",
    "momentSeconds" as "seconds",
    COALESCE("momentLabel", 'marked moment') as "label",
    "createdAt"
FROM "Review"
WHERE "momentSeconds" IS NOT NULL;

-- Update featuredNoteId to point to the migrated note
UPDATE "Review" r
SET "featuredNoteId" = n."id"
FROM "Note" n
WHERE r."id" = n."reviewId"
  AND r."momentSeconds" IS NOT NULL;
