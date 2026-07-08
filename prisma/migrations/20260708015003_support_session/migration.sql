-- CreateTable
CREATE TABLE "support_session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "voice" TEXT NOT NULL DEFAULT 'Kore',
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "transcript" JSONB,
    "rating" INTEGER,
    "feedback" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_session_status_createdAt_idx" ON "support_session"("status", "createdAt");

-- CreateIndex
CREATE INDEX "support_session_userId_createdAt_idx" ON "support_session"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "support_session" ADD CONSTRAINT "support_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
