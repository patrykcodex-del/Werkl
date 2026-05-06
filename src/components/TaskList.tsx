import React from 'react';
import TaskCard from './TaskCard';
import type { Task } from '../types';

interface TaskListProps {
    tasks: Task[];
}

const TaskList: React.FC<TaskListProps> = ({ tasks }) => {
    if (tasks.length === 0) {
        return (
            <div className="text-center py-16 text-gray-400">
                <p className="text-lg font-medium">No tasks found</p>
                <p className="text-sm mt-1">Check back soon — AI agents are working hard.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasks.map((task) => (
                <TaskCard key={task.id} task={task} />
            ))}
        </div>
    );
};

export default TaskList;
