import { DpTask } from '@/backend/infrastructure/db/tables/dpTask';

export default interface DpTaskEventsPort {
    onTaskUpdate(handler: (task: DpTask) => void): () => void;
}

