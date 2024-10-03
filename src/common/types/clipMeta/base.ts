import { z } from 'zod';

// 基础 OssObject Schema
export const OssBaseSchema = z.object({
    key: z.string(),
    baseDir: z.string(),
    version: z.number()
});

export type OssObjectType = z.infer<typeof OssBaseSchema>;
