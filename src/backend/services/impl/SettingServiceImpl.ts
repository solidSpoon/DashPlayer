import { SettingKey } from '@/common/types/store_schema';
import { storeGet, storeSet } from '../../store';
import SystemConfigService from '@/backend/services/SystemConfigService';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import SettingService from '@/backend/services/SettingService';
import { ApiSettingVO } from '@/common/types/vo/api-setting-vo';
import { OpenAiService } from '@/backend/services/OpenAiService';
import TencentProvider from '@/backend/services/impl/clients/TencentProvider';
import YouDaoProvider from '@/backend/services/impl/clients/YouDaoProvider';
import { getMainLogger } from '@/backend/ioc/simple-logger';
import RendererEvents from '@/backend/infrastructure/renderer/RendererEvents';
import {
    OPENAI_SUBTITLE_CUSTOM_STYLE_KEY,
    getSubtitleDefaultStyle
} from '@/common/constants/openaiSubtitlePrompts';

@injectable()
export default class SettingServiceImpl implements SettingService {
    @inject(TYPES.RendererEvents) private rendererEvents!: RendererEvents;
    @inject(TYPES.SystemConfigService) private systemConfigService!: SystemConfigService;
    @inject(TYPES.OpenAiService) private openAiService!: OpenAiService;
    @inject(TYPES.TencentClientProvider) private tencentProvider!: TencentProvider;
    @inject(TYPES.YouDaoClientProvider) private youDaoProvider!: YouDaoProvider;
    private logger = getMainLogger('SettingServiceImpl');
    
    public async set(key: SettingKey, value: string): Promise<void> {
        if (storeSet(key, value)) {
            this.rendererEvents.storeUpdate(key, value);
        }
    }

    public async get(key: SettingKey): Promise<string> {
        if (key === 'subtitleTranslation.engine') {
            return await this.getSubtitleTranslationEngine();
        }
        if (key === 'dictionary.engine') {
            return await this.getDictionaryEngine();
        }
        if (key === 'transcription.engine') {
            return await this.getTranscriptionEngine();
        }
        return storeGet(key);
    }

    private async getSubtitleTranslationEngine(): Promise<'openai' | 'tencent'> {
        const stored = storeGet('subtitleTranslation.engine');
        return stored === 'tencent' || stored === 'openai' ? stored : 'openai';
    }

    private async getDictionaryEngine(): Promise<'openai' | 'youdao'> {
        const stored = storeGet('dictionary.engine');
        return stored === 'youdao' || stored === 'openai' ? stored : 'openai';
    }

    private async getTranscriptionEngine(): Promise<'openai' | 'whisper'> {
        const stored = storeGet('transcription.engine');
        return stored === 'whisper' || stored === 'openai' ? stored : 'openai';
    }
    
    public async queryApiSettings(): Promise<ApiSettingVO> {
        const subtitleTranslationEngine = await this.getSubtitleTranslationEngine();
        const dictionaryEngine = await this.getDictionaryEngine();
        const transcriptionEngine = await this.getTranscriptionEngine();

        const settings: ApiSettingVO = {
            openai: {
                key: await this.get('apiKeys.openAi.key'),
                endpoint: await this.get('apiKeys.openAi.endpoint'),
                model: await this.get('model.gpt.default'),
                enableSentenceLearning: await this.get('services.openai.enableSentenceLearning') === 'true',
                enableSubtitleTranslation: subtitleTranslationEngine === 'openai',
                subtitleTranslationMode: await this.getOpenAiSubtitleTranslationMode(),
                subtitleCustomStyle: await this.getOpenAiSubtitleCustomStyle(),
                enableDictionary: dictionaryEngine === 'openai',
                enableTranscription: transcriptionEngine === 'openai',
            },
            tencent: {
                secretId: await this.get('apiKeys.tencent.secretId'),
                secretKey: await this.get('apiKeys.tencent.secretKey'),
                enableSubtitleTranslation: subtitleTranslationEngine === 'tencent',
            },
            youdao: {
                secretId: await this.get('apiKeys.youdao.secretId'),
                secretKey: await this.get('apiKeys.youdao.secretKey'),
                enableDictionary: dictionaryEngine === 'youdao',
            },
            whisper: {
                enabled: await this.get('whisper.enabled') === 'true',
                enableTranscription: transcriptionEngine === 'whisper',
                modelSize: (await this.get('whisper.modelSize')) === 'large' ? 'large' : 'base',
                enableVad: true,
                vadModel: 'silero-v6.2.0',
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
        const subtitleModeInput = settings.openai.subtitleTranslationMode;
        const subtitleMode: 'zh' | 'simple_en' | 'custom' =
            subtitleModeInput === 'simple_en' || subtitleModeInput === 'custom' ? subtitleModeInput : 'zh';
        await this.set('services.openai.subtitleTranslationMode', subtitleMode);
        const customStyleInput = settings.openai.subtitleCustomStyle ?? '';
        const styleToStore = customStyleInput.trim().length > 0 ? customStyleInput.trim() : getSubtitleDefaultStyle('custom');
        await this.systemConfigService.setValue(OPENAI_SUBTITLE_CUSTOM_STYLE_KEY, styleToStore);
        
        // Update Tencent settings
        await this.set('apiKeys.tencent.secretId', settings.tencent.secretId);
        await this.set('apiKeys.tencent.secretKey', settings.tencent.secretKey);
        
        // Update Youdao settings
        await this.set('apiKeys.youdao.secretId', settings.youdao.secretId);
        await this.set('apiKeys.youdao.secretKey', settings.youdao.secretKey);

        const subtitleTranslationEngine: 'openai' | 'tencent' =
            settings.tencent.enableSubtitleTranslation ? 'tencent' : 'openai';
        await this.set('subtitleTranslation.engine', subtitleTranslationEngine);

        const dictionaryEngine: 'openai' | 'youdao' =
            settings.youdao.enableDictionary ? 'youdao' : 'openai';
        await this.set('dictionary.engine', dictionaryEngine);
        
        // Update Whisper settings
        await this.set('whisper.enabled', settings.whisper.enabled ? 'true' : 'false');
        await this.set('whisper.modelSize', settings.whisper.modelSize === 'large' ? 'large' : 'base');
        await this.set('whisper.enableVad', 'true');
        await this.set('whisper.vadModel', 'silero-v6.2.0');

        const transcriptionEngine: 'openai' | 'whisper' =
            settings.whisper.enableTranscription ? 'whisper' : 'openai';
        await this.set('transcription.engine', transcriptionEngine);
        if (transcriptionEngine === 'whisper') {
            await this.set('whisper.enabled', 'true');
        }
    }
    
    public async getCurrentSentenceLearningProvider(): Promise<'openai' | null> {
        const openaiEnabled = await this.get('services.openai.enableSentenceLearning') === 'true';
        return openaiEnabled ? 'openai' : null;
    }
    
    public async getCurrentTranslationProvider(): Promise<'openai' | 'tencent' | null> {
        const engine = await this.getSubtitleTranslationEngine();
        return engine === 'openai' || engine === 'tencent' ? engine : null;
    }

    public async getCurrentTranscriptionProvider(): Promise<'openai' | 'whisper' | null> {
        const engine = await this.getTranscriptionEngine();
        return engine === 'openai' || engine === 'whisper' ? engine : null;
    }

    public async getOpenAiSubtitleTranslationMode(): Promise<'zh' | 'simple_en' | 'custom'> {
        const mode = await this.get('services.openai.subtitleTranslationMode');
        if (mode === 'simple_en' || mode === 'custom') {
            return mode;
        }
        return 'zh';
    }

    public async getOpenAiSubtitleCustomStyle(): Promise<string> {
        const stored = await this.systemConfigService.getValue(OPENAI_SUBTITLE_CUSTOM_STYLE_KEY);
        if (stored && stored.trim().length > 0) {
            return stored.trim();
        }
        return getSubtitleDefaultStyle('custom');
    }
    
    public async getCurrentDictionaryProvider(): Promise<'openai' | 'youdao' | null> {
        const engine = await this.getDictionaryEngine();
        return engine === 'openai' || engine === 'youdao' ? engine : null;
    }
    
    public async testOpenAi(): Promise<{ success: boolean, message: string }> {
        try {
            this.logger.info('testing openai connection');
            const openAi = this.openAiService.getOpenAi();
            // Test with a simple completion request
            const completion = await openAi.chat.completions.create({
                model: await this.get('model.gpt.default') || 'gpt-4o-mini',
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: 5
            });
            
            if (completion.choices && completion.choices.length > 0) {
                this.logger.info('openai test successful');
                return { success: true, message: 'OpenAI 配置测试成功' };
            } else {
                this.logger.warn('openai returned empty response');
                return { success: false, message: 'OpenAI 返回了空响应' };
            }
        } catch (error: any) {
            this.logger.error('openai test failed', { error: error.message || error });
            return { success: false, message: `OpenAI 测试失败: ${error.message || error}` };
        }
    }
    
    public async testTencent(): Promise<{ success: boolean, message: string }> {
        try {
            this.logger.info('testing tencent connection');
            const client = this.tencentProvider.getClient();
            if (!client) {
                this.logger.warn('tencent client not configured');
                return { success: false, message: '腾讯云配置不完整' };
            }
            
            // Test with a simple translation request
            const result = await client.batchTrans(['Hello']);
            if (result && !result.isEmpty()) {
                this.logger.info('tencent test successful');
                return { success: true, message: '腾讯云配置测试成功' };
            } else {
                this.logger.warn('tencent returned empty response');
                return { success: false, message: '腾讯云返回了空响应' };
            }
        } catch (error: any) {
            this.logger.error('tencent test failed', { error: error.message || error });
            return { success: false, message: `腾讯云测试失败: ${error.message || error}` };
        }
    }
    
    public async testYoudao(): Promise<{ success: boolean, message: string }> {
        try {
            this.logger.info('testing youdao connection');
            const client = this.youDaoProvider.getClient();
            if (!client) {
                this.logger.warn('youdao client not configured');
                return { success: false, message: '有道词典配置不完整' };
            }
            
            // Test with a simple word query
            const result = await client.translate('hello');
            if (result) {
                this.logger.info('youdao test successful');
                return { success: true, message: '有道词典配置测试成功' };
            } else {
                this.logger.warn('youdao returned empty response');
                return { success: false, message: '有道词典返回了空响应' };
            }
        } catch (error: any) {
            this.logger.error('youdao test failed', { error: error.message || error });
            return { success: false, message: `有道词典测试失败: ${error.message || error}` };
        }
    }
}
