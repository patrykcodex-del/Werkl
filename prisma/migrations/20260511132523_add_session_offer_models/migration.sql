-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('active', 'paused', 'ended');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('pending', 'accepted', 'skipped', 'expired', 'cancelled');

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'offered';

-- CreateTable
CREATE TABLE "WorkerSession" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "expiredOfferCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WorkerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskOffer" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'pending',
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "TaskOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkerSession_workerId_idx" ON "WorkerSession"("workerId");

-- CreateIndex
CREATE INDEX "WorkerSession_status_lastHeartbeatAt_idx" ON "WorkerSession"("status", "lastHeartbeatAt");

-- CreateIndex
CREATE INDEX "TaskOffer_workerId_status_idx" ON "TaskOffer"("workerId", "status");

-- CreateIndex
CREATE INDEX "TaskOffer_taskId_status_idx" ON "TaskOffer"("taskId", "status");

-- CreateIndex
CREATE INDEX "TaskOffer_status_expiresAt_idx" ON "TaskOffer"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "TaskOffer" ADD CONSTRAINT "TaskOffer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkerSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskOffer" ADD CONSTRAINT "TaskOffer_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
