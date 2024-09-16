export interface TaskQueue<T> {
    enqueueAdd(taskId: string, task: T): void;
    enqueueCancel(taskId: string): void;
    consume(): AsyncIterable<{ taskId: string; operation: 'add' | 'cancel'; task?: T }>;
    info(taskId: string): { operation: 'add' | 'cancel'; task?: T } | undefined;
    unfinishedLength(): number;
}


export class SerialTaskQueue<T> implements TaskQueue<T> {
    private taskMap: Map<string, { operation: 'add' | 'cancel'; task?: T }> = new Map();
    private taskIds: Set<string> = new Set();
    private consumingTask: { taskId: string; operation: 'add' | 'cancel'; task?: T } | null = null;
    private consumers: Array<() => void> = [];

    enqueueAdd(taskId: string, task: T): void {
        this.taskMap.set(taskId, { operation: 'add', task });
        if (!this.taskIds.has(taskId)) {
            this.taskIds.add(taskId);
        }
        this.notifyConsumers();
    }

    enqueueCancel(taskId: string): void {
        this.taskMap.set(taskId, { operation: 'cancel' });
        if (!this.taskIds.has(taskId)) {
            this.taskIds.add(taskId);
        }
        this.notifyConsumers();
    }

    info(taskId: string): { operation: 'add' | 'cancel'; task?: T } | undefined {
        if (this.consumingTask && this.consumingTask.taskId === taskId) {
            return this.consumingTask;
        }
        return this.taskMap.get(taskId);
    }

    private notifyConsumers(): void {
        while (this.consumers.length > 0) {
            const consumer = this.consumers.shift();
            if (consumer) {
                consumer();
            }
        }
    }

    async *consume(): AsyncIterable<{ taskId: string; operation: 'add' | 'cancel'; task?: T }> {
        while (true) {
            if (this.taskIds.size > 0) {
                const taskId = this.taskIds.values().next().value;
                this.taskIds.delete(taskId);
                const task = this.taskMap.get(taskId);
                this.taskMap.delete(taskId);
                this.consumingTask = { taskId, ...task };
                if (task) {
                    yield { taskId, ...task };
                }
                this.consumingTask = null;
            } else {
                await new Promise<void>((resolve) => {
                    this.consumers.push(resolve);
                });
            }
        }
    }


    unfinishedLength(): number {
        if (this.consumingTask) {
            return this.taskIds.size + 1;
        }
        return this.taskIds.size;
    }
}
