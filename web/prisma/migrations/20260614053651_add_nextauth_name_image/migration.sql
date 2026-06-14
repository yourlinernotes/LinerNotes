-- AlterTable: Add name and image columns for NextAuth Prisma adapter
ALTER TABLE "User" ADD COLUMN "name" TEXT;
ALTER TABLE "User" ADD COLUMN "image" TEXT;
