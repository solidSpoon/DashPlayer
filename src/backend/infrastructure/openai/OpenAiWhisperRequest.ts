import fs from 'fs';

import OpenAI from 'openai';

import { Cancelable } from '@/common/interfaces';
import { WaitRateLimit } from '@/common/utils/RateLimiter';
import { WhisperResponse, WhisperResponseVerifySchema } from '@/common/types/video-info';

import dpLog from '@/backend/infrastructure/logger';
import { WhisperResponseFormatError } from '@/backend/application/errors/errors';

class OpenAiWhisperRequest implements Cancelable {
    private readonly file: string;
    private abortController: AbortController | null = null;
    public readonly openAi: OpenAI;

    constructor(openAi: OpenAI, file: string) {
        this.file = file;
        this.openAi = openAi;
    }

    @WaitRateLimit('whisper')
    public async invoke(): Promise<WhisperResponse> {
        this.cancel();
        const transcription = await this.doTranscription();
        const parseRes = WhisperResponseVerifySchema.safeParse(transcription);
        if (!parseRes.success) {
            dpLog.error('Invalid response from OpenAI', parseRes.error.issues);
            throw new WhisperResponseFormatError();
        }
        return {
            language: transcription.language,
            duration: transcription.duration,
            text: transcription.text,
            segments: transcription.segments?.map((seg) => ({
                seek: seg.seek,
                start: seg.start,
                end: seg.end,
                text: seg.text,
            })) ?? [],
        };
    }

    private async doTranscription() {
        this.abortController = new AbortController();
        try {
            return await this.openAi.audio.transcriptions.create(
                {
                    file: fs.createReadStream(this.file),
                    model: 'whisper-1',
                    response_format: 'verbose_json',
                    timestamp_granularities: ['segment'],
                },
                { signal: this.abortController.signal },
            );
        } catch (error) {
            dpLog.error(error);
            throw error;
        }
    }

    public cancel(): void {
        if (this.abortController) {
            this.abortController.abort('Operation canceled by the user');
            this.abortController = null;
        }
    }
}

export default OpenAiWhisperRequest;
