import BackendClientPort from '@/fronted/application/ports/backend/BackendClientPort';
import { ElectronBackendClient } from '@/fronted/infrastructure/electron/ElectronBackendClient';

export const backendClient: BackendClientPort = new ElectronBackendClient();

