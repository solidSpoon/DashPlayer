import { SettingKey } from '@/common/types/store_schema';
import SystemConfigService from '@/backend/application/services/SystemConfigService';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import SettingService from '@/backend/application/services/SettingService';
import { ApiSettingVO } from '@/common/types/vo/api-setting-vo';
import { OpenAiService } from '@/backend/application/services/OpenAiService';
import ClientProviderService from '@/backend/application/services/ClientProviderService';
import { TencentTranslateClient } from '@/backend/application/ports/gateways/translate/TencentTranslateClient';
import { YouDaoDictionaryClient } from '@/backend/application/ports/gateways/translate/YouDaoDictionaryClient';
import { getMainLogger } from '@/backend/infrastructure/logger';
import RendererEvents from '@/backend/infrastructure/renderer/RendererEvents';
import { SettingsStore } from '@/backend/application/ports/gateways/SettingsStore';
import {
    OPENAI_SUBTITLE_CUSTOM_STYLE_KEY,
    getSubtitleDefaultStyle
} from '@/common/constants/openaiSubtitlePrompts';

@injectable()
export default class SettingServiceImpl implements SettingService {
    @inject(TYPES.RendererEvents) private rendererEvents!: RendererEvents;
    @inject(TYPES.SystemConfigService) private systemConfigService!: SystemConfigService;
    @inject(TYPES.OpenAiService) private openAiService!: OpenAiService;
    @inject(TYPES.TencentClientProvider) private tencentProvider!: ClientProviderService<TencentTranslateClient>;
    @inject(TYPES.YouDaoClientProvider) private youDaoProvider!: ClientProviderService<YouDaoDictionaryClient>;
    @inject(TYPES.SettingsStore) private settingsStore!: SettingsStore;
    private logger = getMainLogger('SettingServiceImpl');

    private async setValue(key: SettingKey, value: string): Promise<void> {
        if (this.settingsStore.set(key, value)) {
            this.rendererEvents.storeUpdate(key, value);
        }
    }

    private async getValue(key: SettingKey): Promise<string> {
        if (key === 'subtitleTranslation.engine') {
            return await this.getSubtitleTranslationEngine();
        }
        if (key === 'dictionary.engine') {
            return await this.getDictionaryEngine();
        }
        if (key === 'transcription.engine') {
            return await this.getTranscriptionEngine();
        }
        return this.settingsStore.get(key);
    }

    private async getSubtitleTranslationEngine(): Promise<'openai' | 'tencent'> {
        const stored = this.settingsStore.get('subtitleTranslation.engine');
        return stored === 'tencent' || stored === 'openai' ? stored : 'openai';
    }

    private async getDictionaryEngine(): Promise<'openai' | 'youdao'> {
        const stored = this.settingsStore.get('dictionary.engine');
        return stored === 'youdao' || stored === 'openai' ? stored : 'openai';
    }

    private async getTranscriptionEngine(): Promise<'openai' | 'whisper'> {
        const stored = this.settingsStore.get('transcription.engine');
        return stored === 'whisper' || stored === 'openai' ? stored : 'openai';
    }

    public async queryApiSettings(): Promise<ApiSettingVO> {
        const subtitleTranslationEngine = await this.getSubtitleTranslationEngine();
        const dictionaryEngine = await this.getDictionaryEngine();
        const transcriptionEngine = await this.getTranscriptionEngine();

        const settings: ApiSettingVO = {
            openai: {
                key: await this.getValue('apiKeys.openAi.key'),
                endpoint: await this.getValue('apiKeys.openAi.endpoint'),
                model: await this.getValue('model.gpt.default'),
                enableSentenceLearning: await this.getValue('services.openai.enableSentenceLearning') === 'true',
                enableSubtitleTranslation: subtitleTranslationEngine === 'openai',
                subtitleTranslationMode: await this.getOpenAiSubtitleTranslationMode(),
                subtitleCustomStyle: await this.getOpenAiSubtitleCustomStyle(),
                enableDictionary: dictionaryEngine === 'openai',
                enableTranscription: transcriptionEngine === 'openai',
            },
            tencent: {
                secretId: await this.getValue('apiKeys.tencent.secretId'),
                secretKey: await this.getValue('apiKeys.tencent.secretKey'),
                enableSubtitleTranslation: subtitleTranslationEngine === 'tencent',
            },
            youdao: {
                secretId: await this.getValue('apiKeys.youdao.secretId'),
                secretKey: await this.getValue('apiKeys.youdao.secretKey'),
                enableDictionary: dictionaryEngine === 'youdao',
            },
            whisper: {
                enabled: await this.getValue('whisper.enabled') === 'true',
                enableTranscription: transcriptionEngine === 'whisper',
                modelSize: (await this.getValue('whisper.modelSize')) === 'large' ? 'large' : 'base',
                enableVad: true,
                vadModel: 'silero-v6.2.0',
            }
        };
        return settings;
    }

    public async updateApiSettings(settings: ApiSettingVO, service?: string): Promise<void> {
        if (service === 'whisper') {
            await this.setValue('whisper.enabled', settings.whisper.enabled ? 'true' : 'false');
            const transcriptionEngine = settings.whisper.enableTranscription ? 'whisper' : 'openai';
            await this.setValue('transcription.engine', transcriptionEngine);
            await this.setValue('whisper.modelSize', settings.whisper.modelSize === 'large' ? 'large' : 'base');
            await this.setValue('whisper.enableVad', 'true');
            await this.setValue('whisper.vadModel', 'silero-v6.2.0');
            if (transcriptionEngine === 'whisper') {
                await this.setValue('whisper.enabled', 'true');
            }
            return;
        }

        // Update OpenAI settings
        await this.setValue('apiKeys.openAi.key', settings.openai.key);
        await this.setValue('apiKeys.openAi.endpoint', settings.openai.endpoint);
        await this.setValue('model.gpt.default', settings.openai.model);
        await this.setValue('services.openai.enableSentenceLearning', settings.openai.enableSentenceLearning ? 'true' : 'false');
        const subtitleModeInput = settings.openai.subtitleTranslationMode;
        const subtitleMode: 'zh' | 'simple_en' | 'custom' =
            subtitleModeInput === 'simple_en' || subtitleModeInput === 'custom' ? subtitleModeInput : 'zh';
        await this.setValue('services.openai.subtitleTranslationMode', subtitleMode);
        const customStyleInput = settings.openai.subtitleCustomStyle ?? '';
        const styleToStore = customStyleInput.trim().length > 0 ? customStyleInput.trim() : getSubtitleDefaultStyle('custom');
        await this.systemConfigService.setValue(OPENAI_SUBTITLE_CUSTOM_STYLE_KEY, styleToStore);

        // Update Tencent settings
        await this.setValue('apiKeys.tencent.secretId', settings.tencent.secretId);
        await this.setValue('apiKeys.tencent.secretKey', settings.tencent.secretKey);

        // Update Youdao settings
        await this.setValue('apiKeys.youdao.secretId', settings.youdao.secretId);
        await this.setValue('apiKeys.youdao.secretKey', settings.youdao.secretKey);

        const subtitleTranslationEngine: 'openai' | 'tencent' =
            settings.tencent.enableSubtitleTranslation ? 'tencent' : 'openai';
        await this.setValue('subtitleTranslation.engine', subtitleTranslationEngine);

        const dictionaryEngine: 'openai' | 'youdao' =
            settings.youdao.enableDictionary ? 'youdao' : 'openai';
        await this.setValue('dictionary.engine', dictionaryEngine);

        // Update Whisper settings
        await this.setValue('whisper.enabled', settings.whisper.enabled ? 'true' : 'false');
        await this.setValue('whisper.modelSize', settings.whisper.modelSize === 'large' ? 'large' : 'base');
        await this.setValue('whisper.enableVad', 'true');
        await this.setValue('whisper.vadModel', 'silero-v6.2.0');

        const transcriptionEngine: 'openai' | 'whisper' =
            settings.whisper.enableTranscription ? 'whisper' : 'openai';
        await this.setValue('transcription.engine', transcriptionEngine);
        if (transcriptionEngine === 'whisper') {
            await this.setValue('whisper.enabled', 'true');
        }
    }

    public async getCurrentSentenceLearningProvider(): Promise<'openai' | null> {
        const openaiEnabled = await this.getValue('services.openai.enableSentenceLearning') === 'true';
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
        const mode = await this.getValue('services.openai.subtitleTranslationMode');
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
                model: await this.getValue('model.gpt.default') || 'gpt-4o-mini',
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
