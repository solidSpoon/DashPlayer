import fs from 'fs';

import OpenAI from 'openai';

import { Cancelable } from '@/common/interfaces';
import { WithRateLimit } from '@/backend/application/kernel/concurrency/decorators';
import { WhisperResponse, WhisperResponseVerifySchema } from '@/common/types/video-info';

import { getMainLogger } from '@/backend/infrastructure/logger';
import { WhisperResponseFormatError } from '@/backend/application/errors/errors';

class OpenAiWhisperRequest implements Cancelable {
    private readonly logger = getMainLogger('OpenAiWhisperRequest');
    private readonly file: string;
    private abortController: AbortController | null = null;
    public readonly openAi: OpenAI;

    constructor(openAi: OpenAI, file: string) {
        this.file = file;
        this.openAi = openAi;
    }

    @WithRateLimit('whisper')
    public async invoke(): Promise<WhisperResponse> {
        this.cancel();
        const transcription = await this.doTranscription();
        const parseRes = WhisperResponseVerifySchema.safeParse(transcription);
        if (!parseRes.success) {
            this.logger.error('Invalid response from OpenAI', parseRes.error.issues);
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
            this.logger.error('openai whisper request failed', { error });
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
