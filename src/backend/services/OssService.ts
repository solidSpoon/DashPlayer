import { MetaData, OssObject } from '@/common/types/OssObject';


export interface ClipOssService extends OssService<MetaData> {

    putClip(key: string, sourcePath: string, metadata: MetaData): Promise<void>;

    updateTags(key: string, tags: string[]): Promise<void>;
}

export interface OssService<T> {
    putFile(key: string, fileName: string, sourcePath: string): Promise<void>;

    delete(key: string): Promise<void>;

    get(key: string): Promise<T & OssObject>

    updateMetadata(key: string, newMetadata: Partial<T>): Promise<void>;

    list(): Promise<string[]>;
}
