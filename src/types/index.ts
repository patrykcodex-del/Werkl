export type TaskStatus =
    | 'open'
    | 'claimed'
    | 'in-progress'
    | 'pending_verification'
    | 'approved'
    | 'rejected'
    | 'completed'
    | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

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
    reward?: TaskReward;
    postedBy: string;
    assignedTo?: string;
    result?: string;
    verificationNote?: string; // agent feedback on approval/rejection
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
