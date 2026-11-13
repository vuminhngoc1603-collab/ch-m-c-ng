-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'FULLTIME', 'PARTTIME');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ShiftKind" AS ENUM ('FULLTIME', 'PARTTIME');

-- CreateEnum
CREATE TYPE "FeedStatus" AS ENUM ('PENDING', 'FED', 'MISSED', 'EXCUSED');

-- CreateEnum
CREATE TYPE "CloseStatus" AS ENUM ('NONE', 'PENDING', 'CLOSED', 'FORGOT', 'SKIPPED');

-- CreateEnum
CREATE TYPE "CoinType" AS ENUM ('FEED', 'STEAL_GAIN', 'STEAL_LOSS', 'ADJUST');

-- CreateEnum
CREATE TYPE "PointType" AS ENUM ('SETTLEMENT', 'EGG_PURCHASE', 'ADJUST');

-- CreateEnum
CREATE TYPE "Zodiac" AS ENUM ('TY', 'SUU', 'DAN', 'MAO', 'THIN', 'TI', 'NGO', 'MUI', 'THAN', 'DAU', 'TUAT', 'HOI');

-- CreateEnum
CREATE TYPE "PetSource" AS ENUM ('FREE', 'REGRANT', 'EGG');

-- CreateEnum
CREATE TYPE "PetStatus" AS ENUM ('ALIVE', 'DEAD');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('LEAVE', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "emailVerified" TIMESTAMP(3),
    "role" "Role",
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "missStreak" INTEGER NOT NULL DEFAULT 0,
    "regrantOn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ShiftKind" NOT NULL,
    "feedStart" INTEGER NOT NULL,
    "feedEnd" INTEGER NOT NULL,
    "closeStart" INTEGER,
    "closeEnd" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftRegistration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "day" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL DEFAULT 'LEAVE',
    "startDay" TEXT NOT NULL,
    "endDay" TEXT NOT NULL,
    "reason" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "feedStatus" "FeedStatus" NOT NULL DEFAULT 'PENDING',
    "feedAt" TIMESTAMP(3),
    "feedIp" TEXT,
    "feedUa" TEXT,
    "coinsEarned" INTEGER NOT NULL DEFAULT 0,
    "closeStatus" "CloseStatus" NOT NULL DEFAULT 'PENDING',
    "closeAt" TIMESTAMP(3),
    "closeIp" TEXT,
    "closeUa" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "CoinType" NOT NULL,
    "period" TEXT NOT NULL,
    "reason" TEXT,
    "refId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Theft" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "victimId" TEXT NOT NULL,
    "thiefId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Theft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "PointType" NOT NULL,
    "period" TEXT,
    "reason" TEXT,
    "refId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlySettlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "feedCoins" INTEGER NOT NULL,
    "stealGainCoins" INTEGER NOT NULL,
    "stealLossCoins" INTEGER NOT NULL,
    "adjustCoins" INTEGER NOT NULL,
    "netCoins" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "rewardVnd" INTEGER NOT NULL,
    "missedCount" INTEGER NOT NULL,
    "deathCount" INTEGER NOT NULL,
    "penaltyVnd" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlySettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "zodiac" "Zodiac" NOT NULL,
    "slot" INTEGER NOT NULL,
    "status" "PetStatus" NOT NULL DEFAULT 'ALIVE',
    "source" "PetSource" NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diedAt" TIMESTAMP(3),
    "deathReason" TEXT,

    CONSTRAINT "Pet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Penalty" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "petId" TEXT,
    "amountVnd" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Penalty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "meta" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_code_key" ON "Shift"("code");

-- CreateIndex
CREATE INDEX "ShiftRegistration_day_idx" ON "ShiftRegistration"("day");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftRegistration_userId_day_shiftId_key" ON "ShiftRegistration"("userId", "day", "shiftId");

-- CreateIndex
CREATE INDEX "LeaveRequest_userId_startDay_idx" ON "LeaveRequest"("userId", "startDay");

-- CreateIndex
CREATE INDEX "Attendance_day_closeStatus_idx" ON "Attendance"("day", "closeStatus");

-- CreateIndex
CREATE INDEX "Attendance_feedStatus_idx" ON "Attendance"("feedStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_userId_day_shiftId_key" ON "Attendance"("userId", "day", "shiftId");

-- CreateIndex
CREATE INDEX "CoinLedger_userId_period_idx" ON "CoinLedger"("userId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Theft_attendanceId_thiefId_key" ON "Theft"("attendanceId", "thiefId");

-- CreateIndex
CREATE INDEX "PointLedger_userId_idx" ON "PointLedger"("userId");

-- CreateIndex
CREATE INDEX "MonthlySettlement_period_idx" ON "MonthlySettlement"("period");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlySettlement_userId_period_key" ON "MonthlySettlement"("userId", "period");

-- CreateIndex
CREATE INDEX "Pet_userId_status_idx" ON "Pet"("userId", "status");

-- CreateIndex
CREATE INDEX "Penalty_userId_period_idx" ON "Penalty"("userId", "period");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_action_idx" ON "ActivityLog"("action");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftRegistration" ADD CONSTRAINT "ShiftRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftRegistration" ADD CONSTRAINT "ShiftRegistration_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinLedger" ADD CONSTRAINT "CoinLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Theft" ADD CONSTRAINT "Theft_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Theft" ADD CONSTRAINT "Theft_victimId_fkey" FOREIGN KEY ("victimId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Theft" ADD CONSTRAINT "Theft_thiefId_fkey" FOREIGN KEY ("thiefId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointLedger" ADD CONSTRAINT "PointLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlySettlement" ADD CONSTRAINT "MonthlySettlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Penalty" ADD CONSTRAINT "Penalty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
