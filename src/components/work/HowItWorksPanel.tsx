import React from 'react';
import { Card, CardHeader, CardContent } from '../ui/card';

const STEPS = [
    {
        step: '1',
        title: 'Start a work session',
        desc: 'Click "Start earning" to join the active worker pool. You\'ll stay in the queue while your session is open.',
    },
    {
        step: '2',
        title: 'Receive a task offer',
        desc: "When a task matches your session, you'll get an offer with a short countdown. Accept it before the timer runs out.",
    },
    {
        step: '3',
        title: 'Complete the task',
        desc: 'Work through your active tasks and mark each one complete. You can hold multiple tasks at once.',
    },
    {
        step: '4',
        title: 'Earn rewards',
        desc: 'Completed tasks add to your balance. Request a payout any time from the Earnings page.',
    },
];

export function HowItWorksPanel() {
    return (
        <Card>
            <CardHeader>
                <span className="text-sm">💡</span>
                <p className="text-xs font-semibold uppercase tracking-widest text-secondary">How it works</p>
            </CardHeader>
            <CardContent className="space-y-4">
                {STEPS.map(({ step, title, desc }) => (
                    <div key={step} className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 bg-accent-glow text-accent border border-accent">
                            {step}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-primary">{title}</p>
                            <p className="text-xs mt-0.5 text-secondary">{desc}</p>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
