-- CreateTable
CREATE TABLE "MusicConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "serviceUserId" TEXT,
    "serviceUsername" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "sessionKey" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MusicConnection_userId_idx" ON "MusicConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MusicConnection_userId_service_key" ON "MusicConnection"("userId", "service");

-- AddForeignKey
ALTER TABLE "MusicConnection" ADD CONSTRAINT "MusicConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
