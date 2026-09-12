import { SettingKey } from '@/common/types/store_schema';
import { storeGet } from '@/backend/infrastructure/settings/store';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { generateText } from 'ai';
import AiProviderService from '@/backend/services/AiProviderService';
import StrUtil from '@/common/utils/str-util';
import ClientProviderService from '@/backend/services/ClientProviderService';
import { TencentTranslateClient } from '@/backend/services/gateways/translate/TencentTranslateClient';
import { getMainLogger } from '@/backend/infrastructure/logger';
import RendererEvents from '@/backend/services/gateways/renderer/RendererEvents';
import { SettingsStore } from '@/backend/services/gateways/SettingsStore';
import {
    ServiceCredentialSettingDetailVO,
    ServiceCredentialSettingSaveVO,
} from '@/common/types/vo/service-credentials-setting-vo';
import {
    CloudModelUsage,
    computeCloudModelUsage,
    OpenAiModelUsageFeature,
    OPEN_AI_MODEL_USAGE_FEATURES,
} from '@/common/utils/cloud-model-usage';
import { EngineSelectionSettingVO } from '@/common/types/vo/engine-selection-setting-vo';
import { ShortcutSettingDetailVO, ShortcutSettingSaveVO } from '@/common/types/vo/shortcut-setting-vo';
import { ProxySettingDetailVO, ProxySettingSaveVO } from '@/common/contracts/proxy-setting-vo';
import { AppearanceSettingVO } from '@/common/contracts/appearance-setting-vo';
import { StorageSettingVO } from '@/common/contracts/storage-setting-vo';
import { getSubtitleDefaultStyle } from '@/common/constants/openaiSubtitlePrompts';
import { AI_API_FORMATS } from '@/common/utils/cloud-ai-api-format';
import StorageDirectoryProvider from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import type LocalAiService from '@/backend/services/LocalAiService';
import {
    isRuntimeSettingKey,
    runtimeSettingKeys,
    RuntimeSettingSaveRequest,
    RuntimeSettingsSnapshot,
} from '@/common/contracts/runtime-settings';
import { TRANSCRIPTION_ENGINES, TranscriptionEngine } from '@/common/contracts/transcription-engine';

/** 字幕翻译引擎的合法取值；设置校验与运行时查询共用，避免各处字面量漂移。 */
const SUBTITLE_TRANSLATION_ENGINES = ['openai', 'local', 'local-mt', 'tencent', 'none'] as const;
/** 词典引擎的合法取值。 */
const DICTIONARY_ENGINES = ['openai', 'local', 'none'] as const;

/** 功能占用提示与报错文案共用的功能中文名。 */
const OPEN_AI_FEATURE_LABELS: Record<OpenAiModelUsageFeature, string> = {
    sentenceLearning: '整句讲解',
    subtitleTranslation: '字幕翻译',
    dictionary: '词典查词',
};

/** 功能引擎取值（含 'invalid' 占位）。 */
type FeatureEngine =
    | EngineSelectionSettingVO['providers']['subtitleTranslationEngine']
    | EngineSelectionSettingVO['providers']['dictionaryEngine'];

/**
 * 判断某个功能的引擎是否由云端承担。
 *
 * 说明：'invalid' 是存储值非法的占位，此时无从判断，返回 null 让调用方保留用户原值；
 * 只有 openai 会落到云端模型槽位，本地、腾讯与关闭都不需要槽位。
 *
 * @param engine 设置里记着的引擎值。
 * @returns 是否走云端；`null` 表示存储值非法。
 */
const engineUsesCloud = (engine: FeatureEngine): boolean | null => (
    engine === 'invalid' ? null : engine === 'openai'
);

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
    saveTranscriptionEngine(engine: TranscriptionEngine): Promise<void>;
    getShortcutSettingsDetail(): Promise<ShortcutSettingDetailVO>;
    saveShortcutSettings(settings: ShortcutSettingSaveVO): Promise<void>;
    getAppearanceSettingDetail(): Promise<AppearanceSettingVO>;
    saveAppearanceSettings(settings: AppearanceSettingVO): Promise<void>;
    getStorageSettingDetail(): Promise<StorageSettingVO>;
    saveStorageSettings(settings: StorageSettingVO): Promise<void>;
    getProxySettingDetail(): Promise<ProxySettingDetailVO>;
    saveProxySettings(settings: ProxySettingSaveVO): Promise<void>;
    getCurrentSentenceLearningProvider(): Promise<'openai' | null>;
    getCurrentTranslationProvider(): Promise<'openai' | 'local' | 'local-mt' | 'tencent' | null>;
    getOpenAiSubtitleTranslationMode(): Promise<'zh' | 'simple_en' | 'custom'>;
    getOpenAiSubtitleCustomStyle(): Promise<string>;
    getCurrentDictionaryProvider(): Promise<'openai' | 'local' | null>;
    testOpenAi(modelId: string): Promise<{ success: boolean, message: string }>;
    testTencent(): Promise<{ success: boolean, message: string }>;
}


/**
 * 管理设置页数据、运行时设置快照和服务配置查询。
 */
@injectable()
export class SettingServiceImpl implements SettingService {
    @inject(TYPES.RendererEvents) private rendererEvents!: RendererEvents;
    @inject(TYPES.AiProviderService) private aiProviderService!: AiProviderService;
    @inject(TYPES.TencentClientProvider) private tencentProvider!: ClientProviderService<TencentTranslateClient>;
    @inject(TYPES.SettingsStore) private settingsStore!: SettingsStore;
    @inject(TYPES.StorageDirectoryProvider) private storageDirectoryProvider!: StorageDirectoryProvider;
    @inject(TYPES.LocalAiService) private localAi!: LocalAiService;
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
     * 现算当前真正落到云端模型上的功能占用关系。
     *
     * 说明：功能模型槽位只是「上次选的模型」备忘，功能切走引擎或关闭后不会
     * 被清理，直接读槽位会把残留值当成占用、导致模型删不掉。占用是引擎
     * 配置与功能开关推导出的事实，规则在 computeCloudModelUsage 一份纯函数
     * 里，与前端「使用中」角标共用。
     */
    private getOpenAiFeatureModelUsage(): CloudModelUsage {
        return computeCloudModelUsage({
            sentenceLearningEnabled: this.getValue('features.openai.enableSentenceLearning') === 'true',
            subtitleTranslationEngine: this.getValue('providers.subtitleTranslation'),
            dictionaryEngine: this.getValue('providers.dictionary'),
            modelSlots: {
                sentenceLearning: this.getValue('models.openai.sentenceLearning'),
                subtitleTranslation: this.getValue('models.openai.subtitleTranslation'),
                dictionary: this.getValue('models.openai.dictionary'),
            },
        });
    }

    /**
     * 解析功能槽位最终要写入的云端模型。
     *
     * 说明：槽位是「上次选的模型」备忘，只在功能由云端承担时才有意义——
     * 引擎切走或功能关闭时写入空字符串，保持备忘与现状一致；占用判定由
     * getOpenAiFeatureModelUsage 现算，不依赖这里是否清理。真正走云端的
     * 功能则必须指向一个可用模型，缺失或已失效直接报错，
     * 不静默换成列表里的第一个模型。
     *
     * @param candidate 槽位里记着的模型标识。
     * @param availableModels 当前可用模型列表。
     * @param usesCloud 该功能当前是否由云端承担；`null` 表示引擎存储值非法（'invalid' 占位）无从判断。
     * @param featureLabel 功能中文名，用于报错文案。
     * @returns 要写入槽位的模型标识；功能不落云端时为空字符串。
     * @throws 功能走云端、但槽位为空或已不在可用列表时抛出。
     */
    private resolveFeatureModelSlot(
        candidate: string,
        availableModels: string[],
        usesCloud: boolean | null,
        featureLabel: string,
    ): string {
        // 引擎存储值非法时无从判断是否走云端：原样保留，不把用户记着的模型清掉
        if (usesCloud === null) {
            return candidate;
        }
        if (!usesCloud) {
            return '';
        }
        if (!candidate || !availableModels.includes(candidate)) {
            throw new Error(`${featureLabel}还没选好云端模型，请先在「可用模型」里选一个`);
        }
        return candidate;
    }

    /**
     * 查询渲染进程启动所需的非敏感设置。
     *
     * 枚举字段的存储值非法时不抛错：记录告警并原样透传，避免单个坏值
     * 导致渲染进程拿不到整份快照；用户提示与修复入口在渲染进程和设置页。
     *
     * @returns 完整运行时设置快照。
     */
    public async getRuntimeSettings(): Promise<RuntimeSettingsSnapshot> {
        const values = Object.fromEntries(
            runtimeSettingKeys.map((key) => [key, this.getValue(key)]),
        ) as RuntimeSettingsSnapshot;

        // 运行时快照承载渲染进程整体初始化（主题、语言、快捷键等），单个坏值
        // （常见于多分支开发后枚举残留）不允许阻断整份快照下发。
        // 非法值原样透传，由渲染进程窄化检查后显式提示用户去设置页修复。
        this.warnInvalidEnum(values['appearance.theme'], ['dark', 'light'] as const, 'appearance.theme');
        this.warnInvalidEnum(
            values['appearance.fontSize'],
            ['fontSizeSmall', 'fontSizeMedium', 'fontSizeLarge'] as const,
            'appearance.fontSize',
        );
        this.warnInvalidEnum(values['i18n.language'], ['system', 'zh-CN', 'en-US'] as const, 'i18n.language');
        this.warnInvalidEnum(values['player.autoPlayNext'], ['true', 'false'] as const, 'player.autoPlayNext');
        this.warnInvalidEnum(
            values['providers.subtitleTranslation'],
            SUBTITLE_TRANSLATION_ENGINES,
            'providers.subtitleTranslation',
        );
        this.warnInvalidEnum(values['providers.dictionary'], DICTIONARY_ENGINES, 'providers.dictionary');
        this.warnInvalidEnum(
            values['features.openai.subtitleTranslationMode'],
            ['zh', 'simple_en', 'custom'] as const,
            'features.openai.subtitleTranslationMode',
        );
        if (!this.isValidPlaybackRateStack(values['userSelect.playbackRateStack'])) {
            this.logger.warn(
                `设置项 userSelect.playbackRateStack 存储值非法: ${values['userSelect.playbackRateStack']}`,
            );
        }
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
                if (!this.isValidPlaybackRateStack(value)) {
                    throw new Error(`设置项 userSelect.playbackRateStack 非法: ${value}`);
                }
                break;
            default:
                throw new Error(`不允许直接修改运行时设置: ${String(request.key)}`);
        }
        await this.setValue(request.key, value);
    }

    /**
     * 枚举设置存储值非法时记录告警。
     *
     * 与 {@link requireEnumValue} 的区别：不阻断调用方，用于允许带病透传、
     * 由上层显式提示用户修复的场景。
     */
    private warnInvalidEnum(value: string, allowedValues: readonly string[], fieldName: string): void {
        if (!allowedValues.includes(value)) {
            this.logger.warn(`设置项 ${fieldName} 存储值非法: ${value}`);
        }
    }

    /**
     * 读取枚举设置；存储值非法时返回 `'invalid'` 占位并记入 `invalidValues`。
     *
     * 用于设置页详情读取：页面必须能打开让用户重新选择，同时通过
     * `invalidValues` 显式暴露原始坏值，不做静默纠偏。
     *
     * @param value 存储的原始值。
     * @param allowedValues 当前版本的合法枚举。
     * @param fieldName 设置仓库键，用于日志与 `invalidValues`。
     * @param invalidValues 收集非法项的容器。
     * @returns 合法值或 `'invalid'` 占位。
     */
    private readEnumOrInvalid<TValue extends string>(
        value: string,
        allowedValues: readonly TValue[],
        fieldName: string,
        invalidValues: Record<string, string>,
    ): TValue | 'invalid' {
        if (allowedValues.includes(value as TValue)) {
            return value as TValue;
        }
        this.logger.warn(`设置项 ${fieldName} 存储值非法: ${value}，等待用户在设置页重新选择`);
        invalidValues[fieldName] = value;
        return 'invalid';
    }

    /**
     * 判断常用播放速度列表的序列化值是否合法。
     *
     * @param value 逗号分隔的播放速度；空字符串表示未配置，视为合法。
     */
    private isValidPlaybackRateStack(value: string): boolean {
        if (value.length === 0) {
            return true;
        }
        const allowedRates = new Set(['0.25', '0.5', '0.75', '1', '1.25', '1.5', '1.75', '2']);
        const rates = value.split(',');
        return !rates.some((rate) => !allowedRates.has(rate)) && new Set(rates).size === rates.length;
    }

    /**
     * 保存本地语音识别引擎设置，非法值立即抛错。
     */
    public async saveTranscriptionEngine(engine: TranscriptionEngine): Promise<void> {
        const validated = this.requireEnumValue(engine, TRANSCRIPTION_ENGINES, 'transcription.engine');
        this.logger.info('update transcription engine', { engine: validated });
        await this.setValue('transcription.engine', validated);
    }

    /**
     * 查询服务凭据设置。
     *
     * 返回说明：模型列表只含标识；占用由前端按引擎选择现算（computeCloudModelUsage），
     * 不随详情快照下发，其他字段按当前存储值映射为设置页表单结构。
     */
    public async getServiceCredentialsDetail(): Promise<ServiceCredentialSettingDetailVO> {
        const availableModels = this.parseOpenAiModels(this.getValue('models.openai.available'));
        return {
            openai: {
                key: this.getValue('apiKeys.openAi.key'),
                endpoint: this.getValue('apiKeys.openAi.endpoint'),
                apiFormat: this.requireEnumValue(
                    this.getValue('apiKeys.openAi.apiFormat'),
                    AI_API_FORMATS,
                    'apiKeys.openAi.apiFormat',
                ),
                models: availableModels,
            },
            tencent: {
                secretId: this.getValue('apiKeys.tencent.secretId'),
                secretKey: this.getValue('apiKeys.tencent.secretKey'),
            },
        };
    }

    /**
     * 更新服务凭据设置。
     *
     * 行为说明：
     * - `openai.models` 使用结构化数组保存为标准换行文本；
     * - 被云端功能实际占用的模型禁止删除，占用按引擎配置与功能开关现算
     *   （见 getOpenAiFeatureModelUsage）。
     */
    public async saveServiceCredentials(settings: ServiceCredentialSettingSaveVO): Promise<void> {
        const currentAvailableModels = this.parseOpenAiModels(this.getValue('models.openai.available'));
        const apiFormat = this.requireEnumValue(settings.openai.apiFormat, AI_API_FORMATS, 'openai.apiFormat');
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
            for (const feature of OPEN_AI_MODEL_USAGE_FEATURES) {
                if (usageByFeature[feature] === removedModel) {
                    throw new Error(`「${removedModel}」正被「${OPEN_AI_FEATURE_LABELS[feature]}」使用，请先在功能设置中更换模型或切换引擎`);
                }
            }
        }

        await this.setValue('apiKeys.openAi.key', settings.openai.key);
        await this.setValue('apiKeys.openAi.endpoint', settings.openai.endpoint);
        await this.setValue('apiKeys.openAi.apiFormat', apiFormat);
        await this.setValue('models.openai.available', dedupedModels.join('\n'));

        await this.setValue('apiKeys.tencent.secretId', settings.tencent.secretId);
        await this.setValue('apiKeys.tencent.secretKey', settings.tencent.secretKey);


    }

    /**
     * 获取功能设置页面详情。
     *
     * 枚举字段的存储值非法时不抛错：返回 `'invalid'` 占位并把原始值记入
     * `invalidValues`，保证设置页能打开且坏值被显式暴露，等待用户重新选择。
     */
    public async getEngineSelectionDetail(): Promise<EngineSelectionSettingVO> {
        const invalidValues: EngineSelectionSettingVO['invalidValues'] = {};
        const subtitleTranslationEngine = this.readEnumOrInvalid(
            this.getValue('providers.subtitleTranslation'),
            SUBTITLE_TRANSLATION_ENGINES,
            'providers.subtitleTranslation',
            invalidValues,
        );
        const dictionaryEngine = this.readEnumOrInvalid(
            this.getValue('providers.dictionary'),
            DICTIONARY_ENGINES,
            'providers.dictionary',
            invalidValues,
        );
        const subtitleMode = this.readEnumOrInvalid(
            this.getValue('features.openai.subtitleTranslationMode'),
            ['zh', 'simple_en', 'custom'] as const,
            'features.openai.subtitleTranslationMode',
            invalidValues,
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
            invalidValues,
        };
    }

    /**
     * 保存功能设置页面数据，不进行静默回退。
     *
     * 枚举字段为 `'invalid'` 占位时跳过对应键，保留原存储值（仍非法），
     * 其余字段正常保存；用户重新选择合法值后才会写回。
     *
     * 功能模型槽位只是「上次选的模型」备忘：引擎切走或功能关闭时写入空值
     * 保持备忘与现状一致（见 resolveFeatureModelSlot）；占用判定另有现算
     * （getOpenAiFeatureModelUsage），不依赖槽位是否被清理。
     */
    public async saveEngineSelection(settings: EngineSelectionSettingVO): Promise<void> {
        if (settings.providers.subtitleTranslationEngine === 'invalid') {
            this.logger.warn('providers.subtitleTranslationEngine 为非法占位值，跳过保存并保留原存储值');
        } else {
            await this.setValue(
                'providers.subtitleTranslation',
                this.requireEnumValue(
                    settings.providers.subtitleTranslationEngine,
                    SUBTITLE_TRANSLATION_ENGINES,
                    'providers.subtitleTranslationEngine',
                ),
            );
        }
        if (settings.providers.dictionaryEngine === 'invalid') {
            this.logger.warn('providers.dictionaryEngine 为非法占位值，跳过保存并保留原存储值');
        } else {
            await this.setValue(
                'providers.dictionary',
                this.requireEnumValue(
                    settings.providers.dictionaryEngine,
                    DICTIONARY_ENGINES,
                    'providers.dictionaryEngine',
                ),
            );
        }
        // 引擎切换即时反映到本地模型常驻策略：切到 local 后台预加载，切走后恢复空闲卸载。
        this.localAi.syncEngineResidency();
        const availableModels = this.parseOpenAiModels(this.getValue('models.openai.available'));
        if (availableModels.length === 0) {
            throw new Error('models.openai.available 为空，无法保存功能模型选择');
        }

        await this.setValue('features.openai.enableSentenceLearning', settings.openai.enableSentenceLearning ? 'true' : 'false');
        if (settings.openai.subtitleTranslationMode === 'invalid') {
            this.logger.warn('openai.subtitleTranslationMode 为非法占位值，跳过保存并保留原存储值');
        } else {
            await this.setValue(
                'features.openai.subtitleTranslationMode',
                this.requireEnumValue(
                    settings.openai.subtitleTranslationMode,
                    ['zh', 'simple_en', 'custom'] as const,
                    'openai.subtitleTranslationMode',
                ),
            );
        }
        await this.setValue('features.openai.subtitleCustomStyle', settings.openai.subtitleCustomStyle);

        await this.setValue(
            'models.openai.sentenceLearning',
            this.resolveFeatureModelSlot(
                settings.openai.featureModels.sentenceLearning,
                availableModels,
                settings.openai.enableSentenceLearning,
                '整句讲解',
            ),
        );
        await this.setValue(
            'models.openai.subtitleTranslation',
            this.resolveFeatureModelSlot(
                settings.openai.featureModels.subtitleTranslation,
                availableModels,
                engineUsesCloud(settings.providers.subtitleTranslationEngine),
                '字幕翻译',
            ),
        );
        await this.setValue(
            'models.openai.dictionary',
            this.resolveFeatureModelSlot(
                settings.openai.featureModels.dictionary,
                availableModels,
                engineUsesCloud(settings.providers.dictionaryEngine),
                '词典查词',
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

    public async getCurrentTranslationProvider(): Promise<'openai' | 'local' | 'local-mt' | 'tencent' | null> {
        const engine = this.requireEnumValue(
            this.getValue('providers.subtitleTranslation'),
            SUBTITLE_TRANSLATION_ENGINES,
            'providers.subtitleTranslation',
        );
        if (engine === 'local' || engine === 'openai' || engine === 'tencent' || engine === 'local-mt') {
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

    public async getCurrentDictionaryProvider(): Promise<'openai' | 'local' | null> {
        const engine = this.requireEnumValue(
            this.getValue('providers.dictionary'),
            DICTIONARY_ENGINES,
            'providers.dictionary',
        );
        if (engine === 'local' || engine === 'openai') {
            return engine;
        }
        return null;
    }

    /**
     * 测试指定 OpenAI 模型的连通性。
     *
     * 只测试用户选中的单个模型，不涉及功能路由：模型必须仍在可用模型列表中，
     * 否则直接失败，避免“密钥没问题但选了个已删除的模型”这类误判。
     *
     * @param modelId 待测试的模型标识。
     * @returns 测试结果；密钥/地址缺失或调用失败时 success 为 false。
     */
    public async testOpenAi(modelId: string): Promise<{ success: boolean, message: string }> {
        try {
            this.logger.info('testing openai connection', { model: modelId });
            const apiKey = storeGet('apiKeys.openAi.key');
            const endpoint = storeGet('apiKeys.openAi.endpoint');
            if (StrUtil.hasBlank(apiKey, endpoint)) {
                return { success: false, message: 'OpenAI 密钥或接口地址未配置' };
            }
            const availableModels = this.parseOpenAiModels(this.getValue('models.openai.available'));
            if (!availableModels.includes(modelId)) {
                return { success: false, message: '模型未在服务配置中启用' };
            }
            const model = this.aiProviderService.createModelById(modelId);
            // 推理类模型（如 deepseek-flash）会先把额度花在 reasoning_content 上，
            // 5 个 token 时正文必为空且 finish_reason=length，连通性被误判为失败
            const result = await generateText({
                model,
                prompt: 'Hello',
                maxOutputTokens: 50,
            });

            if (StrUtil.isNotBlank(result.text)) {
                this.logger.info('openai test successful', { model: modelId });
                return { success: true, message: '测试成功' };
            }
            this.logger.warn('openai returned empty response', { model: modelId });
            return { success: false, message: '返回了空响应' };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error('openai test failed', { model: modelId, error: message });
            return { success: false, message: `测试失败: ${message}` };
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

}
