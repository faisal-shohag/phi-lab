-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "interview_session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "voice" TEXT NOT NULL DEFAULT 'Kore',
    "includeIntro" BOOLEAN NOT NULL DEFAULT false,
    "status" "InterviewStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "transcript" JSONB,
    "report" JSONB,
    "overallScore" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interview_session_userId_createdAt_idx" ON "interview_session"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "interview_session_userId_topic_idx" ON "interview_session"("userId", "topic");

-- AddForeignKey
ALTER TABLE "interview_session" ADD CONSTRAINT "interview_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
