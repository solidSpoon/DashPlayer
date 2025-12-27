import { RendererApiMap } from '@/common/api/renderer-api-def';

export default interface RendererApiRegistryPort {
    register<K extends keyof RendererApiMap>(path: K, handler: RendererApiMap[K]): () => void;
}

