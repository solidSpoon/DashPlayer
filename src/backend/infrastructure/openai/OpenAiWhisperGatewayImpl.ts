import { inject, injectable } from 'inversify';

import TYPES from '@/backend/ioc/types';
import { OpenAiService } from '@/backend/application/services/OpenAiService';
import { CancelableRequest, OpenAiWhisper } from '@/backend/application/ports/gateways/OpenAiWhisper';
import { WhisperResponse } from '@/common/types/video-info';
import OpenAiWhisperRequest from '@/backend/infrastructure/openai/OpenAiWhisperRequest';

@injectable()
export default class OpenAiWhisperGatewayImpl implements OpenAiWhisper {
    @inject(TYPES.OpenAiService)
    private openAiService!: OpenAiService;

    public createRequest(filePath: string): CancelableRequest<WhisperResponse> {
        const openAi = this.openAiService.getOpenAi();
        return new OpenAiWhisperRequest(openAi, filePath);
    }
}
