-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed a default test user (username: testuser, password: sadhana123)
INSERT INTO "User" ("id", "username", "passwordHash", "displayName")
VALUES (
    'test-user-1',
    'testuser',
    '$2b$10$6ivoRwzdrTlh092OJhrIRe0Xetf9/JrMj1Y8vB6YqKJbpTa8UFO52',
    'Test User'
)
ON CONFLICT ("username") DO NOTHING;
