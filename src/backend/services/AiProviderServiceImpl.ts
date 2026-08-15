import { storeGet } from '@/backend/infrastructure/settings/store';
import { resolveOpenAiBaseUrl } from '@/common/utils/openai-endpoint';
import StrUtil from '@/common/utils/str-util';
import { inject, injectable } from 'inversify';
import AiProviderService, { AiModelScene } from '@/backend/services/AiProviderService';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { LanguageModel, wrapLanguageModel } from 'ai';
import ModelRoutingService from '@/backend/services/ModelRoutingService';
import TYPES from '@/backend/ioc/types';

// 已知支持 reasoning_effort: 'none' 的模型族匹配规则（其余模型不注入，保持模型默认档位）。
// 数据来源：cherry-studio 的 packages/provider-registry/src/creators/*.ts 中各家
// reasoningFamilies 的 effort 词表（其 openai-chat 线路的 off 档位同样下发 reasoningEffort: none）：
// - OpenAI：gpt-5.1 及后续小版本支持 none；初代 gpt-5、o1/o3/o4、-codex/-pro、gpt-oss 不支持
//   （排除 chat/codex/pro 后缀）。实测 gpt-5.4-nano 接受 none、拒绝 minimal。
// - DeepSeek：deepseek-v4 及更高版本支持 none；deepseek-chat/v3 是开关式思考，不走 effort。
//   实测 deepseek-v4-flash 接受 none。
// - 智谱：GLM-5.x 支持 none（官方文档：GLM-5.2 起按 SKU 声明 reasoning_effort，传入 none 或
//   minimal 模型会放弃思考）；GLM-4.5/4.6/4.7 是开关式思考，不走 effort。
// - 豆包：doubao-seed-1.6（排除 251015 快照/flash/thinking）与 doubao-1-5-thinking-pro-m 支持 none。
// - Mistral：mistral-small-2603 支持 none。
// - xAI：grok-4.3（排除 non-reasoning 变体）支持 none。
const NONE_REASONING_MODEL_PATTERNS: RegExp[] = [
    /^gpt-5[.-]\d+(?!.*(?:chat|codex|pro))/i,
    /^deepseek-v(?:[4-9]\d*|[1-9]\d{1,})/i,
    /^glm-5/i,
    /^doubao-(?:1-5-thinking-pro-m|seed-1[.-]6)(?!-(?:flash|thinking)(?:-|$))(?:-lite)?(?!-251015)(?:-\d+)?$/i,
    /^mistral-small-2603/i,
    /^grok-4\.3(?!.*non-reasoning)/i,
];

/**
 * 判断模型 id 是否属于已知支持 reasoning_effort: 'none' 的模型族。
 * 供 getModel 决定是否注入最快推理档位；测试（buildLiveModel）复用同一规则，避免两处漂移。
 *
 * @param modelId 路由后的模型 id。
 * @returns 属于已知支持 none 的模型族时返回 true。
 */
export const isNoneReasoningModel = (modelId: string): boolean =>
    NONE_REASONING_MODEL_PATTERNS.some((pattern) => pattern.test(modelId));


@injectable()
export default class AiProviderServiceImpl implements AiProviderService {
    @inject(TYPES.ModelRoutingService)
    private modelRoutingService!: ModelRoutingService;

    public getModel(scene: AiModelScene): LanguageModel | null {
        const apiKey = storeGet('apiKeys.openAi.key');
        const endpoint = storeGet('apiKeys.openAi.endpoint');
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
        // 对已知支持 none 的模型族统一注入最快推理档位（关闭推理）；其余模型不注入，保持模型
        // 默认档位，避免对不支持 none 的模型（如初代 gpt-5、o3）下发 reasoning_effort 导致 400。
        // 实测 deepseek-v4-flash 与 gpt-5.4-nano 都接受 none/low，而 gpt-5.4-nano 会 400 拒绝
        // minimal，因此不用 minimal；none 是这些模型普遍支持的最快档位。
        // 注意：兼容 provider 不认顶层 reasoning 参数，必须通过 providerOptions.<name>.reasoningEffort
        // 注入（这里 name 是 'openai'），SDK 会把它映射为请求体里的 reasoning_effort。
        if (!isNoneReasoningModel(routedModel.modelId)) {
            return provider.chatModel(routedModel.modelId);
        }
        return wrapLanguageModel({
            model: provider.chatModel(routedModel.modelId),
            middleware: {
                transformParams: async ({ params }) => ({
                    ...params,
                    providerOptions: {
                        ...params.providerOptions,
                        openai: { reasoningEffort: 'none' },
                    },
                }),
            },
        });
    }
}
