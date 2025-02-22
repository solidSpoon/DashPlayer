import { z } from 'zod';

// VideoInfo schema
const VideoInfoSchema = z.object({
    filename: z.string(),
    duration: z.number(),
    size: z.number(),
    modifiedTime: z.number(),
    createdTime: z.number(),
    bitrate: z.number().optional(),
    videoCodec: z.string().optional(),
    audioCodec: z.string().optional(),
});

// WhisperResponse schema
const WhisperResponseVerifySchema = z.object({
    language: z.string(),
    duration: z.union([z.number(), z.string()]),
    text: z.string(),
    segments: z.array(z.object({
        seek: z.number(),
        start: z.number(),
        end: z.number(),
        text: z.string()
    }))
});

// SplitChunk schema
const SplitChunkSchema = z.object({
    offset: z.number(),
    filePath: z.string(),
    response: WhisperResponseVerifySchema.optional(),
});

// WhisperContext schema
const WhisperContextSchema = z.object({
    filePath: z.string(),
    folder: z.string(),
    state: z.enum(['init', 'processed', 'done']),
    videoInfo: VideoInfoSchema.nullable(),
    chunks: z.array(SplitChunkSchema),
    updatedTime: z.number(),
});

// 类型推断
type WhisperContext = z.infer<typeof WhisperContextSchema>;
type VideoInfo = z.infer<typeof VideoInfoSchema>;
type SplitChunk = z.infer<typeof SplitChunkSchema>;
type WhisperResponse = z.infer<typeof WhisperResponseVerifySchema>;

export {
    VideoInfoSchema,
    SplitChunkSchema,
    WhisperContextSchema,
    WhisperResponseVerifySchema,
    type WhisperContext,
    type VideoInfo,
    type SplitChunk,
    type WhisperResponse
};
