-- AlterTable: optional career/profile fields on User
ALTER TABLE "user"
  ADD COLUMN "headline" TEXT,
  ADD COLUMN "bio" TEXT,
  ADD COLUMN "goal" TEXT,
  ADD COLUMN "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "location" TEXT,
  ADD COLUMN "resumeUrl" TEXT,
  ADD COLUMN "githubUrl" TEXT,
  ADD COLUMN "linkedinUrl" TEXT,
  ADD COLUMN "websiteUrl" TEXT,
  ADD COLUMN "profilePublic" BOOLEAN NOT NULL DEFAULT false;
