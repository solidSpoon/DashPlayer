import DpTaskEventsPort from '@/fronted/application/ports/events/DpTaskEventsPort';
import { ElectronDpTaskEvents } from '@/fronted/infrastructure/electron/ElectronDpTaskEvents';

export const dpTaskEvents: DpTaskEventsPort = new ElectronDpTaskEvents();

