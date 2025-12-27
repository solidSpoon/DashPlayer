import { DpTask } from '@/backend/infrastructure/db/tables/dpTask';
import DpTaskEventsPort from '@/fronted/application/ports/events/DpTaskEventsPort';

export class ElectronDpTaskEvents implements DpTaskEventsPort {
    onTaskUpdate(handler: (task: DpTask) => void): () => void {
        return window.electron.onTaskUpdate(handler);
    }
}

