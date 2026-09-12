import { inject, injectable } from 'inversify';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getMainLogger } from '@/backend/infrastructure/logger';
import TYPES from '@/backend/ioc/types';
import AiProviderService, { CLOUD_AI_NOT_CONFIGURED_MESSAGE } from '@/backend/services/AiProviderService';
import {
    CompleteSentenceParams,
    CompleteSentenceResult,
} from '@/common/types/chat';
import { WithRateLimit } from '@/backend/utils/concurrency/decorators';
import { buildCompleteSentencePrompt } from '@/backend/services/chat/ChatPromptBuilder';

/**
 * 完整句补全的结构化输出契约。
 */
const CompleteSentenceSchema = z.object({
    /** 给定字幕行本身是否已是一个完整句子。 */
    complete: z.boolean(),
    /** 完整句子原文；当前行已完整时与原行保持一致。 */
    sentence: z.string().min(1),
    /** 完整句的中文译文。 */
    translation: z.string().min(1),
});

export default interface SentenceLearningService {
    /**
     * 判断当前字幕行是否被换行截断，并尽力补全为完整句子。
     *
     * 说明：仅云端整句学习启用时可用（getModel 内部校验开关），
     * 补全结果作为学习会话的主题原文，让解析与对话都围绕完整句进行。
     */
    completeSentence(params: CompleteSentenceParams): Promise<CompleteSentenceResult>;
    /**
     * 整句讲解当前是否可用：功能已启用且云端模型已配好。
     *
     * 说明：供学习页决定解析与对话入口是否置灰，避免用户点下去才发现用不了。
     */
    isLearningAvailable(): boolean;
}

/**
 * 整句学习中不依赖会话的单次模型调用：字幕完整句补全与可用性探测。
 */
@injectable()
export class SentenceLearningServiceImpl implements SentenceLearningService {
    private logger = getMainLogger('SentenceLearningService');

    @inject(TYPES.AiProviderService)
    private aiProviderService!: AiProviderService;

    @WithRateLimit('gpt')
    public async completeSentence(params: CompleteSentenceParams): Promise<CompleteSentenceResult> {
        const model = this.aiProviderService.getModel('sentenceLearning');
        if (!model) {
            throw new Error(CLOUD_AI_NOT_CONFIGURED_MESSAGE);
        }
        const startedAt = Date.now();
        this.logger.info('complete sentence start', {
            textLength: params.text.length,
            precedingCount: params.precedingLines.length,
            followingCount: params.followingLines.length,
        });
        try {
            const result = await generateObject({
                model,
                schema: CompleteSentenceSchema,
                prompt: buildCompleteSentencePrompt(params),
            });
            this.logger.info('complete sentence done', {
                durationMs: Date.now() - startedAt,
                complete: result.object.complete,
                sentenceLength: result.object.sentence.length,
            });
            return result.object;
        } catch (error) {
            // 结构化输出解析/校验失败时，NoObjectGeneratedError 携带模型原始返回文本，
            // 记进日志才能区分是模型输出格式问题还是接口问题。
            const noObjectError = error as { name?: string; message?: string; text?: unknown };
            this.logger.error('complete sentence failed', {
                durationMs: Date.now() - startedAt,
                errorName: noObjectError?.name,
                errorMessage: noObjectError?.message,
                rawText: typeof noObjectError?.text === 'string' ? noObjectError.text.slice(0, 500) : undefined,
            });
            throw error;
        }
    }

    /**
     * 判定直接复用 getModel，界面上的「可用」因此不会与真实调用结果漂移；
     * getModel 在功能未启用或模型配置失效时抛错，对界面而言这些都等价于「暂不可用」，
     * 故折成 false——真正发起调用时仍走 getModel，具体原因照旧抛出。
     */
    public isLearningAvailable(): boolean {
        try {
            return this.aiProviderService.getModel('sentenceLearning') !== null;
        } catch {
            return false;
        }
    }
}
