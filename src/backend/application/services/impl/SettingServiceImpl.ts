import { SettingKey } from '@/common/types/store_schema';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import SettingService from '@/backend/application/services/SettingService';
import { FeatureServiceRoutingVO } from '@/common/types/vo/feature-service-routing-vo';
import { ServiceCredentialsVO } from '@/common/types/vo/service-credentials-vo';
import { OpenAiService } from '@/backend/application/services/OpenAiService';
import ClientProviderService from '@/backend/application/services/ClientProviderService';
import { TencentTranslateClient } from '@/backend/application/ports/gateways/translate/TencentTranslateClient';
import { YouDaoDictionaryClient } from '@/backend/application/ports/gateways/translate/YouDaoDictionaryClient';
import { getMainLogger } from '@/backend/infrastructure/logger';
import RendererEvents from '@/backend/application/ports/gateways/renderer/RendererEvents';
import { SettingsStore } from '@/backend/application/ports/gateways/SettingsStore';
import { getSubtitleDefaultStyle } from '@/common/constants/openaiSubtitlePrompts';

@injectable()
export default class SettingServiceImpl implements SettingService {
    @inject(TYPES.RendererEvents) private rendererEvents!: RendererEvents;
    @inject(TYPES.OpenAiService) private openAiService!: OpenAiService;
    @inject(TYPES.TencentClientProvider) private tencentProvider!: ClientProviderService<TencentTranslateClient>;
    @inject(TYPES.YouDaoClientProvider) private youDaoProvider!: ClientProviderService<YouDaoDictionaryClient>;
    @inject(TYPES.SettingsStore) private settingsStore!: SettingsStore;
    private logger = getMainLogger('SettingServiceImpl');

    private setValue(key: SettingKey, value: string): void {
        if (this.settingsStore.set(key, value)) {
            this.rendererEvents.storeUpdate(key, value);
        }
    }

    private getValue(key: SettingKey): string {
        return this.settingsStore.get(key);
    }

    private normalizeSubtitleProvider(value: string): FeatureServiceRoutingVO['subtitleTranslation']['provider'] {
        return value === 'openai' || value === 'tencent' || value === 'disabled' ? value : 'disabled';
    }

    private normalizeDictionaryProvider(value: string): FeatureServiceRoutingVO['dictionary']['provider'] {
        return value === 'openai' || value === 'youdao' || value === 'disabled' ? value : 'disabled';
    }

    private normalizeTranscriptionProvider(value: string): FeatureServiceRoutingVO['transcription']['provider'] {
        return value === 'openai' || value === 'whisper' || value === 'disabled' ? value : 'disabled';
    }

    public async getCredentials(): Promise<ServiceCredentialsVO> {
        const modelSizeRaw = this.getValue('local.whisper.modelSize');
        const modelSize = modelSizeRaw === 'large' ? 'large' : 'base';
        const enableVad = this.getValue('local.whisper.enableVad') === 'true';
        const vadModel = 'silero-v6.2.0' as const;

        return {
            openai: {
                apiKey: this.getValue('credentials.openai.apiKey'),
                endpoint: this.getValue('credentials.openai.endpoint'),
                model: this.getValue('credentials.openai.model'),
            },
            tencent: {
                secretId: this.getValue('credentials.tencent.secretId'),
                secretKey: this.getValue('credentials.tencent.secretKey'),
            },
            youdao: {
                secretId: this.getValue('credentials.youdao.secretId'),
                secretKey: this.getValue('credentials.youdao.secretKey'),
            },
            local: {
                whisper: {
                    modelSize,
                    enableVad,
                    vadModel,
                },
            },
        };
    }

    public async updateCredentials(patch: Partial<ServiceCredentialsVO>): Promise<void> {
        if (patch.openai?.apiKey !== undefined) {
            this.setValue('credentials.openai.apiKey', patch.openai.apiKey);
        }
        if (patch.openai?.endpoint !== undefined) {
            this.setValue('credentials.openai.endpoint', patch.openai.endpoint);
        }
        if (patch.openai?.model !== undefined) {
            this.setValue('credentials.openai.model', patch.openai.model);
        }

        if (patch.tencent?.secretId !== undefined) {
            this.setValue('credentials.tencent.secretId', patch.tencent.secretId);
        }
        if (patch.tencent?.secretKey !== undefined) {
            this.setValue('credentials.tencent.secretKey', patch.tencent.secretKey);
        }

        if (patch.youdao?.secretId !== undefined) {
            this.setValue('credentials.youdao.secretId', patch.youdao.secretId);
        }
        if (patch.youdao?.secretKey !== undefined) {
            this.setValue('credentials.youdao.secretKey', patch.youdao.secretKey);
        }

        if (patch.local?.whisper?.modelSize !== undefined) {
            this.setValue('local.whisper.modelSize', patch.local.whisper.modelSize === 'large' ? 'large' : 'base');
        }
        if (patch.local?.whisper?.enableVad !== undefined) {
            this.setValue('local.whisper.enableVad', patch.local.whisper.enableVad ? 'true' : 'false');
        }
        if (patch.local?.whisper?.vadModel !== undefined) {
            this.setValue('local.whisper.vadModel', 'silero-v6.2.0');
        }
    }

    public async getCurrentSentenceLearningProvider(): Promise<'openai' | null> {
        const openaiEnabled = this.getValue('feature.sentenceLearning.enabled') === 'true';
        return openaiEnabled ? 'openai' : null;
    }

    public async getCurrentTranslationProvider(): Promise<'openai' | 'tencent' | null> {
        const provider = this.normalizeSubtitleProvider(this.getValue('feature.subtitleTranslation.provider'));
        if (provider === 'openai' || provider === 'tencent') {
            return provider;
        }
        return null;
    }

    public async getCurrentTranscriptionProvider(): Promise<'openai' | 'whisper' | null> {
        const provider = this.normalizeTranscriptionProvider(this.getValue('feature.transcription.provider'));
        if (provider === 'openai' || provider === 'whisper') {
            return provider;
        }
        return null;
    }

    public async getOpenAiSubtitleTranslationMode(): Promise<'zh' | 'simple_en' | 'custom'> {
        const mode = this.getValue('feature.subtitleTranslation.openai.mode');
        return mode === 'simple_en' || mode === 'custom' ? mode : 'zh';
    }

    public async getOpenAiSubtitleCustomStyle(): Promise<string> {
        const stored = this.getValue('feature.subtitleTranslation.openai.customStyle');
        if (stored && stored.trim().length > 0) return stored.trim();
        return getSubtitleDefaultStyle('custom');
    }

    public async getCurrentDictionaryProvider(): Promise<'openai' | 'youdao' | null> {
        const provider = this.normalizeDictionaryProvider(this.getValue('feature.dictionary.provider'));
        if (provider === 'openai' || provider === 'youdao') {
            return provider;
        }
        return null;
    }

    public async getFeatureRouting(): Promise<FeatureServiceRoutingVO> {
        const subtitleProvider = this.normalizeSubtitleProvider(this.getValue('feature.subtitleTranslation.provider'));
        const dictionaryProvider = this.normalizeDictionaryProvider(this.getValue('feature.dictionary.provider'));
        const transcriptionProvider = this.normalizeTranscriptionProvider(this.getValue('feature.transcription.provider'));

        const mode = await this.getOpenAiSubtitleTranslationMode();
        const customStyle = this.getValue('feature.subtitleTranslation.openai.customStyle');

        return {
            subtitleTranslation: {
                provider: subtitleProvider,
                openai: {
                    mode,
                    customStyle,
                },
            },
            dictionary: {
                provider: dictionaryProvider,
            },
            transcription: {
                provider: transcriptionProvider,
            },
            sentenceLearning: {
                enabled: this.getValue('feature.sentenceLearning.enabled') === 'true',
            },
        };
    }

    public async updateFeatureRouting(patch: Partial<FeatureServiceRoutingVO>): Promise<void> {
        if (patch.subtitleTranslation?.provider !== undefined) {
            this.setValue('feature.subtitleTranslation.provider', patch.subtitleTranslation.provider);
        }
        if (patch.subtitleTranslation?.openai?.mode !== undefined) {
            const mode = patch.subtitleTranslation.openai.mode;
            const normalized = mode === 'simple_en' || mode === 'custom' ? mode : 'zh';
            this.setValue('feature.subtitleTranslation.openai.mode', normalized);
        }
        if (patch.subtitleTranslation?.openai?.customStyle !== undefined) {
            this.setValue('feature.subtitleTranslation.openai.customStyle', patch.subtitleTranslation.openai.customStyle ?? '');
        }
        if (patch.dictionary?.provider !== undefined) {
            this.setValue('feature.dictionary.provider', patch.dictionary.provider);
        }
        if (patch.transcription?.provider !== undefined) {
            this.setValue('feature.transcription.provider', patch.transcription.provider);
        }
        if (patch.sentenceLearning?.enabled !== undefined) {
            this.setValue('feature.sentenceLearning.enabled', patch.sentenceLearning.enabled ? 'true' : 'false');
        }
    }

    public async testOpenAi(): Promise<{ success: boolean, message: string }> {
        try {
            this.logger.info('testing openai connection');
            const openAi = this.openAiService.getOpenAi();
            // Test with a simple completion request
            const completion = await openAi.chat.completions.create({
                model: this.getValue('credentials.openai.model') || 'gpt-4o-mini',
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
