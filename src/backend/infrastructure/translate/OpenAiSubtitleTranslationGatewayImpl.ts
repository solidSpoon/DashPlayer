import { generateText, Output } from 'ai';
import { inject, injectable } from 'inversify';
import { z } from 'zod';
import TYPES from '@/backend/ioc/types';
import AiProviderService from '@/backend/services/AiProviderService';
import OpenAiSubtitleTranslationGateway, {
    OpenAiSubtitleTranslationRequest,
    OpenAiSubtitleTranslationResultItem,
} from '@/backend/services/gateways/translate/OpenAiSubtitleTranslationGateway';
import { concurrency } from '@/backend/utils/concurrency';

const OPENAI_SUBTITLE_REQUEST_TIMEOUT_MS = 15_000;

/**
 * 使用当前配置的 OpenAI 兼容模型执行字幕翻译。
 */
@injectable()
export default class OpenAiSubtitleTranslationGatewayImpl
implements OpenAiSubtitleTranslationGateway {
    @inject(TYPES.AiProviderService)
    private aiProviderService!: AiProviderService;

    /**
     * 执行一次非流式结构化字幕翻译，并关闭 SDK 内部重试。
     *
     * @param request 提示词、字段说明与取消信号。
     * @returns 模型返回的结构化字幕条目。
     */
    public async translate(
        request: OpenAiSubtitleTranslationRequest
    ): Promise<OpenAiSubtitleTranslationResultItem[]> {
        const model = this.aiProviderService.getModel('subtitleTranslation');
        if (!model) {
            const error = new Error('OpenAI 字幕翻译模型未配置');
            error.name = 'OpenAiSubtitleModelUnavailableError';
            throw error;
        }

        const schema = z.object({
            items: z.array(z.object({
                key: z.string().describe('Original subtitle key.'),
                translation: z.string().describe(request.translationDescription),
            })),
        });

        const result = await concurrency.withRateLimit('gpt', () =>
            generateText({
                model,
                output: Output.object({ schema }),
                prompt: request.prompt,
                maxRetries: 0,
                timeout: OPENAI_SUBTITLE_REQUEST_TIMEOUT_MS,
                abortSignal: request.signal,
            }), {
            signal: request.signal,
        });

        return result.output.items;
    }
}
