-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "releaseCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "releasedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TaskOffer" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "releasePenaltyApplied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "releaseReason" TEXT,
ADD COLUMN     "releasedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WorkerStat" ADD COLUMN     "currentCooldownUntil" TIMESTAMP(3),
ADD COLUMN     "graceReleasedTaskCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lateReleasedTaskCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "releasedTaskCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "TaskReleaseEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "withinGrace" BOOLEAN NOT NULL,
    "reason" TEXT,
    "penaltyApplied" BOOLEAN NOT NULL,
    "reliabilityBefore" DOUBLE PRECISION NOT NULL,
    "reliabilityAfter" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskReleaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskReleaseEvent_workerId_idx" ON "TaskReleaseEvent"("workerId");

-- CreateIndex
CREATE INDEX "TaskReleaseEvent_taskId_idx" ON "TaskReleaseEvent"("taskId");

-- CreateIndex
CREATE INDEX "TaskReleaseEvent_workerId_createdAt_idx" ON "TaskReleaseEvent"("workerId", "createdAt");

-- AddForeignKey
ALTER TABLE "TaskReleaseEvent" ADD CONSTRAINT "TaskReleaseEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
