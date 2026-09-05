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
import type LocalAiService from '@/backend/services/LocalAiService';
import { storeGet } from '@/backend/infrastructure/settings/store';

const OPENAI_SUBTITLE_REQUEST_TIMEOUT_MS = 40_000;

/**
 * 使用当前配置的 OpenAI 兼容模型执行字幕翻译。
 */
@injectable()
export default class OpenAiSubtitleTranslationGatewayImpl
implements OpenAiSubtitleTranslationGateway {
    /** 注入云端和本地推理入口，按当前引擎选择唯一调用路径。 */
    public constructor(
        @inject(TYPES.AiProviderService) private readonly aiProviderService: AiProviderService,
        @inject(TYPES.LocalAiService) private readonly localAi: LocalAiService,
    ) {}

    /**
     * 执行一次非流式结构化字幕翻译，并关闭 SDK 内部重试。
     *
     * @param request 提示词、字段说明与取消信号。
     * @returns 模型返回的结构化字幕条目。
     */
    public async translate(
        request: OpenAiSubtitleTranslationRequest
    ): Promise<OpenAiSubtitleTranslationResultItem[]> {
        const schema = z.object({
            items: z.array(z.object({
                key: z.string().describe('Original subtitle key.'),
                translation: z.string().describe(request.translationDescription),
            })),
        });

        if (storeGet('providers.subtitleTranslation') === 'local') {
            return schema.parse(await this.localAi.generate(request.prompt, z.toJSONSchema(schema), request.signal)).items;
        }
        const model = this.aiProviderService.getModel('subtitleTranslation');
        if (!model) {
            const error = new Error('OpenAI 字幕翻译模型未配置');
            error.name = 'OpenAiSubtitleModelUnavailableError';
            throw error;
        }

        const result = await concurrency.withRateLimit('gpt', () =>
            generateText({
                model,
                reasoning: 'low',
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
