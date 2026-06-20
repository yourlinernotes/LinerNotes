-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "album" TEXT NOT NULL,
    "artworkUrl" TEXT NOT NULL,
    "previewUrl" TEXT,
    "duration" INTEGER,
    "releaseDate" TEXT,
    "genre" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Album" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "artworkUrl" TEXT NOT NULL,
    "releaseDate" TEXT,
    "totalTracks" INTEGER,
    "genre" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Track_artist_idx" ON "Track"("artist");
CREATE INDEX "Track_name_idx" ON "Track"("name");
CREATE INDEX "Track_createdAt_idx" ON "Track"("createdAt");

-- CreateIndex
CREATE INDEX "Album_artist_idx" ON "Album"("artist");
CREATE INDEX "Album_name_idx" ON "Album"("name");
CREATE INDEX "Album_createdAt_idx" ON "Album"("createdAt");

-- AlterTable Review: Make legacy track fields nullable
ALTER TABLE "Review" ALTER COLUMN "trackName" DROP NOT NULL;
ALTER TABLE "Review" ALTER COLUMN "trackArtist" DROP NOT NULL;
ALTER TABLE "Review" ALTER COLUMN "trackAlbum" DROP NOT NULL;
ALTER TABLE "Review" ALTER COLUMN "artworkUrl" DROP NOT NULL;

-- AlterTable AlbumReview: Make legacy album fields nullable  
ALTER TABLE "AlbumReview" ALTER COLUMN "albumName" DROP NOT NULL;
ALTER TABLE "AlbumReview" ALTER COLUMN "albumArtist" DROP NOT NULL;
ALTER TABLE "AlbumReview" ALTER COLUMN "artworkUrl" DROP NOT NULL;
