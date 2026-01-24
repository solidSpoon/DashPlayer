import { storeGetObject } from "@/backend/store";
import StrUtil from "@/common/utils/str-util";
import Util from "@/common/utils/Util";
import { injectable } from "inversify";
import AiProviderService from "@/backend/services/AiProviderService";
import { createOpenAI } from "@ai-sdk/openai";
import { LanguageModelV1 } from "ai";
import { AiProviderConfig } from "@/common/types/store_schema";

@injectable()
export default class AiProviderServiceImpl implements AiProviderService {
    public getModel(): LanguageModelV1 | null {
        // 1. 读取所有AI provider配置和当前激活的ID
        const configs = storeGetObject<AiProviderConfig[]>(
            "aiProviderConfigs",
            [],
        );
        const activeId = storeGetObject<string>("activeAiProviderId", "system");
        console.log("[AiProviderServiceImpl] activeId from store:", activeId);

        if (!configs || configs.length === 0) {
            return null;
        }

        // 2. 查找当前激活的配置
        let activeConfig = configs.find((c) => c.id === activeId);
        if (!activeConfig) {
            // 如果找不到激活的配置，默认使用第一个
            activeConfig = configs[0];
            console.log(
                `[AiProviderServiceImpl] Active config (ID: ${activeId}) not found, falling back to first config:`,
                activeConfig,
            );
        }

        if (!activeConfig) {
            console.log(
                "[AiProviderServiceImpl] No active or fallback AI provider configuration available.",
            );
            return null;
        }

        const { apiKey, endpoint, model } = activeConfig;

        // 3. 检查配置是否有效
        if (StrUtil.hasBlank(apiKey, endpoint, model)) {
            console.error(
                "[AiProviderServiceImpl] Active AI Provider configuration is incomplete",
                activeConfig,
            );
            return null;
        }

        // 4. 智能提取baseURL
        const baseURL = Util.extractBaseUrl(endpoint);
        if (StrUtil.isBlank(baseURL)) {
            console.error(
                "[AiProviderServiceImpl] Failed to extract base URL from endpoint",
                endpoint,
            );
            return null;
        }

        console.log("[AiProviderServiceImpl] Creating AI model with config:", {
            id: activeConfig.id,
            name: activeConfig.name,
            baseURL,
            model,
            apiKey: "***",
        });

        // 5. 创建并返回AI客户端实例
        const openai = createOpenAI({
            compatibility: "compatible",
            baseURL: baseURL,
            apiKey: apiKey
        });

        return openai(model);
    }
}
