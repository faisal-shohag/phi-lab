-- CreateTable: every scored Pixel Lab attempt, with the code that produced it.
--
-- Purely additive: creates one new table and touches nothing that already
-- exists, so it cannot affect XP, unlocks or any other lab. Progress stays
-- derived from "xp_event"; this is the attempt log, not the receipt, and can be
-- pruned without anyone losing anything.
CREATE TABLE "pixel_submission" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "html"        TEXT NOT NULL,
  "css"         TEXT NOT NULL,
  "score"       DOUBLE PRECISION NOT NULL,
  "match"       DOUBLE PRECISION NOT NULL,
  "diffPixels"  INTEGER NOT NULL,
  "unionPixels" INTEGER NOT NULL,
  "tiers"       TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pixel_submission_pkey" PRIMARY KEY ("id")
);

-- The only query this table serves: one learner's attempts at one challenge,
-- newest first.
CREATE INDEX "pixel_submission_userId_challengeId_createdAt_idx"
  ON "pixel_submission" ("userId", "challengeId", "createdAt");

-- Cascade so deleting a user takes their attempts with them, matching every
-- other user-owned table here (xp_event, user_badge).
ALTER TABLE "pixel_submission"
  ADD CONSTRAINT "pixel_submission_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
