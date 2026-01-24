import { OpenAiService } from '@/backend/services/OpenAiService';
import OpenAI from 'openai';
import { injectable } from 'inversify';
import { storeGetObject } from '@/backend/store';
import StrUtil from '@/common/utils/str-util';
import Util from '@/common/utils/Util';
import { AiProviderConfig } from '@/common/types/store_schema';

@injectable()
export class OpenAIServiceImpl implements OpenAiService {
    private openai: OpenAI | null = null;
    private activeConfigId: string | null = null;

    public getOpenAi(): OpenAI {
        console.log('[OpenAIServiceImpl] getOpenAi called.');
        // 1. 读取所有AI provider配置和当前激活的ID
        const configs = storeGetObject<AiProviderConfig[]>('aiProviderConfigs', []);
        const activeId = storeGetObject<string>('activeAiProviderId', 'system');
        console.log('[OpenAIServiceImpl] configs from store:', configs);
        console.log('[OpenAIServiceImpl] activeId from store:', activeId);

        // 2. 如果配置未改变，直接返回缓存的实例
        if (this.openai && this.activeConfigId === activeId) {
            return this.openai;
        }

        // 3. 查找当前激活的配置
        let activeConfig = configs.find(c => c.id === activeId);
        if (!activeConfig) {
            activeConfig = configs.length > 0 ? configs[0] : undefined;
        }
        console.log('[OpenAIServiceImpl] activeConfig:', activeConfig);

        if (!activeConfig) {
            throw new Error('未找到或未配置任何有效的AI provider');
        }

        const { apiKey, endpoint } = activeConfig;

        // 4. 检查配置是否有效
        if (StrUtil.hasBlank(apiKey, endpoint)) {
            throw new Error(`当前激活的AI配置项不完整 (ID: ${activeConfig.id})`);
        }

        // 5. 智能提取baseURL
        const baseURL = Util.extractBaseUrl(endpoint);
        if (StrUtil.isBlank(baseURL)) {
            throw new Error(`无法从Endpoint中提取有效的Base URL: ${endpoint}`);
        }

        console.log('[OpenAIServiceImpl] Re-creating OpenAI client with config:', { id: activeConfig.id, name: activeConfig.name, baseURL, apiKey: '***' });

        // 6. 创建并缓存新的OpenAI客户端实例
        this.openai = new OpenAI({
            baseURL: baseURL,
            apiKey: apiKey
        });
        this.activeConfigId = activeId;

        return this.openai;
    }
}
