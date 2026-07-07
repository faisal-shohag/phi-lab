-- CreateTable
CREATE TABLE "english_session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "voice" TEXT NOT NULL DEFAULT 'Kore',
    "status" "InterviewStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "transcript" JSONB,
    "report" JSONB,
    "overallScore" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "english_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "english_session_userId_createdAt_idx" ON "english_session"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "english_session" ADD CONSTRAINT "english_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
