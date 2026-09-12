import { storeGet } from '@/backend/infrastructure/settings/store';
import { AI_API_FORMATS, AiApiFormat } from '@/common/utils/openai-endpoint';
import StrUtil from '@/common/utils/str-util';
import { inject, injectable } from 'inversify';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { LanguageModel } from 'ai';
import ModelRoutingService from '@/backend/services/ModelRoutingService';
import TYPES from '@/backend/ioc/types';

export type AiModelScene = 'sentenceLearning' | 'subtitleTranslation' | 'dictionary';

export default interface AiProviderService {
    getModel(scene: AiModelScene): LanguageModel | null;
    /**
     * 按模型 ID 创建语言模型实例（不校验功能开关，供连接测试等跨场景用途）。
     *
     * 按用户配置的 API 格式（openai/anthropic/gemini）创建对应 provider，
     * 三种格式都走各自 SDK 的通用文本生成路径，结构化输出统一由 AI SDK
     * 在客户端按 schema 校验。
     */
    createModelById(modelId: string): LanguageModel;
}


@injectable()
export class AiProviderServiceImpl implements AiProviderService {
    @inject(TYPES.ModelRoutingService)
    private modelRoutingService!: ModelRoutingService;

    /**
     * 获取指定场景当前配置的模型，并校验整句学习功能是否启用。
     * @param scene AI 使用场景。
     * @returns 可调用的语言模型；仅凭据不完整时返回 null，配置异常直接抛错。
     */
    public getModel(scene: AiModelScene): LanguageModel | null {
        const apiKey = storeGet('apiKeys.openAi.key');
        const endpoint = storeGet('apiKeys.openAi.endpoint');
        if (scene === 'sentenceLearning' && storeGet('features.openai.enableSentenceLearning') !== 'true') {
            throw new Error('整句学习功能未启用，请先在功能设置中启用');
        }
        const routedModel = this.modelRoutingService.resolveOpenAiModel(scene);
        if (StrUtil.hasBlank(apiKey, endpoint)) {
            return null;
        }
        if (!routedModel || StrUtil.isBlank(routedModel.modelId)) {
            return null;
        }
        return this.createModelById(routedModel.modelId);
    }

    /**
     * 按模型 ID 与 API 格式创建语言模型实例。
     *
     * 三种格式说明：
     * - openai：使用 OpenAI 兼容 provider（@ai-sdk/openai-compatible）而非官方
     *   OpenAI provider：兼容 provider 只走 /chat/completions 协议，没有 Responses
     *   API 路径。uniapi 等三方兼容端点的 /responses 流式实现不完整
     *   （deepseek-v4-flash 的 text-delta 缺少 text-start，SDK 会丢弃全部文本
     *   导致结构化输出为空），官方 provider 的默认模型方法恰恰走 Responses；
     *   三方模型场景下兼容 provider 更稳妥。不开启 supportsStructuredOutputs：
     *   让 Output.object 走通用的 response_format json_object，兼容面最广
     *   （几乎所有 OpenAI 兼容端点都支持）；SDK 仍在客户端按 schema 校验解析
     *   结果。若开启会发送 json_schema（strict），部分只支持 json_object 的
     *   兼容端点会 400。
     * - anthropic：@ai-sdk/anthropic 的 messages 路径，智谱/Moonshot/DeepSeek
     *   等厂商的 Anthropic 兼容端点同样适用。
     * - gemini：@ai-sdk/google 的 generateContent 路径。
     *
     * endpoint 存完整 base URL（含 /v1 等版本路径），三种格式的 SDK 会各自在它
     * 之后追加固定动作路径（/chat/completions、/messages、models/{model}:generateContent），
     * 这些后缀在 SDK 内部硬编码，应用无法改写，因此自定义端点必须能对应到这三种形态之一。
     *
     * @param modelId 模型 ID（来自模型路由配置）。
     * @returns 可直接传给 generateText/streamText 的语言模型。
     */
    public createModelById(modelId: string): LanguageModel {
        const apiKey = storeGet('apiKeys.openAi.key');
        const endpoint = storeGet('apiKeys.openAi.endpoint');
        const apiFormat = storeGet('apiKeys.openAi.apiFormat');
        if (!AI_API_FORMATS.includes(apiFormat as AiApiFormat)) {
            throw new Error(`设置项 apiKeys.openAi.apiFormat 非法: ${apiFormat}`);
        }
        if (apiFormat === 'anthropic') {
            return createAnthropic({ baseURL: endpoint, apiKey })(modelId);
        }
        if (apiFormat === 'gemini') {
            return createGoogleGenerativeAI({ baseURL: endpoint, apiKey })(modelId);
        }
        const provider = createOpenAICompatible({
            name: 'openai',
            baseURL: endpoint,
            apiKey: apiKey,
        });
        return provider.chatModel(modelId);
    }
}
