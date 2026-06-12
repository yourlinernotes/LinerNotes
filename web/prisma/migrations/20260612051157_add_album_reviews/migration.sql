-- CreateTable
CREATE TABLE "AlbumReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "albumName" TEXT NOT NULL,
    "albumArtist" TEXT NOT NULL,
    "artworkUrl" TEXT NOT NULL,
    "releaseDate" TEXT,
    "totalTracks" INTEGER,
    "overallRating" DOUBLE PRECISION,
    "take" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlbumReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "albumReviewId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlbumLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumRepost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "albumReviewId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlbumRepost_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Review" ADD COLUMN "albumReviewId" TEXT;
ALTER TABLE "Review" ADD COLUMN "trackNumber" INTEGER;
ALTER TABLE "Review" ADD COLUMN "reaction" TEXT;

-- CreateIndex
CREATE INDEX "AlbumReview_userId_idx" ON "AlbumReview"("userId");
CREATE INDEX "AlbumReview_createdAt_idx" ON "AlbumReview"("createdAt");

-- CreateIndex
CREATE INDEX "AlbumLike_userId_idx" ON "AlbumLike"("userId");
CREATE INDEX "AlbumLike_albumReviewId_idx" ON "AlbumLike"("albumReviewId");
CREATE UNIQUE INDEX "AlbumLike_userId_albumReviewId_key" ON "AlbumLike"("userId", "albumReviewId");

-- CreateIndex
CREATE INDEX "AlbumRepost_userId_idx" ON "AlbumRepost"("userId");
CREATE INDEX "AlbumRepost_albumReviewId_idx" ON "AlbumRepost"("albumReviewId");
CREATE INDEX "AlbumRepost_createdAt_idx" ON "AlbumRepost"("createdAt");
CREATE UNIQUE INDEX "AlbumRepost_userId_albumReviewId_key" ON "AlbumRepost"("userId", "albumReviewId");

-- CreateIndex
CREATE INDEX "Review_albumReviewId_idx" ON "Review"("albumReviewId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_albumReviewId_fkey" FOREIGN KEY ("albumReviewId") REFERENCES "AlbumReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumReview" ADD CONSTRAINT "AlbumReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumLike" ADD CONSTRAINT "AlbumLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumLike" ADD CONSTRAINT "AlbumLike_albumReviewId_fkey" FOREIGN KEY ("albumReviewId") REFERENCES "AlbumReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumRepost" ADD CONSTRAINT "AlbumRepost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumRepost" ADD CONSTRAINT "AlbumRepost_albumReviewId_fkey" FOREIGN KEY ("albumReviewId") REFERENCES "AlbumReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
