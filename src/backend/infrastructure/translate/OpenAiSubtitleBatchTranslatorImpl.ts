import { generateText, Output } from 'ai';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import AiProviderService from '@/backend/services/AiProviderService';
import OpenAiSubtitleBatchTranslator from '@/backend/services/gateways/translate/OpenAiSubtitleBatchTranslator';
import {
    SubtitleBatchTranslationInput,
    SubtitleTranslationResultItem,
} from '@/backend/services/gateways/translate/SubtitleBatchTranslationInput';
import { concurrency } from '@/backend/utils/concurrency';
import {
    buildSubtitleBatchPrompt,
    createSubtitleBatchResultSchema,
} from '@/backend/infrastructure/translate/subtitleBatchPrompt';

const OPENAI_SUBTITLE_REQUEST_TIMEOUT_MS = 40_000;

/**
 * 云端字幕批量翻译网关：自持提示词拼装与 OpenAI 兼容结构化输出。
 *
 * 模型解析、限流、超时与取消都属于云端链路细节；业务层只提供语义输入。
 */
@injectable()
export default class OpenAiSubtitleBatchTranslatorImpl
implements OpenAiSubtitleBatchTranslator {
    /** 注入云端模型解析服务。 */
    public constructor(
        @inject(TYPES.AiProviderService) private readonly aiProviderService: AiProviderService,
    ) {}

    /**
     * 执行一次非流式结构化批量翻译，并关闭 SDK 内部重试。
     *
     * @param input 当前组、组前后句、模式、风格与取消信号。
     * @returns 模型返回的结构化字幕条目。
     */
    public async translate(
        input: SubtitleBatchTranslationInput
    ): Promise<SubtitleTranslationResultItem[]> {
        const model = this.aiProviderService.getModel('subtitleTranslation');
        if (!model) {
            const error = new Error('OpenAI 字幕翻译模型未配置');
            error.name = 'OpenAiSubtitleModelUnavailableError';
            throw error;
        }
        const schema = createSubtitleBatchResultSchema(input.mode);
        const prompt = buildSubtitleBatchPrompt(input, input.style);

        const result = await concurrency.withRateLimit('gpt', () =>
            generateText({
                model,
                reasoning: 'low',
                output: Output.object({ schema }),
                prompt,
                maxRetries: 0,
                timeout: OPENAI_SUBTITLE_REQUEST_TIMEOUT_MS,
                abortSignal: input.signal,
            }), {
            signal: input.signal,
        });

        return result.output.items;
    }
}
