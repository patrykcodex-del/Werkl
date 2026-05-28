/*
  Warnings:

  - The values [completed] on the enum `TaskStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
DO $$ BEGIN
  -- Only alter if 'completed' value still exists on the type
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'TaskStatus' AND e.enumlabel = 'completed') THEN
    -- Update any rows that still use 'completed' → 'approved' before dropping the value
    UPDATE "Task" SET "status" = 'approved'::"TaskStatus" WHERE "status" = 'completed'::"TaskStatus";
    CREATE TYPE "TaskStatus_new" AS ENUM ('open', 'offered', 'claimed', 'in-progress', 'pending_verification', 'approved', 'rejected', 'expired', 'cancelled');
    ALTER TABLE "public"."Task" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "Task" ALTER COLUMN "status" TYPE "TaskStatus_new" USING ("status"::text::"TaskStatus_new");
    ALTER TYPE "TaskStatus" RENAME TO "TaskStatus_old";
    ALTER TYPE "TaskStatus_new" RENAME TO "TaskStatus";
    DROP TYPE "public"."TaskStatus_old";
    ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'open';
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Agent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "callbackUrl" TEXT,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "tasksPostedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TaskWorkerBlock" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskWorkerBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Agent_apiKeyHash_key" ON "Agent"("apiKeyHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaskWorkerBlock_taskId_idx" ON "TaskWorkerBlock"("taskId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaskWorkerBlock_workerId_idx" ON "TaskWorkerBlock"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TaskWorkerBlock_taskId_workerId_key" ON "TaskWorkerBlock"("taskId", "workerId");

-- Data migration: backfill Agent rows for any existing Task.postedBy values
-- so the FK constraint below does not fail on existing data.
INSERT INTO "Agent" ("id", "name", "apiKeyHash", "updatedAt")
SELECT DISTINCT
    "postedBy",
    "postedBy",
    'backfill-' || "postedBy",
    NOW()
FROM "Task"
WHERE "postedBy" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Task_postedBy_fkey'
  ) THEN
    ALTER TABLE "Task" ADD CONSTRAINT "Task_postedBy_fkey" FOREIGN KEY ("postedBy") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TaskWorkerBlock_taskId_fkey'
  ) THEN
    ALTER TABLE "TaskWorkerBlock" ADD CONSTRAINT "TaskWorkerBlock_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
