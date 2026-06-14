-- AlterTable: Add emailVerified column for NextAuth
ALTER TABLE "User" ADD COLUMN "emailVerified" TIMESTAMP(3);

-- AlterTable: Add passwordHash column for credentials auth
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

-- AlterTable: Make spotifyId nullable (no longer required)
ALTER TABLE "User" ALTER COLUMN "spotifyId" DROP NOT NULL;
