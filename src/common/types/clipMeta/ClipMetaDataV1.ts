import { z } from 'zod';


export const ClipSrtLineSchema = z.object({
    index: z.number(),
    start: z.number(),
    end: z.number(),
    contentEn: z.string(),
    contentZh: z.string(),
    isClip: z.boolean()
});

// Version 1 特定的 Schema
export const MetaDataSchemaV1 = z.object({
    video_name: z.string().describe('视频名'),
    created_at: z.number().describe('创建时间'),
    clip_content: z.array(ClipSrtLineSchema),
    clip_file: z.string(),
    thumbnail_file: z.string(),
    tags: z.array(z.string())
});

// ClipMeta Schema (不需要额外的合并，因为 MetaDataSchemaV1 已经包含了所有必要的字段)
type ClipMetaV1 = z.infer<typeof MetaDataSchemaV1>;
type ClipSrtLineV1 = z.infer<typeof ClipSrtLineSchema>;

// 导出 schema
export {
    ClipMetaV1,
    ClipSrtLineV1
};
