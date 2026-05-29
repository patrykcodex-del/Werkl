import { z } from 'zod';

export const taskStatusSchema = z.enum([
    'open',
    'offered',
    'claimed',
    'in-progress',
    'pending_verification',
    'approved',
    'rejected',
    'expired',
    'cancelled',
]);

export type McpTaskStatus = z.infer<typeof taskStatusSchema>;
