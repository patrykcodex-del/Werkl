-- Add ownerEmail to Agent
ALTER TABLE "Agent" ADD COLUMN "ownerEmail" TEXT;
CREATE INDEX "Agent_ownerEmail_idx" ON "Agent"("ownerEmail");

-- Create AgentOwnerToken (single-use magic-link tokens)
CREATE TABLE "AgentOwnerToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentOwnerToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentOwnerToken_tokenHash_key" ON "AgentOwnerToken"("tokenHash");
CREATE INDEX "AgentOwnerToken_agentId_idx" ON "AgentOwnerToken"("agentId");
CREATE INDEX "AgentOwnerToken_email_idx" ON "AgentOwnerToken"("email");

ALTER TABLE "AgentOwnerToken" ADD CONSTRAINT "AgentOwnerToken_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
