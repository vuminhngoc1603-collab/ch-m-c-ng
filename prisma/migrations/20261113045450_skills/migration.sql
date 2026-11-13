-- AlterEnum
ALTER TYPE "CoinType" ADD VALUE 'SKILL';

-- AlterTable
ALTER TABLE "MonthlySettlement" ADD COLUMN     "skillCoins" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "networkExemptUntil" TEXT;

-- CreateTable
CREATE TABLE "SkillUse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "zodiac" "Zodiac" NOT NULL,
    "refKey" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillUse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SkillUse_zodiac_period_idx" ON "SkillUse"("zodiac", "period");

-- CreateIndex
CREATE UNIQUE INDEX "SkillUse_userId_zodiac_refKey_key" ON "SkillUse"("userId", "zodiac", "refKey");

-- AddForeignKey
ALTER TABLE "SkillUse" ADD CONSTRAINT "SkillUse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
