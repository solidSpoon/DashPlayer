import { SettingKey } from '@/common/types/store_schema';
import { storeGet, storeSet } from '../../store';
import SystemService from '@/backend/services/SystemService';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import SettingService from '@/backend/services/SettingService';
import { ApiSettingVO } from '@/common/types/vo/api-setting-vo';

@injectable()
export default class SettingServiceImpl implements SettingService {
    @inject(TYPES.SystemService) private systemService!: SystemService;
    
    public async set(key: SettingKey, value: string): Promise<void> {
        if (storeSet(key, value)) {
            this.systemService.mainWindow()?.webContents.send('store-update', key, value);
        }
    }

    public async get(key: SettingKey): Promise<string> {
        return storeGet(key);
    }
    
    public async queryApiSettings(): Promise<ApiSettingVO> {
        const settings: ApiSettingVO = {
            openai: {
                key: await this.get('apiKeys.openAi.key'),
                endpoint: await this.get('apiKeys.openAi.endpoint'),
                model: await this.get('model.gpt.default'),
                enableSentenceLearning: await this.get('services.openai.enableSentenceLearning') === 'true',
                enableSubtitleTranslation: await this.get('services.openai.enableSubtitleTranslation') === 'true',
            },
            tencent: {
                secretId: await this.get('apiKeys.tencent.secretId'),
                secretKey: await this.get('apiKeys.tencent.secretKey'),
                enableSubtitleTranslation: await this.get('services.tencent.enableSubtitleTranslation') === 'true',
            },
            youdao: {
                secretId: await this.get('apiKeys.youdao.secretId'),
                secretKey: await this.get('apiKeys.youdao.secretKey'),
                enableDictionary: await this.get('services.youdao.enableDictionary') === 'true',
            }
        };
        return settings;
    }
    
    public async updateApiSettings(settings: ApiSettingVO): Promise<void> {
        // Update OpenAI settings
        await this.set('apiKeys.openAi.key', settings.openai.key);
        await this.set('apiKeys.openAi.endpoint', settings.openai.endpoint);
        await this.set('model.gpt.default', settings.openai.model);
        await this.set('services.openai.enableSentenceLearning', settings.openai.enableSentenceLearning ? 'true' : 'false');
        
        // Update Tencent settings
        await this.set('apiKeys.tencent.secretId', settings.tencent.secretId);
        await this.set('apiKeys.tencent.secretKey', settings.tencent.secretKey);
        
        // Update Youdao settings
        await this.set('apiKeys.youdao.secretId', settings.youdao.secretId);
        await this.set('apiKeys.youdao.secretKey', settings.youdao.secretKey);
        await this.set('services.youdao.enableDictionary', settings.youdao.enableDictionary ? 'true' : 'false');
        
        // Handle mutual exclusion for subtitle translation
        if (settings.openai.enableSubtitleTranslation && settings.tencent.enableSubtitleTranslation) {
            // Both enabled - this shouldn't happen due to frontend logic, but handle it
            // Default to tencent as it was the original default
            await this.set('services.tencent.enableSubtitleTranslation', 'true');
            await this.set('services.openai.enableSubtitleTranslation', 'false');
        } else {
            // Set both as requested
            await this.set('services.openai.enableSubtitleTranslation', settings.openai.enableSubtitleTranslation ? 'true' : 'false');
            await this.set('services.tencent.enableSubtitleTranslation', settings.tencent.enableSubtitleTranslation ? 'true' : 'false');
        }
    }
    
    public async getCurrentSentenceLearningProvider(): Promise<'openai' | null> {
        const openaiEnabled = await this.get('services.openai.enableSentenceLearning') === 'true';
        return openaiEnabled ? 'openai' : null;
    }
    
    public async getCurrentTranslationProvider(): Promise<'openai' | 'tencent' | null> {
        const openaiEnabled = await this.get('services.openai.enableSubtitleTranslation') === 'true';
        const tencentEnabled = await this.get('services.tencent.enableSubtitleTranslation') === 'true';
        
        if (openaiEnabled) return 'openai';
        if (tencentEnabled) return 'tencent';
        return null;
    }
    
    public async getCurrentDictionaryProvider(): Promise<'youdao' | null> {
        const youdaoEnabled = await this.get('services.youdao.enableDictionary') === 'true';
        return youdaoEnabled ? 'youdao' : null;
    }
}
