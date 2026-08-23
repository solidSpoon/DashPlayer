import { storeGet } from '@/backend/infrastructure/settings/store';
import { resolveOpenAiBaseUrl } from '@/common/utils/openai-endpoint';
import StrUtil from '@/common/utils/str-util';
import { inject, injectable } from 'inversify';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { LanguageModel } from 'ai';
import ModelRoutingService from '@/backend/services/ModelRoutingService';
import TYPES from '@/backend/ioc/types';

export type AiModelScene = 'sentenceLearning' | 'subtitleTranslation' | 'dictionary';

export default interface AiProviderService {
    getModel(scene: AiModelScene): LanguageModel | null;
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
        // 使用 OpenAI 兼容 provider（@ai-sdk/openai-compatible）而非官方 OpenAI provider：
        // 兼容 provider 只走 /chat/completions 协议，没有 Responses API 路径。uniapi 等三方
        // 兼容端点的 /responses 流式实现不完整（deepseek-v4-flash 的 text-delta 缺少
        // text-start，SDK 会丢弃全部文本导致结构化输出为空），官方 provider 的默认模型方法
        // 恰恰走 Responses；三方模型场景下兼容 provider 更稳妥。
        const provider = createOpenAICompatible({
            name: 'openai',
            baseURL: resolveOpenAiBaseUrl(endpoint, storeGet('apiKeys.openAi.autoAppendV1')),
            apiKey: apiKey,
            // 不开启 supportsStructuredOutputs：让 Output.object 走通用的 response_format
            // json_object，兼容面最广（几乎所有 OpenAI 兼容端点都支持）；SDK 仍在客户端按
            // schema 校验解析结果。若开启会发送 json_schema（strict），部分只支持
            // json_object 的兼容端点会 400。
        });
        return provider.chatModel(routedModel.modelId);
    }
}
