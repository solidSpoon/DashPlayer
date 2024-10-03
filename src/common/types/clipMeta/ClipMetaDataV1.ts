import { z } from 'zod';
import { OssObjectSchema } from '@/common/types/clipMeta/base';


const ClipSrtLineSchema = z.object({
    index: z.number(),
    start: z.number(),
    end: z.number(),
    contentEn: z.string(),
    contentZh: z.string(),
    isClip: z.boolean()
});

// Version 1 特定的 Schema
const MetaDataSchemaV1 = z.object({
    video_name: z.string().describe('视频名'),
    created_at: z.date().describe('创建时间'),
    clip_content: z.array(ClipSrtLineSchema),
    clip_file: z.string(),
    thumbnail_file: z.string(),
    tags: z.array(z.string())
});

// ClipMeta Schema (不需要额外的合并，因为 MetaDataSchemaV1 已经包含了所有必要的字段)
type ClipMetaInsertV1 = z.infer<typeof MetaDataSchemaV1>;
type ClipMetaV1 = z.infer<typeof MetaDataSchemaV1> & z.infer<typeof OssObjectSchema>;

// 导出 schema
export {
    ClipMetaV1,
    ClipMetaInsertV1
};
