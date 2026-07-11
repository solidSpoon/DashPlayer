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

type VideoInfo = z.infer<typeof VideoInfoSchema>;

export {
    VideoInfoSchema,
    type VideoInfo,
};
