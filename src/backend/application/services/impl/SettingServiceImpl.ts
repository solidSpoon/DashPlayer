import { SettingKey } from '@/common/types/store_schema';
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
import {
    OpenAiAvailableModelDetailVO,
    OpenAiModelUsageFeature,
    ServiceCredentialSettingDetailVO,
    ServiceCredentialSettingSaveVO,
} from '@/common/types/vo/service-credentials-setting-vo';
import { EngineSelectionSettingVO } from '@/common/types/vo/engine-selection-setting-vo';
import { getSubtitleDefaultStyle } from '@/common/constants/openaiSubtitlePrompts';
import ModelRoutingService from '@/backend/application/services/ModelRoutingService';

@injectable()
export default class SettingServiceImpl implements SettingService {
    @inject(TYPES.RendererEvents) private rendererEvents!: RendererEvents;
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

    /**
     * 对枚举字符串做严格校验，不合法时立即抛错暴露数据问题。
     */
    private requireEnumValue<TValue extends string>(
        value: string,
        allowedValues: readonly TValue[],
        fieldName: string,
    ): TValue {
        if (allowedValues.includes(value as TValue)) {
            return value as TValue;
        }
        throw new Error(`设置项 ${fieldName} 非法: ${value}`);
    }

    /**
     * 对布尔字符串做严格校验，不接受隐式回退。
     */
    private requireBooleanString(value: string, fieldName: string): boolean {
        if (value === 'true') {
            return true;
        }
        if (value === 'false') {
            return false;
        }
        throw new Error(`设置项 ${fieldName} 非法: ${value}`);
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

    /**
     * 将用户输入的模型列表文本解析为可用模型数组。
     *
     * 解析规则：
     * - 同时支持逗号与换行分隔；
     * - 会去掉首尾空白并移除空项；
     * - 不做默认值回退，空列表直接返回空数组。
     */
    private parseOpenAiModels(raw: string): string[] {
        const parsed = raw
            .split(/[\n,]/)
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
        return Array.from(new Set(parsed));
    }

    /**
     * 读取当前功能模型占用关系。
     */
    private getOpenAiFeatureModelUsage(): Record<OpenAiModelUsageFeature, string> {
        return {
            sentenceLearning: this.getValue('models.openai.sentenceLearning'),
            subtitleTranslation: this.getValue('models.openai.subtitleTranslation'),
            dictionary: this.getValue('models.openai.dictionary'),
        };
    }

    /**
     * 构建可用模型详情并标记占用来源。
     */
    private buildOpenAiModelDetails(availableModels: string[]): OpenAiAvailableModelDetailVO[] {
        const usageByFeature = this.getOpenAiFeatureModelUsage();
        const usageMap = new Map<string, OpenAiModelUsageFeature[]>();

        for (const feature of Object.keys(usageByFeature) as OpenAiModelUsageFeature[]) {
            const model = usageByFeature[feature];
            const list = usageMap.get(model) ?? [];
            list.push(feature);
            usageMap.set(model, list);
        }

        return availableModels.map((model) => ({
            model,
            inUseBy: usageMap.get(model) ?? [],
        }));
    }

    /**
     * 校验功能模型是否在可用模型列表中。
     */
    private requireFeatureModelAvailable(candidate: string, availableModels: string[], fieldName: string): string {
        if (!availableModels.includes(candidate)) {
            throw new Error(`${fieldName} 不是可用模型: ${candidate}`);
        }
        return candidate;
    }

    public async migrateProviderSettings(): Promise<void> {
        return Promise.resolve();
    }

    /**
     * 查询服务凭据设置。
     *
     * 返回说明：
     * - `openai.models` 返回结构化模型列表，并附带占用信息；
     * - 其他字段按当前存储值映射为设置页表单结构。
     */
    public async getServiceCredentialsDetail(): Promise<ServiceCredentialSettingDetailVO> {
        const availableModels = this.parseOpenAiModels(this.getValue('models.openai.available'));
        const modelDetails = this.buildOpenAiModelDetails(availableModels);
        return {
            openai: {
                key: this.getValue('apiKeys.openAi.key'),
                endpoint: this.getValue('apiKeys.openAi.endpoint'),
                models: modelDetails,
            },
            tencent: {
                secretId: this.getValue('apiKeys.tencent.secretId'),
                secretKey: this.getValue('apiKeys.tencent.secretKey'),
            },
            youdao: {
                secretId: this.getValue('apiKeys.youdao.secretId'),
                secretKey: this.getValue('apiKeys.youdao.secretKey'),
            },
        };
    }

    /**
     * 更新服务凭据设置。
     *
     * 行为说明：
     * - `openai.models` 使用结构化数组保存为标准换行文本；
     * - 当前被功能占用的模型禁止删除。
     */
    public async saveServiceCredentials(settings: ServiceCredentialSettingSaveVO): Promise<void> {
        const currentAvailableModels = this.parseOpenAiModels(this.getValue('models.openai.available'));
        const parsedModels = settings.openai.models.map((item) => item.trim());
        if (parsedModels.some((item) => item.length === 0)) {
            throw new Error('openai.models 包含空模型标识');
        }
        const dedupedModels = Array.from(new Set(parsedModels));
        if (dedupedModels.length !== parsedModels.length) {
            throw new Error('openai.models 包含重复模型标识');
        }

        const usageByFeature = this.getOpenAiFeatureModelUsage();
        const removedModels = currentAvailableModels.filter((model) => !dedupedModels.includes(model));
        for (const removedModel of removedModels) {
            for (const feature of Object.keys(usageByFeature) as OpenAiModelUsageFeature[]) {
                if (usageByFeature[feature] === removedModel) {
                    throw new Error(`模型 ${removedModel} 正被功能 ${feature} 使用，不能删除`);
                }
            }
        }

        await this.setValue('apiKeys.openAi.key', settings.openai.key);
        await this.setValue('apiKeys.openAi.endpoint', settings.openai.endpoint);
        await this.setValue('models.openai.available', dedupedModels.join('\n'));

        await this.setValue('apiKeys.tencent.secretId', settings.tencent.secretId);
        await this.setValue('apiKeys.tencent.secretKey', settings.tencent.secretKey);

        await this.setValue('apiKeys.youdao.secretId', settings.youdao.secretId);
        await this.setValue('apiKeys.youdao.secretKey', settings.youdao.secretKey);

    }

    /**
     * 获取功能设置页面详情，按严格模式校验存储值。
     */
    public async getEngineSelectionDetail(): Promise<EngineSelectionSettingVO> {
        const subtitleTranslationEngine = this.requireEnumValue(
            this.getValue('providers.subtitleTranslation'),
            ['openai', 'tencent', 'none'] as const,
            'providers.subtitleTranslation',
        );
        const dictionaryEngine = this.requireEnumValue(
            this.getValue('providers.dictionary'),
            ['openai', 'youdao', 'none'] as const,
            'providers.dictionary',
        );
        const subtitleMode = this.requireEnumValue(
            this.getValue('features.openai.subtitleTranslationMode'),
            ['zh', 'simple_en', 'custom'] as const,
            'features.openai.subtitleTranslationMode',
        );
        const subtitleCustomStyle = this.getValue('features.openai.subtitleCustomStyle');

        return {
            openai: {
                enableSentenceLearning: this.requireBooleanString(
                    this.getValue('features.openai.enableSentenceLearning'),
                    'features.openai.enableSentenceLearning',
                ),
                subtitleTranslationMode: subtitleMode,
                subtitleCustomStyle,
                featureModels: {
                    sentenceLearning: this.getValue('models.openai.sentenceLearning'),
                    subtitleTranslation: this.getValue('models.openai.subtitleTranslation'),
                    dictionary: this.getValue('models.openai.dictionary'),
                },
            },
            providers: {
                subtitleTranslationEngine,
                dictionaryEngine,
            },
        };
    }

    /**
     * 保存功能设置页面数据，不进行静默回退。
     */
    public async saveEngineSelection(settings: EngineSelectionSettingVO): Promise<void> {
        const subtitleTranslationEngine = this.requireEnumValue(
            settings.providers.subtitleTranslationEngine,
            ['openai', 'tencent', 'none'] as const,
            'providers.subtitleTranslationEngine',
        );
        const dictionaryEngine = this.requireEnumValue(
            settings.providers.dictionaryEngine,
            ['openai', 'youdao', 'none'] as const,
            'providers.dictionaryEngine',
        );
        const availableModels = this.parseOpenAiModels(this.getValue('models.openai.available'));
        if (availableModels.length === 0) {
            throw new Error('models.openai.available 为空，无法保存功能模型选择');
        }
        await this.setValue('providers.subtitleTranslation', subtitleTranslationEngine);
        await this.setValue('providers.dictionary', dictionaryEngine);

        const subtitleMode = this.requireEnumValue(
            settings.openai.subtitleTranslationMode,
            ['zh', 'simple_en', 'custom'] as const,
            'openai.subtitleTranslationMode',
        );

        await this.setValue('features.openai.enableSentenceLearning', settings.openai.enableSentenceLearning ? 'true' : 'false');
        await this.setValue('features.openai.subtitleTranslationMode', subtitleMode);
        await this.setValue('features.openai.subtitleCustomStyle', settings.openai.subtitleCustomStyle);

        await this.setValue(
            'models.openai.sentenceLearning',
            this.requireFeatureModelAvailable(
                settings.openai.featureModels.sentenceLearning,
                availableModels,
                'openai.featureModels.sentenceLearning',
            ),
        );
        await this.setValue(
            'models.openai.subtitleTranslation',
            this.requireFeatureModelAvailable(
                settings.openai.featureModels.subtitleTranslation,
                availableModels,
                'openai.featureModels.subtitleTranslation',
            ),
        );
        await this.setValue(
            'models.openai.dictionary',
            this.requireFeatureModelAvailable(
                settings.openai.featureModels.dictionary,
                availableModels,
                'openai.featureModels.dictionary',
            ),
        );
    }

    public async getCurrentSentenceLearningProvider(): Promise<'openai' | null> {
        const openaiEnabled = this.getValue('features.openai.enableSentenceLearning') === 'true';
        return openaiEnabled ? 'openai' : null;
    }

    public async getCurrentTranslationProvider(): Promise<'openai' | 'tencent' | null> {
        const engine = this.normalizeSubtitleEngine(this.getValue('providers.subtitleTranslation'));
        if (engine === 'openai' || engine === 'tencent') {
            return engine;
        }
        return null;
    }

    public async getOpenAiSubtitleTranslationMode(): Promise<'zh' | 'simple_en' | 'custom'> {
        const mode = this.getValue('features.openai.subtitleTranslationMode');
        if (mode === 'simple_en' || mode === 'custom') {
            return mode;
        }
        return 'zh';
    }

    public async getOpenAiSubtitleCustomStyle(): Promise<string> {
        const stored = this.getValue('features.openai.subtitleCustomStyle');
        if (stored && stored.trim().length > 0) {
            return stored.trim();
        }
        return getSubtitleDefaultStyle('custom');
    }

    public async getCurrentDictionaryProvider(): Promise<'openai' | 'youdao' | null> {
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
