-- AlterTable
ALTER TABLE "User" ADD COLUMN     "networkExempt" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AllowedNetwork" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cidr" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllowedNetwork_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AllowedNetwork_cidr_key" ON "AllowedNetwork"("cidr");
