import { DpTask } from '@/backend/db/tables/dpTask';
import useDpTaskCenter from "@/fronted/hooks/useDpTaskCenter";

const useDpTaskViewer = (taskId: number) => {
    const task: DpTask | undefined = useDpTaskCenter((s) => s.tasks.get(taskId));
    return task;
};
export default useDpTaskViewer;
