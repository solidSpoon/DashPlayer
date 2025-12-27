import { Cancelable } from '@/common/interfaces';
import { WhisperResponse } from '@/common/types/video-info';

export interface CancelableRequest<T> extends Cancelable {
    invoke(): Promise<T>;
}

export interface OpenAiWhisperGateway {
    createRequest(filePath: string): CancelableRequest<WhisperResponse>;
}

