import { SettingKey } from '@/common/types/store_schema';
import { storeGet, storeSet } from '../../store';
import SystemService from '@/backend/services/SystemService';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import SettingService from '@/backend/services/SettingService';
import { ApiSettingVO } from '@/common/types/vo/api-setting-vo';
import { OpenAiService } from '@/backend/services/OpenAiService';
import TencentProvider from '@/backend/services/impl/clients/TencentProvider';
import YouDaoProvider from '@/backend/services/impl/clients/YouDaoProvider';

@injectable()
export default class SettingServiceImpl implements SettingService {
    @inject(TYPES.SystemService) private systemService!: SystemService;
    @inject(TYPES.OpenAiService) private openAiService!: OpenAiService;
    @inject(TYPES.TencentClientProvider) private tencentProvider!: TencentProvider;
    @inject(TYPES.YouDaoClientProvider) private youDaoProvider!: YouDaoProvider;
    
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
                enableDictionary: await this.get('services.openai.enableDictionary') === 'true',
                enableTranscription: await this.get('services.openai.enableTranscription') === 'true',
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
            },
            whisper: {
                enabled: await this.get('whisper.enabled') === 'true',
                enableTranscription: await this.get('whisper.enableTranscription') === 'true',
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
        await this.set('services.openai.enableDictionary', settings.openai.enableDictionary ? 'true' : 'false');
        await this.set('services.openai.enableTranscription', settings.openai.enableTranscription ? 'true' : 'false');
        
        // Update Tencent settings
        await this.set('apiKeys.tencent.secretId', settings.tencent.secretId);
        await this.set('apiKeys.tencent.secretKey', settings.tencent.secretKey);
        
        // Update Youdao settings
        await this.set('apiKeys.youdao.secretId', settings.youdao.secretId);
        await this.set('apiKeys.youdao.secretKey', settings.youdao.secretKey);
        
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
        
        // Handle mutual exclusion for dictionary
        if (settings.openai.enableDictionary && settings.youdao.enableDictionary) {
            // Both enabled - default to openai
            await this.set('services.openai.enableDictionary', 'true');
            await this.set('services.youdao.enableDictionary', 'false');
        } else {
            // Set both as requested
            await this.set('services.openai.enableDictionary', settings.openai.enableDictionary ? 'true' : 'false');
            await this.set('services.youdao.enableDictionary', settings.youdao.enableDictionary ? 'true' : 'false');
        }
        
        // Update Whisper settings
        await this.set('whisper.enabled', settings.whisper.enabled ? 'true' : 'false');
        await this.set('whisper.enableTranscription', settings.whisper.enableTranscription ? 'true' : 'false');
        
        // Handle mutual exclusion for transcription
        if (settings.openai.enableTranscription && settings.whisper.enableTranscription) {
            // Both enabled - default to whisper as it's local and preferred
            await this.set('whisper.enableTranscription', 'true');
            await this.set('services.openai.enableTranscription', 'false');
        } else {
            // Set both as requested
            await this.set('services.openai.enableTranscription', settings.openai.enableTranscription ? 'true' : 'false');
            await this.set('whisper.enableTranscription', settings.whisper.enableTranscription ? 'true' : 'false');
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
    
    public async getCurrentDictionaryProvider(): Promise<'openai' | 'youdao' | null> {
        const openaiEnabled = await this.get('services.openai.enableDictionary') === 'true';
        const youdaoEnabled = await this.get('services.youdao.enableDictionary') === 'true';
        
        if (openaiEnabled) return 'openai';
        if (youdaoEnabled) return 'youdao';
        return null;
    }
    
    public async testOpenAi(): Promise<{ success: boolean, message: string }> {
        try {
            const openAi = this.openAiService.getOpenAi();
            // Test with a simple completion request
            const completion = await openAi.chat.completions.create({
                model: await this.get('model.gpt.default') || 'gpt-4o-mini',
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: 5
            });
            
            if (completion.choices && completion.choices.length > 0) {
                return { success: true, message: 'OpenAI 配置测试成功' };
            } else {
                return { success: false, message: 'OpenAI 返回了空响应' };
            }
        } catch (error: any) {
            return { success: false, message: `OpenAI 测试失败: ${error.message || error}` };
        }
    }
    
    public async testTencent(): Promise<{ success: boolean, message: string }> {
        try {
            const client = this.tencentProvider.getClient();
            if (!client) {
                return { success: false, message: '腾讯云配置不完整' };
            }
            
            // Test with a simple translation request
            const result = await client.batchTrans(['Hello']);
            if (result && !result.isEmpty()) {
                return { success: true, message: '腾讯云配置测试成功' };
            } else {
                return { success: false, message: '腾讯云返回了空响应' };
            }
        } catch (error: any) {
            return { success: false, message: `腾讯云测试失败: ${error.message || error}` };
        }
    }
    
    public async testYoudao(): Promise<{ success: boolean, message: string }> {
        try {
            const client = this.youDaoProvider.getClient();
            if (!client) {
                return { success: false, message: '有道词典配置不完整' };
            }
            
            // Test with a simple word query
            const result = await client.translate('hello');
            if (result) {
                return { success: true, message: '有道词典配置测试成功' };
            } else {
                return { success: false, message: '有道词典返回了空响应' };
            }
        } catch (error: any) {
            return { success: false, message: `有道词典测试失败: ${error.message || error}` };
        }
    }
}
