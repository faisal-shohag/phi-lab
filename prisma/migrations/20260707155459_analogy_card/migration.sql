-- CreateTable
CREATE TABLE "analogy_card" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "title" TEXT NOT NULL,
    "scene" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "soBasically" TEXT NOT NULL,
    "techNote" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🛺',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analogy_card_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analogy_card_userId_createdAt_idx" ON "analogy_card"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "analogy_card" ADD CONSTRAINT "analogy_card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
