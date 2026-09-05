import { SettingKey } from '@/common/types/store_schema';
import { storeGet } from '@/backend/infrastructure/settings/store';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { generateText } from 'ai';
import AiProviderService from '@/backend/services/AiProviderService';
import StrUtil from '@/common/utils/str-util';
import ClientProviderService from '@/backend/services/ClientProviderService';
import { TencentTranslateClient } from '@/backend/services/gateways/translate/TencentTranslateClient';
import { YouDaoDictionaryClient } from '@/backend/services/gateways/translate/YouDaoDictionaryClient';
import { getMainLogger } from '@/backend/infrastructure/logger';
import RendererEvents from '@/backend/services/gateways/renderer/RendererEvents';
import { SettingsStore } from '@/backend/services/gateways/SettingsStore';
import {
    OpenAiAvailableModelDetailVO,
    OpenAiModelUsageFeature,
    ServiceCredentialSettingDetailVO,
    ServiceCredentialSettingSaveVO,
} from '@/common/types/vo/service-credentials-setting-vo';
import { EngineSelectionSettingVO } from '@/common/types/vo/engine-selection-setting-vo';
import { ShortcutSettingDetailVO, ShortcutSettingSaveVO } from '@/common/types/vo/shortcut-setting-vo';
import { ProxySettingDetailVO, ProxySettingSaveVO } from '@/common/contracts/proxy-setting-vo';
import { AppearanceSettingVO } from '@/common/contracts/appearance-setting-vo';
import { StorageSettingVO } from '@/common/contracts/storage-setting-vo';
import { getSubtitleDefaultStyle } from '@/common/constants/openaiSubtitlePrompts';
import ModelRoutingService from '@/backend/services/ModelRoutingService';
import StorageDirectoryProvider from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import {
    isRuntimeSettingKey,
    runtimeSettingKeys,
    RuntimeSettingSaveRequest,
    RuntimeSettingsSnapshot,
} from '@/common/contracts/runtime-settings';

/**
 * 管理设置页数据和渲染进程需要的非敏感运行时设置。
 */
export default interface SettingService {
    getRuntimeSettings(): Promise<RuntimeSettingsSnapshot>;
    saveRuntimeSetting(request: RuntimeSettingSaveRequest): Promise<void>;
    getServiceCredentialsDetail(): Promise<ServiceCredentialSettingDetailVO>;
    saveServiceCredentials(settings: ServiceCredentialSettingSaveVO): Promise<void>;
    getEngineSelectionDetail(): Promise<EngineSelectionSettingVO>;
    saveEngineSelection(settings: EngineSelectionSettingVO): Promise<void>;
    getShortcutSettingsDetail(): Promise<ShortcutSettingDetailVO>;
    saveShortcutSettings(settings: ShortcutSettingSaveVO): Promise<void>;
    getAppearanceSettingDetail(): Promise<AppearanceSettingVO>;
    saveAppearanceSettings(settings: AppearanceSettingVO): Promise<void>;
    getStorageSettingDetail(): Promise<StorageSettingVO>;
    saveStorageSettings(settings: StorageSettingVO): Promise<void>;
    getProxySettingDetail(): Promise<ProxySettingDetailVO>;
    saveProxySettings(settings: ProxySettingSaveVO): Promise<void>;
    getCurrentSentenceLearningProvider(): Promise<'openai' | null>;
    getCurrentTranslationProvider(): Promise<'openai' | 'tencent' | null>;
    getOpenAiSubtitleTranslationMode(): Promise<'zh' | 'simple_en' | 'custom'>;
    getOpenAiSubtitleCustomStyle(): Promise<string>;
    getCurrentDictionaryProvider(): Promise<'openai' | 'youdao' | null>;
    testOpenAi(): Promise<{ success: boolean, message: string }>;
    testTencent(): Promise<{ success: boolean, message: string }>;
    testYoudao(): Promise<{ success: boolean, message: string }>;
}


/**
 * 管理设置页数据、运行时设置快照和服务配置查询。
 */
@injectable()
export class SettingServiceImpl implements SettingService {
    @inject(TYPES.RendererEvents) private rendererEvents!: RendererEvents;
    @inject(TYPES.AiProviderService) private aiProviderService!: AiProviderService;
    @inject(TYPES.TencentClientProvider) private tencentProvider!: ClientProviderService<TencentTranslateClient>;
    @inject(TYPES.YouDaoClientProvider) private youDaoProvider!: ClientProviderService<YouDaoDictionaryClient>;
    @inject(TYPES.SettingsStore) private settingsStore!: SettingsStore;
    @inject(TYPES.ModelRoutingService) private modelRoutingService!: ModelRoutingService;
    @inject(TYPES.StorageDirectoryProvider) private storageDirectoryProvider!: StorageDirectoryProvider;
    private logger = getMainLogger('SettingServiceImpl');

    /**
     * 写入设置，并仅向渲染进程推送非敏感运行时设置。
     *
     * @param key 设置键。
     * @param value 设置值。
     */
    private async setValue(key: SettingKey, value: string): Promise<void> {
        if (this.settingsStore.set(key, value)) {
            if (isRuntimeSettingKey(key)) {
                this.rendererEvents.storeUpdate(key, value);
            }
        }
    }

    /**
     * 读取设置仓库中的原始字符串值。
     *
     * @param key 设置键。
     * @returns 当前设置值。
     */
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

    /**
     * 查询渲染进程启动所需的非敏感设置，并严格校验有枚举约束的字段。
     *
     * @returns 完整运行时设置快照。
     */
    public async getRuntimeSettings(): Promise<RuntimeSettingsSnapshot> {
        const values = Object.fromEntries(
            runtimeSettingKeys.map((key) => [key, this.getValue(key)]),
        ) as RuntimeSettingsSnapshot;

        values['appearance.theme'] = this.requireEnumValue(
            values['appearance.theme'],
            ['dark', 'light'] as const,
            'appearance.theme',
        );
        values['appearance.fontSize'] = this.requireEnumValue(
            values['appearance.fontSize'],
            ['fontSizeSmall', 'fontSizeMedium', 'fontSizeLarge'] as const,
            'appearance.fontSize',
        );
        values['i18n.language'] = this.requireEnumValue(
            values['i18n.language'],
            ['system', 'zh-CN', 'en-US'] as const,
            'i18n.language',
        );
        values['player.autoPlayNext'] = this.requireBooleanString(
            values['player.autoPlayNext'],
            'player.autoPlayNext',
        ) ? 'true' : 'false';
        values['providers.subtitleTranslation'] = this.requireEnumValue(
            values['providers.subtitleTranslation'],
            ['openai', 'tencent', 'none'] as const,
            'providers.subtitleTranslation',
        );
        values['providers.dictionary'] = this.requireEnumValue(
            values['providers.dictionary'],
            ['openai', 'youdao', 'none'] as const,
            'providers.dictionary',
        );
        values['features.openai.subtitleTranslationMode'] = this.requireEnumValue(
            values['features.openai.subtitleTranslationMode'],
            ['zh', 'simple_en', 'custom'] as const,
            'features.openai.subtitleTranslationMode',
        );
        this.requirePlaybackRateStack(values['userSelect.playbackRateStack']);
        return values;
    }

    /**
     * 保存播放器运行期间允许直接修改的设置。
     *
     * @param request 设置键和值。
     */
    public async saveRuntimeSetting(request: RuntimeSettingSaveRequest): Promise<void> {
        let value = request.value;
        switch (request.key) {
            case 'appearance.theme':
                value = this.requireEnumValue(value, ['dark', 'light'] as const, request.key);
                break;
            case 'player.autoPlayNext':
                value = this.requireBooleanString(value, request.key) ? 'true' : 'false';
                break;
            case 'userSelect.playbackRateStack':
                this.requirePlaybackRateStack(value);
                break;
            default:
                throw new Error(`不允许直接修改运行时设置: ${String(request.key)}`);
        }
        await this.setValue(request.key, value);
    }

    /**
     * 校验常用播放速度列表的序列化值。
     *
     * @param value 逗号分隔的播放速度。
     */
    private requirePlaybackRateStack(value: string): void {
        if (value.length === 0) {
            return;
        }
        const allowedRates = new Set(['0.25', '0.5', '0.75', '1', '1.25', '1.5', '1.75', '2']);
        const rates = value.split(',');
        if (rates.some((rate) => !allowedRates.has(rate)) || new Set(rates).size !== rates.length) {
            throw new Error(`设置项 userSelect.playbackRateStack 非法: ${value}`);
        }
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
                autoAppendV1: this.requireBooleanString(
                    this.getValue('apiKeys.openAi.autoAppendV1'),
                    'apiKeys.openAi.autoAppendV1',
                ),
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
        if (typeof settings.openai.autoAppendV1 !== 'boolean') {
            throw new Error('openai.autoAppendV1 必须为布尔值');
        }
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
        await this.setValue('apiKeys.openAi.autoAppendV1', settings.openai.autoAppendV1 ? 'true' : 'false');
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

    /**
     * 提取代理地址的主机部分用于日志；含凭据或解析失败时整体掩码。
     *
     * @param url 代理地址。
     * @returns 掩码后的日志摘要。
     */
    private extractProxyHost(url: string): string {
        try {
            const parsed = new URL(url);
            if (parsed.username || parsed.password) {
                return '***';
            }
            return `${parsed.protocol}//${parsed.host}`;
        } catch {
            return url ? '***' : '';
        }
    }

    /**
     * 查询快捷键设置详情。
     */
    public async getShortcutSettingsDetail(): Promise<ShortcutSettingDetailVO> {
        return {
            previousSentence: this.getValue('shortcut.previousSentence'),
            nextSentence: this.getValue('shortcut.nextSentence'),
            repeatSentence: this.getValue('shortcut.repeatSentence'),
            playPause: this.getValue('shortcut.playPause'),
            repeatSingleSentence: this.getValue('shortcut.repeatSingleSentence'),
            autoPause: this.getValue('shortcut.autoPause'),
            toggleEnglishDisplay: this.getValue('shortcut.toggleEnglishDisplay'),
            toggleChineseDisplay: this.getValue('shortcut.toggleChineseDisplay'),
            toggleBilingualDisplay: this.getValue('shortcut.toggleBilingualDisplay'),
            toggleWordLevelDisplay: this.getValue('shortcut.toggleWordLevelDisplay'),
            nextTheme: this.getValue('shortcut.nextTheme'),
            adjustBeginMinus: this.getValue('shortcut.adjustBeginMinus'),
            adjustBeginPlus: this.getValue('shortcut.adjustBeginPlus'),
            adjustEndMinus: this.getValue('shortcut.adjustEndMinus'),
            adjustEndPlus: this.getValue('shortcut.adjustEndPlus'),
            clearAdjust: this.getValue('shortcut.clearAdjust'),
            nextPlaybackRate: this.getValue('shortcut.nextPlaybackRate'),
            aiChat: this.getValue('shortcut.aiChat'),
            addClip: this.getValue('shortcut.addClip'),
            openControlPanel: this.getValue('shortcut.openControlPanel'),
        };
    }

    /**
     * 保存快捷键设置。
     *
     * 说明：
     * - 快捷键允许空字符串，表示显式取消绑定；
     * - 字段结构固定，逐项写入以保持键名映射集中在一处。
     */
    public async saveShortcutSettings(settings: ShortcutSettingSaveVO): Promise<void> {
        this.logger.info('update shortcut settings', {
            configured: Object.values(settings).filter((value) => value).length,
            total: Object.keys(settings).length,
        });
        await this.setValue('shortcut.previousSentence', settings.previousSentence);
        await this.setValue('shortcut.nextSentence', settings.nextSentence);
        await this.setValue('shortcut.repeatSentence', settings.repeatSentence);
        await this.setValue('shortcut.playPause', settings.playPause);
        await this.setValue('shortcut.repeatSingleSentence', settings.repeatSingleSentence);
        await this.setValue('shortcut.autoPause', settings.autoPause);
        await this.setValue('shortcut.toggleEnglishDisplay', settings.toggleEnglishDisplay);
        await this.setValue('shortcut.toggleChineseDisplay', settings.toggleChineseDisplay);
        await this.setValue('shortcut.toggleBilingualDisplay', settings.toggleBilingualDisplay);
        await this.setValue('shortcut.toggleWordLevelDisplay', settings.toggleWordLevelDisplay);
        await this.setValue('shortcut.nextTheme', settings.nextTheme);
        await this.setValue('shortcut.adjustBeginMinus', settings.adjustBeginMinus);
        await this.setValue('shortcut.adjustBeginPlus', settings.adjustBeginPlus);
        await this.setValue('shortcut.adjustEndMinus', settings.adjustEndMinus);
        await this.setValue('shortcut.adjustEndPlus', settings.adjustEndPlus);
        await this.setValue('shortcut.clearAdjust', settings.clearAdjust);
        await this.setValue('shortcut.nextPlaybackRate', settings.nextPlaybackRate);
        await this.setValue('shortcut.aiChat', settings.aiChat);
        await this.setValue('shortcut.addClip', settings.addClip);
        await this.setValue('shortcut.openControlPanel', settings.openControlPanel);
    }

    /**
     * 查询外观设置详情，严格校验存储值。
     */
    public async getAppearanceSettingDetail(): Promise<AppearanceSettingVO> {
        return {
            theme: this.requireEnumValue(
                this.getValue('appearance.theme'),
                ['dark', 'light'] as const,
                'appearance.theme',
            ),
            fontSize: this.requireEnumValue(
                this.getValue('appearance.fontSize'),
                ['fontSizeSmall', 'fontSizeMedium', 'fontSizeLarge'] as const,
                'appearance.fontSize',
            ),
            language: this.requireEnumValue(
                this.getValue('i18n.language'),
                ['system', 'zh-CN', 'en-US'] as const,
                'i18n.language',
            ),
        };
    }

    /**
     * 保存外观设置，枚举值非法时立即抛错。
     */
    public async saveAppearanceSettings(settings: AppearanceSettingVO): Promise<void> {
        const theme = this.requireEnumValue(settings.theme, ['dark', 'light'] as const, 'appearance.theme');
        const fontSize = this.requireEnumValue(
            settings.fontSize,
            ['fontSizeSmall', 'fontSizeMedium', 'fontSizeLarge'] as const,
            'appearance.fontSize',
        );
        const language = this.requireEnumValue(
            settings.language,
            ['system', 'zh-CN', 'en-US'] as const,
            'i18n.language',
        );
        this.logger.info('update appearance settings', { theme, fontSize, language });
        await this.setValue('appearance.theme', theme);
        await this.setValue('appearance.fontSize', fontSize);
        await this.setValue('i18n.language', language);
    }

    /**
     * 查询存储设置详情。
     */
    public async getStorageSettingDetail(): Promise<StorageSettingVO> {
        return {
            path: this.getValue('storage.path'),
        };
    }

    /**
     * 保存存储设置。
     *
     * 行为说明：
     * - 非空路径会先做根目录可用性校验，不可用时抛出显式错误；
     * - 空路径表示回落到默认媒体库目录，直接写入。
     */
    public async saveStorageSettings(settings: StorageSettingVO): Promise<void> {
        const nextPath = settings.path.trim();
        this.logger.info('update storage settings', { path: nextPath });
        if (nextPath.length > 0) {
            const status = await this.storageDirectoryProvider.getRootStatus(nextPath);
            if (!status.available) {
                throw new Error(status.message);
            }
        }
        await this.setValue('storage.path', settings.path);
    }

    /**
     * 查询代理设置详情，严格校验代理模式。
     */
    public async getProxySettingDetail(): Promise<ProxySettingDetailVO> {
        return {
            mode: this.requireEnumValue(
                this.getValue('proxy.mode'),
                ['system', 'custom', 'none'] as const,
                'proxy.mode',
            ),
            url: this.getValue('proxy.url'),
            bypassRules: this.getValue('proxy.bypass_rules'),
        };
    }

    /**
     * 保存代理设置，写入后由代理订阅自动重应用。
     */
    public async saveProxySettings(settings: ProxySettingSaveVO): Promise<void> {
        const mode = this.requireEnumValue(settings.mode, ['system', 'custom', 'none'] as const, 'proxy.mode');
        this.logger.info('update proxy settings', { mode, host: this.extractProxyHost(settings.url) });
        await this.setValue('proxy.mode', mode);
        await this.setValue('proxy.url', settings.url);
        await this.setValue('proxy.bypass_rules', settings.bypassRules);
    }

    public async getCurrentSentenceLearningProvider(): Promise<'openai' | null> {
        const openaiEnabled = this.getValue('features.openai.enableSentenceLearning') === 'true';
        return openaiEnabled ? 'openai' : null;
    }

    public async getCurrentTranslationProvider(): Promise<'openai' | 'tencent' | null> {
        const engine = this.requireEnumValue(
            this.getValue('providers.subtitleTranslation'),
            ['openai', 'tencent', 'none'] as const,
            'providers.subtitleTranslation',
        );
        if (engine === 'openai' || engine === 'tencent') {
            return engine;
        }
        return null;
    }

    public async getOpenAiSubtitleTranslationMode(): Promise<'zh' | 'simple_en' | 'custom'> {
        return this.requireEnumValue(
            this.getValue('features.openai.subtitleTranslationMode'),
            ['zh', 'simple_en', 'custom'] as const,
            'features.openai.subtitleTranslationMode',
        );
    }

    public async getOpenAiSubtitleCustomStyle(): Promise<string> {
        const stored = this.getValue('features.openai.subtitleCustomStyle');
        if (stored && stored.trim().length > 0) {
            return stored.trim();
        }
        return getSubtitleDefaultStyle('custom');
    }

    public async getCurrentDictionaryProvider(): Promise<'openai' | 'youdao' | null> {
        const engine = this.requireEnumValue(
            this.getValue('providers.dictionary'),
            ['openai', 'youdao', 'none'] as const,
            'providers.dictionary',
        );
        if (engine === 'openai' || engine === 'youdao') {
            return engine;
        }
        return null;
    }

    public async testOpenAi(): Promise<{ success: boolean, message: string }> {
        try {
            this.logger.info('testing openai connection');
            const apiKey = storeGet('apiKeys.openAi.key');
            const endpoint = storeGet('apiKeys.openAi.endpoint');
            if (StrUtil.hasBlank(apiKey, endpoint)) {
                return { success: false, message: 'OpenAI 密钥或接口地址未配置' };
            }
            const routedModel = this.modelRoutingService.resolveOpenAiModel('sentenceLearning');
            if (!routedModel || StrUtil.isBlank(routedModel.modelId)) {
                return { success: false, message: 'OpenAI 模型未配置，请先在功能设置中选择模型' };
            }
            const model = this.aiProviderService.createModelById(routedModel.modelId);
            const result = await generateText({
                model,
                prompt: 'Hello',
                maxOutputTokens: 5,
            });

            if (StrUtil.isNotBlank(result.text)) {
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
