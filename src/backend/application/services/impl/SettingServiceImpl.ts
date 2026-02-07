import fs from 'fs';
import path from 'path';
import { SettingKey } from '@/common/types/store_schema';
import SystemConfigService from '@/backend/application/services/SystemConfigService';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import SettingService from '@/backend/application/services/SettingService';
import { OpenAiService } from '@/backend/application/services/OpenAiService';
import ClientProviderService from '@/backend/application/services/ClientProviderService';
import { TencentTranslateClient } from '@/backend/application/ports/gateways/translate/TencentTranslateClient';
import { YouDaoDictionaryClient } from '@/backend/application/ports/gateways/translate/YouDaoDictionaryClient';
import { getMainLogger } from '@/backend/infrastructure/logger';
import RendererEvents from '@/backend/application/ports/gateways/renderer/RendererEvents';
import { SettingsStore } from '@/backend/application/ports/gateways/SettingsStore';
import { ServiceCredentialSettingVO } from '@/common/types/vo/service-credentials-setting-vo';
import { EngineSelectionSettingVO } from '@/common/types/vo/engine-selection-setting-vo';
import { OPENAI_SUBTITLE_CUSTOM_STYLE_KEY, getSubtitleDefaultStyle } from '@/common/constants/openaiSubtitlePrompts';
import LocationUtil from '@/backend/utils/LocationUtil';
import ModelRoutingService from '@/backend/application/services/ModelRoutingService';

@injectable()
export default class SettingServiceImpl implements SettingService {
    @inject(TYPES.RendererEvents) private rendererEvents!: RendererEvents;
    @inject(TYPES.SystemConfigService) private systemConfigService!: SystemConfigService;
    @inject(TYPES.OpenAiService) private openAiService!: OpenAiService;
    @inject(TYPES.TencentClientProvider) private tencentProvider!: ClientProviderService<TencentTranslateClient>;
    @inject(TYPES.YouDaoClientProvider) private youDaoProvider!: ClientProviderService<YouDaoDictionaryClient>;
    @inject(TYPES.SettingsStore) private settingsStore!: SettingsStore;
    @inject(TYPES.ModelRoutingService) private modelRoutingService!: ModelRoutingService;
    private logger = getMainLogger('SettingServiceImpl');

    private async setValue(key: SettingKey, value: string): Promise<void> {
        if (this.settingsStore.set(key, value)) {
            this.rendererEvents.storeUpdate(key, value);
        }
    }

    private getValue(key: SettingKey): string {
        return this.settingsStore.get(key);
    }

    private normalizeSubtitleEngine(value: string): 'openai' | 'tencent' | 'none' {
        if (value === 'openai' || value === 'tencent' || value === 'none') {
            return value;
        }
        return 'none';
    }

    private normalizeDictionaryEngine(value: string): 'openai' | 'youdao' | 'none' {
        if (value === 'openai' || value === 'youdao' || value === 'none') {
            return value;
        }
        return 'none';
    }

    private normalizeTranscriptionEngine(value: string): 'openai' | 'whisper' | 'none' {
        if (value === 'openai' || value === 'whisper' || value === 'none') {
            return value;
        }
        return 'none';
    }

    private parseOpenAiModels(raw: string): string[] {
        const parsed = raw
            .split(/[\n,]/)
            .map((item) => item.trim())
            .filter((item) => item.length > 0);

        const deduped = Array.from(new Set(parsed));
        if (deduped.length === 0) {
            return ['gpt-4o-mini'];
        }
        return deduped;
    }

    private serializeOpenAiModels(models: string[]): string {
        return this.parseOpenAiModels(models.join(','))
            .join(',');
    }

    private resolveFeatureModel(candidate: string, availableModels: string[]): string {
        if (availableModels.includes(candidate)) {
            return candidate;
        }
        return availableModels[0] ?? 'gpt-4o-mini';
    }

    private whisperModelPathForCurrentSize(): { modelSize: 'base' | 'large'; modelPath: string } {
        const modelSize = this.getValue('whisper.modelSize') === 'large' ? 'large' : 'base';
        const modelTag = modelSize === 'large' ? 'large-v3' : 'base';
        const modelPath = path.join(LocationUtil.staticGetStoragePath('models'), 'whisper', `ggml-${modelTag}.bin`);
        return { modelSize, modelPath };
    }

    private isWhisperModelReady(): { ready: boolean; modelSize: 'base' | 'large'; modelPath: string } {
        const { modelSize, modelPath } = this.whisperModelPathForCurrentSize();
        return {
            ready: fs.existsSync(modelPath),
            modelSize,
            modelPath,
        };
    }

    public async migrateProviderSettings(): Promise<void> {
        if (this.getValue('settings.providers.migrated') === 'true') {
            return;
        }

        const subtitleEngine = this.getValue('subtitleTranslation.engine') === 'tencent' ? 'tencent' : 'openai';
        const dictionaryEngine = this.getValue('dictionary.engine') === 'youdao' ? 'youdao' : 'openai';
        const transcriptionEngine = this.getValue('transcription.engine') === 'whisper' ? 'whisper' : 'openai';

        await this.setValue('providers.subtitleTranslation', subtitleEngine);
        await this.setValue('providers.dictionary', dictionaryEngine);
        await this.setValue('providers.transcription', transcriptionEngine);

        await this.setValue(
            'features.openai.enableSentenceLearning',
            this.getValue('services.openai.enableSentenceLearning') === 'false' ? 'false' : 'true',
        );

        const subtitleMode = this.getValue('services.openai.subtitleTranslationMode');
        await this.setValue(
            'features.openai.subtitleTranslationMode',
            subtitleMode === 'simple_en' || subtitleMode === 'custom' ? subtitleMode : 'zh',
        );

        const legacyCustomStyle = (await this.systemConfigService.getValue(OPENAI_SUBTITLE_CUSTOM_STYLE_KEY))?.trim();
        const customStyle = legacyCustomStyle && legacyCustomStyle.length > 0
            ? legacyCustomStyle
            : getSubtitleDefaultStyle('custom');
        await this.setValue('features.openai.subtitleCustomStyle', customStyle);

        const defaultModel = this.parseOpenAiModels(this.getValue('models.openai.available'))[0] || 'gpt-4o-mini';
        await this.setValue('models.openai.available', defaultModel);
        await this.setValue('models.openai.sentenceLearning', defaultModel);
        await this.setValue('models.openai.subtitleTranslation', defaultModel);
        await this.setValue('models.openai.dictionary', defaultModel);

        await this.setValue('settings.providers.migrated', 'true');

        this.logger.info('provider settings migrated to new keys');
    }

    public async queryServiceCredentials(): Promise<ServiceCredentialSettingVO> {
        await this.migrateProviderSettings();
        return {
            openai: {
                key: this.getValue('apiKeys.openAi.key'),
                endpoint: this.getValue('apiKeys.openAi.endpoint'),
                models: this.parseOpenAiModels(this.getValue('models.openai.available')),
            },
            tencent: {
                secretId: this.getValue('apiKeys.tencent.secretId'),
                secretKey: this.getValue('apiKeys.tencent.secretKey'),
            },
            youdao: {
                secretId: this.getValue('apiKeys.youdao.secretId'),
                secretKey: this.getValue('apiKeys.youdao.secretKey'),
            },
            whisper: {
                modelSize: this.getValue('whisper.modelSize') === 'large' ? 'large' : 'base',
                enableVad: this.getValue('whisper.enableVad') !== 'false',
                vadModel: this.getValue('whisper.vadModel') === 'silero-v5.1.2' ? 'silero-v5.1.2' : 'silero-v6.2.0',
            },
        };
    }

    public async updateServiceCredentials(settings: ServiceCredentialSettingVO): Promise<void> {
        await this.migrateProviderSettings();
        const models = this.parseOpenAiModels((settings.openai.models ?? []).join(','));
        await this.setValue('apiKeys.openAi.key', settings.openai.key);
        await this.setValue('apiKeys.openAi.endpoint', settings.openai.endpoint);
        await this.setValue('models.openai.available', this.serializeOpenAiModels(models));

        const sentenceLearningModel = this.resolveFeatureModel(this.getValue('models.openai.sentenceLearning'), models);
        const subtitleTranslationModel = this.resolveFeatureModel(this.getValue('models.openai.subtitleTranslation'), models);
        const dictionaryModel = this.resolveFeatureModel(this.getValue('models.openai.dictionary'), models);
        await this.setValue('models.openai.sentenceLearning', sentenceLearningModel);
        await this.setValue('models.openai.subtitleTranslation', subtitleTranslationModel);
        await this.setValue('models.openai.dictionary', dictionaryModel);

        await this.setValue('apiKeys.tencent.secretId', settings.tencent.secretId);
        await this.setValue('apiKeys.tencent.secretKey', settings.tencent.secretKey);

        await this.setValue('apiKeys.youdao.secretId', settings.youdao.secretId);
        await this.setValue('apiKeys.youdao.secretKey', settings.youdao.secretKey);

        await this.setValue('whisper.modelSize', settings.whisper.modelSize === 'large' ? 'large' : 'base');
        await this.setValue('whisper.enableVad', settings.whisper.enableVad ? 'true' : 'false');
        await this.setValue(
            'whisper.vadModel',
            settings.whisper.vadModel === 'silero-v5.1.2' ? 'silero-v5.1.2' : 'silero-v6.2.0',
        );
    }

    public async queryEngineSelection(): Promise<EngineSelectionSettingVO> {
        await this.migrateProviderSettings();

        const subtitleTranslationEngine = this.normalizeSubtitleEngine(this.getValue('providers.subtitleTranslation'));
        const dictionaryEngine = this.normalizeDictionaryEngine(this.getValue('providers.dictionary'));
        const transcriptionEngine = this.normalizeTranscriptionEngine(this.getValue('providers.transcription'));

        const subtitleModeRaw = this.getValue('features.openai.subtitleTranslationMode');
        const subtitleMode: 'zh' | 'simple_en' | 'custom' =
            subtitleModeRaw === 'simple_en' || subtitleModeRaw === 'custom' ? subtitleModeRaw : 'zh';

        const subtitleCustomStyle = this.getValue('features.openai.subtitleCustomStyle') || getSubtitleDefaultStyle('custom');
        const availableModels = this.parseOpenAiModels(this.getValue('models.openai.available'));

        return {
            openai: {
                enableSentenceLearning: this.getValue('features.openai.enableSentenceLearning') !== 'false',
                subtitleTranslationMode: subtitleMode,
                subtitleCustomStyle,
                featureModels: {
                    sentenceLearning: this.resolveFeatureModel(this.getValue('models.openai.sentenceLearning'), availableModels),
                    subtitleTranslation: this.resolveFeatureModel(this.getValue('models.openai.subtitleTranslation'), availableModels),
                    dictionary: this.resolveFeatureModel(this.getValue('models.openai.dictionary'), availableModels),
                },
            },
            providers: {
                subtitleTranslationEngine,
                dictionaryEngine,
                transcriptionEngine,
            },
        };
    }

    public async updateEngineSelection(settings: EngineSelectionSettingVO): Promise<void> {
        await this.migrateProviderSettings();

        const subtitleTranslationEngine = this.normalizeSubtitleEngine(settings.providers.subtitleTranslationEngine);
        const dictionaryEngine = this.normalizeDictionaryEngine(settings.providers.dictionaryEngine);
        const transcriptionEngine = this.normalizeTranscriptionEngine(settings.providers.transcriptionEngine);
        const availableModels = this.parseOpenAiModels(this.getValue('models.openai.available'));

        if (transcriptionEngine === 'whisper') {
            const whisperStatus = this.isWhisperModelReady();
            if (!whisperStatus.ready) {
                throw new Error(`Whisper 模型未下载：${whisperStatus.modelSize}。请先下载模型（${whisperStatus.modelPath}）`);
            }
            await this.setValue('whisper.enabled', 'true');
        }

        await this.setValue('providers.subtitleTranslation', subtitleTranslationEngine);
        await this.setValue('providers.dictionary', dictionaryEngine);
        await this.setValue('providers.transcription', transcriptionEngine);

        const subtitleMode = settings.openai.subtitleTranslationMode;
        const normalizedMode: 'zh' | 'simple_en' | 'custom' =
            subtitleMode === 'simple_en' || subtitleMode === 'custom' ? subtitleMode : 'zh';

        const customStyle = (settings.openai.subtitleCustomStyle ?? '').trim();

        await this.setValue('features.openai.enableSentenceLearning', settings.openai.enableSentenceLearning ? 'true' : 'false');
        await this.setValue('features.openai.subtitleTranslationMode', normalizedMode);
        await this.setValue(
            'features.openai.subtitleCustomStyle',
            customStyle.length > 0 ? customStyle : getSubtitleDefaultStyle('custom'),
        );

        await this.setValue(
            'models.openai.sentenceLearning',
            this.resolveFeatureModel(settings.openai.featureModels.sentenceLearning, availableModels),
        );
        await this.setValue(
            'models.openai.subtitleTranslation',
            this.resolveFeatureModel(settings.openai.featureModels.subtitleTranslation, availableModels),
        );
        await this.setValue(
            'models.openai.dictionary',
            this.resolveFeatureModel(settings.openai.featureModels.dictionary, availableModels),
        );
    }

    public async getCurrentSentenceLearningProvider(): Promise<'openai' | null> {
        await this.migrateProviderSettings();
        const openaiEnabled = this.getValue('features.openai.enableSentenceLearning') === 'true';
        return openaiEnabled ? 'openai' : null;
    }

    public async getCurrentTranslationProvider(): Promise<'openai' | 'tencent' | null> {
        await this.migrateProviderSettings();
        const engine = this.normalizeSubtitleEngine(this.getValue('providers.subtitleTranslation'));
        if (engine === 'openai' || engine === 'tencent') {
            return engine;
        }
        return null;
    }

    public async getCurrentTranscriptionProvider(): Promise<'openai' | 'whisper' | null> {
        await this.migrateProviderSettings();
        const engine = this.normalizeTranscriptionEngine(this.getValue('providers.transcription'));
        if (engine === 'openai' || engine === 'whisper') {
            return engine;
        }
        return null;
    }

    public async getOpenAiSubtitleTranslationMode(): Promise<'zh' | 'simple_en' | 'custom'> {
        await this.migrateProviderSettings();
        const mode = this.getValue('features.openai.subtitleTranslationMode');
        if (mode === 'simple_en' || mode === 'custom') {
            return mode;
        }
        return 'zh';
    }

    public async getOpenAiSubtitleCustomStyle(): Promise<string> {
        await this.migrateProviderSettings();
        const stored = this.getValue('features.openai.subtitleCustomStyle');
        if (stored && stored.trim().length > 0) {
            return stored.trim();
        }
        return getSubtitleDefaultStyle('custom');
    }

    public async getCurrentDictionaryProvider(): Promise<'openai' | 'youdao' | null> {
        await this.migrateProviderSettings();
        const engine = this.normalizeDictionaryEngine(this.getValue('providers.dictionary'));
        if (engine === 'openai' || engine === 'youdao') {
            return engine;
        }
        return null;
    }

    public async testOpenAi(): Promise<{ success: boolean, message: string }> {
        try {
            this.logger.info('testing openai connection');
            const openAi = this.openAiService.getOpenAi();
            const routedModel = this.modelRoutingService.resolveOpenAiModel('sentenceLearning');
            if (!routedModel) {
                return { success: false, message: 'OpenAI 模型未配置，请先在功能设置中选择模型' };
            }
            const completion = await openAi.chat.completions.create({
                model: routedModel.modelId,
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: 5,
            });

            if (completion.choices && completion.choices.length > 0) {
                this.logger.info('openai test successful');
                return { success: true, message: 'OpenAI 配置测试成功' };
            }
            this.logger.warn('openai returned empty response');
            return { success: false, message: 'OpenAI 返回了空响应' };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error('openai test failed', { error: message });
            return { success: false, message: `OpenAI 测试失败: ${message}` };
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

            const result = await client.batchTrans(['Hello']);
            if (result && !result.isEmpty()) {
                this.logger.info('tencent test successful');
                return { success: true, message: '腾讯云配置测试成功' };
            }
            this.logger.warn('tencent returned empty response');
            return { success: false, message: '腾讯云返回了空响应' };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error('tencent test failed', { error: message });
            return { success: false, message: `腾讯云测试失败: ${message}` };
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

            const result = await client.translate('hello');
            if (result) {
                this.logger.info('youdao test successful');
                return { success: true, message: '有道词典配置测试成功' };
            }
            this.logger.warn('youdao returned empty response');
            return { success: false, message: '有道词典返回了空响应' };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error('youdao test failed', { error: message });
            return { success: false, message: `有道词典测试失败: ${message}` };
        }
    }
}
