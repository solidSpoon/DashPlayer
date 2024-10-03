import { z } from 'zod';
// 定义版本枚举
export const ClipVersionEnum = z.enum(['1']);
// 基础 OssObject Schema
export const OssObjectSchema = z.object({
    key: z.string(),
    baseDir: z.string(),
    version: ClipVersionEnum
});

export type OssObjectType = z.infer<typeof OssObjectSchema>;
