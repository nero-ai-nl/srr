-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userType" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionRecord" (
    "id" TEXT NOT NULL,
    "chakra" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL,
    "sessionId" TEXT NOT NULL,

    CONSTRAINT "RetentionRecord_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RetentionRecord" ADD CONSTRAINT "RetentionRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
