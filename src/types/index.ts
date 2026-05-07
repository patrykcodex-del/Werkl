export type TaskStatus =
    | 'open'
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
    estimatedMins?: number;         // expected work duration
    claimTimeoutMins: number;       // minutes before unclaimed task returns to pool (default 5)
    completionMins?: number;        // hard completion deadline after claiming
    expiresAt?: string;             // ISO — hard expiry while open

    // Lifecycle timestamps
    claimedAt?: string;
    claimExpiresAt?: string;        // claimedAt + claimTimeoutMins
    completionDeadline?: string;    // claimedAt + completionMins

    // Assignment
    postedBy: string;
    assignedTo?: string;
    autoReassign: boolean;
    reassignCount: number;

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
    reliabilityScore: number;  // 0–1
}
