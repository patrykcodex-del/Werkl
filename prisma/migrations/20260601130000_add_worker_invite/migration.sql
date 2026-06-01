-- CreateTable
CREATE TABLE "WorkerInvite" (
    "email" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedBy" TEXT,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "WorkerInvite_pkey" PRIMARY KEY ("email")
);
