import { DpTask } from '@/common/contracts/dp-task';

/**
 * 渲染进程接收后台任务更新的事件端口。
 */
export default interface DpTaskEventsPort {
    onTaskUpdate(handler: (task: DpTask) => void): () => void;
}
