import { ClipMeta, OssBaseMeta } from '@/common/types/clipMeta';

/**
 * 批量读取片段元数据的结果。
 */
export interface OssCollection<T> {
    /** 读取成功的片段元数据。 */
    clips: (OssBaseMeta & T)[];
    /** 元数据损坏、无法读取的片段 key。 */
    failedKeys: string[];
}

export interface ClipOssService extends OssService<ClipMeta> {

    putClip(key: string, sourcePath: string, metadata: ClipMeta): Promise<void>;

    updateTags(key: string, tags: string[]): Promise<void>;
}

export interface OssService<T> {
    putFile(key: string, fileName: string, sourcePath: string): Promise<void>;

    delete(key: string): Promise<void>;

    get(key: string): Promise<T & OssBaseMeta | null>

    /**
     * 批量读取片段元数据，逐条隔离读取失败。
     *
     * 行为说明：
     * - 片段不存在的 key 静默跳过，与 `get` 返回 `null` 语义一致；
     * - 元数据损坏等读取失败只影响当条，不会拖垮整批；
     * - 调用方可根据 `failedKeys` 向用户汇总提示。
     *
     * @param keys 片段 key 列表。
     * @returns 读取成功的元数据与失败的 key。
     */
    getAll(keys: string[]): Promise<OssCollection<T>>;

    updateMetadata(key: string, newMetadata: Partial<T>): Promise<void>;

    list(): Promise<string[]>;
}
