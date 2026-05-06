-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('open', 'claimed', 'in-progress', 'pending_verification', 'approved', 'rejected', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('pending', 'processing', 'paid', 'failed');

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "context" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'open',
    "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
    "rewardAmount" DOUBLE PRECISION,
    "rewardCurrency" TEXT,
    "postedBy" TEXT NOT NULL,
    "assignedTo" TEXT,
    "result" TEXT,
    "verificationNote" TEXT,
    "paidOut" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EarningEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskTitle" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidOut" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EarningEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PayoutStatus" NOT NULL DEFAULT 'pending',
    "stripePayoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EarningEntry" ADD CONSTRAINT "EarningEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
