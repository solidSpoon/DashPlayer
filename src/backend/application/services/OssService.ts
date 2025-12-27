import { ClipMeta, OssBaseMeta } from '@/common/types/clipMeta';


export interface ClipOssService extends OssService<ClipMeta> {

    putClip(key: string, sourcePath: string, metadata: ClipMeta): Promise<void>;

    updateTags(key: string, tags: string[]): Promise<void>;
}

export interface OssService<T> {
    putFile(key: string, fileName: string, sourcePath: string): Promise<void>;

    delete(key: string): Promise<void>;

    get(key: string): Promise<T & OssBaseMeta | null>

    updateMetadata(key: string, newMetadata: Partial<T>): Promise<void>;

    list(): Promise<string[]>;
}
