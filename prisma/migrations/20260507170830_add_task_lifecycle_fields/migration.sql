-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('sync', 'async');

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'expired';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "autoReassign" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "claimExpiresAt" TIMESTAMP(3),
ADD COLUMN     "claimTimeoutMins" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "completionDeadline" TIMESTAMP(3),
ADD COLUMN     "completionMins" INTEGER,
ADD COLUMN     "estimatedMins" INTEGER,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "reassignCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taskType" "TaskType" NOT NULL DEFAULT 'async';

-- CreateTable
CREATE TABLE "WorkerStat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalClaimed" INTEGER NOT NULL DEFAULT 0,
    "totalCompleted" INTEGER NOT NULL DEFAULT 0,
    "totalApproved" INTEGER NOT NULL DEFAULT 0,
    "totalRejected" INTEGER NOT NULL DEFAULT 0,
    "totalExpired" INTEGER NOT NULL DEFAULT 0,
    "avgCompletionSecs" DOUBLE PRECISION,
    "reliabilityScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkerStat_userId_key" ON "WorkerStat"("userId");
