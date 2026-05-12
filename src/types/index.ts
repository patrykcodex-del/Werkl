export type TaskStatus =
    | 'open'
    | 'offered'           // task is currently offered to one worker
    | 'claimed'
    | 'in-progress'
    | 'pending_verification'
    | 'approved'
    | 'rejected'
    | 'completed'
    | 'expired'
    | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TaskType = 'sync' | 'async';

export type ReleaseReason =
    | 'unclear_instructions'
    | 'too_difficult'
    | 'not_enough_time'
    | 'wrong_task_type'
    | 'other';

export const RELEASE_REASON_LABELS: Record<ReleaseReason, string> = {
    unclear_instructions: 'Instructions are unclear',
    too_difficult:        'Task is too difficult',
    not_enough_time:      'Not enough time to complete',
    wrong_task_type:      'Not the right task type for me',
    other:                'Other',
};

export interface TaskReward {
    amount: number;
    currency: string;
}

export interface Task {
    id: string;
    title: string;
    description: string;
    context?: string;
    status: TaskStatus;
    priority: TaskPriority;
    taskType: TaskType;
    reward?: TaskReward;

    // Time limits
    estimatedMins?: number;
    claimTimeoutMins: number;
    completionMins?: number;
    expiresAt?: string;

    // Lifecycle timestamps
    claimedAt?: string;
    claimExpiresAt?: string;
    completionDeadline?: string;
    releasedAt?: string;

    // Assignment
    postedBy: string;
    assignedTo?: string;
    autoReassign: boolean;
    reassignCount: number;
    releaseCount: number;

    result?: string;
    verificationNote?: string;
    paidOut?: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface User {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface EarningEntry {
    taskId: string;
    taskTitle: string;
    amount: number;
    currency: string;
    earnedAt: string;
    paidOut: boolean;
}

export interface UserEarnings {
    userId: string;
    balance: number;
    currency: string;
    entries: EarningEntry[];
}

export interface WorkerStat {
    userId: string;
    totalClaimed: number;
    totalCompleted: number;
    totalApproved: number;
    totalRejected: number;
    totalExpired: number;
    avgCompletionSecs?: number;
    releasedTaskCount: number;
    graceReleasedTaskCount: number;
    lateReleasedTaskCount: number;
    reliabilityScore: number;  // 0–1
    currentCooldownUntil?: string; // ISO date — worker blocked until this time
}

// ─── Session-based routing ────────────────────────────────────────────────────

export type SessionStatus = 'active' | 'paused' | 'ended';
export type OfferStatus = 'pending' | 'accepted' | 'skipped' | 'expired' | 'cancelled' | 'released';

export interface WorkerSession {
    id: string;
    workerId: string;
    status: SessionStatus;
    startedAt: string;
    endedAt?: string;
    lastHeartbeatAt: string;
    acceptedCount: number;
    skippedCount: number;
    expiredOfferCount: number;
}

export interface TaskOffer {
    id: string;
    taskId: string;
    workerId: string;
    sessionId: string;
    status: OfferStatus;
    offeredAt: string;
    expiresAt: string;
    respondedAt?: string;
    acceptedAt?: string;
    releasedAt?: string;
    releaseReason?: string;
    releasePenaltyApplied?: boolean;
    /** Populated when fetching the current offer */
    task?: Task;
}
