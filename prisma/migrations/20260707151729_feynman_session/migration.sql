-- CreateTable
CREATE TABLE "feynman_session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "voice" TEXT NOT NULL DEFAULT 'Kore',
    "status" "InterviewStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "transcript" JSONB,
    "report" JSONB,
    "clarityScore" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feynman_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feynman_session_userId_createdAt_idx" ON "feynman_session"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "feynman_session" ADD CONSTRAINT "feynman_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
