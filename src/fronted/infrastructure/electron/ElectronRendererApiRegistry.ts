import { RendererApiMap } from '@/common/api/renderer-api-def';
import type RendererApiRegistryPort from '@/fronted/application/ports/renderer-api/RendererApiRegistryPort';

export class ElectronRendererApiRegistry implements RendererApiRegistryPort {
    register<K extends keyof RendererApiMap>(path: K, handler: RendererApiMap[K]): () => void {
        if (!window?.electron?.registerRendererApi) {
            throw new Error('window.electron.registerRendererApi is not available');
        }

        return window.electron.registerRendererApi(path, handler as any);
    }
}

