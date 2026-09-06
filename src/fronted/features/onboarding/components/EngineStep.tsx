import React from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { CloudCog, Cpu, Download, Loader2, Square } from 'lucide-react';
import { Button } from '@/fronted/components/ui/button';
import { Input } from '@/fronted/components/ui/input';
import { Label } from '@/fronted/components/ui/label';
import { Progress } from '@/fronted/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/fronted/components/ui/card';
import { cn } from '@/fronted/lib/utils';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import type { EngineSelectionSettingVO } from '@/common/types/vo/engine-selection-setting-vo';
import type { ServiceCredentialSettingDetailVO, ServiceCredentialSettingSaveVO } from '@/common/types/vo/service-credentials-setting-vo';
import type { LocalAiModelStatus, LocalAiStatus } from '@/common/contracts/local-ai';
import { LOCAL_AI_DEFAULT_MODEL_ID } from '@/common/contracts/local-ai';
import type { OnboardingEngineChoice } from '../types';

/** 引擎步骤的数据上下文：由引导页统一加载后传入，避免各步骤重复请求。 */
export interface EngineStepProps {
    /** 引擎选择设置详情；未加载完成前本地应用按钮不可用。 */
    engineDetail: EngineSelectionSettingVO | null;
    /** 服务凭据详情，用于预填云端表单。 */
    credentialDetail: ServiceCredentialSettingDetailVO | null;
    /** 引擎配置完成后的回调。 */
    onApplied: (choice: OnboardingEngineChoice) => void;
}

/** 从本地模型状态推导用于展示的下载百分比；无总量时不显示百分比。 */
const modelPercent = (model: LocalAiModelStatus): number | null => {
    if (model.phase !== 'downloading' || model.total <= 0) {
        return null;
    }
    return Math.min(100, Math.round((model.downloaded / model.total) * 100));
};

/**
 * 引导第二步：选择 AI 能力来源（本地引擎或云端 API），并完成默认引擎设置。
 *
 * 本地路径内嵌模型下载与进度展示，应用时把字幕翻译与词典引擎一并切到本地；
 * 云端路径保存 OpenAI 兼容凭据并把两个引擎切到 OpenAI。两条路径都复用
 * 设置页已校验的保存接口，不在此重复业务校验。
 */
const EngineStep = ({ engineDetail, credentialDetail, onApplied }: EngineStepProps) => {
    const { t } = useTranslation('onboarding');

    /** 用户当前选中的路线；null 表示尚未选择。 */
    const [choice, setChoice] = React.useState<'local' | 'cloud' | null>(null);
    /** 本地模型目录与下载状态；由事件持续更新。 */
    const [localStatus, setLocalStatus] = React.useState<LocalAiStatus | null>(null);
    /** 选中的本地模型 id。 */
    const [selectedModelId, setSelectedModelId] = React.useState<string>(LOCAL_AI_DEFAULT_MODEL_ID);
    /** 本地应用进行中标记。 */
    const [applying, setApplying] = React.useState(false);
    /** 云端表单字段。 */
    const [apiKey, setApiKey] = React.useState('');
    const [endpoint, setEndpoint] = React.useState('');
    const [modelsText, setModelsText] = React.useState('');
    /** 已预填过的凭据详情来源；凭据详情在父级 SWR 加载完成后才预填一次。 */
    const [prefillSource, setPrefillSource] = React.useState<ServiceCredentialSettingDetailVO | null>(null);
    /** 云端连接测试进行中标记。 */
    const [testing, setTesting] = React.useState(false);

    // 凭据详情就绪后预填云端表单；在渲染期同步状态而非 effect 中 setState，避免级联渲染。
    if (credentialDetail && prefillSource !== credentialDetail) {
        setPrefillSource(credentialDetail);
        setApiKey(credentialDetail.openai.key);
        setEndpoint(credentialDetail.openai.endpoint);
    }

    /** 拉取本地模型状态；下载结束后由进度事件触发刷新。 */
    const refreshLocalStatus = React.useCallback(() => {
        settingsApi.getLocalAiStatus().then((status) => {
            setLocalStatus(status);
            // 默认选中已就绪且在使用中的模型，其次任意已就绪模型，最后保持默认推荐档。
            const activeReady = status.models.find((model) => model.ready && model.modelId === status.activeModelId);
            const anyReady = status.models.find((model) => model.ready);
            if (activeReady) {
                setSelectedModelId(activeReady.modelId);
            } else if (anyReady) {
                setSelectedModelId(anyReady.modelId);
            }
        }).catch((error) => {
            toast.error(error instanceof Error ? error.message : String(error));
        });
    }, []);

    React.useEffect(() => {
        refreshLocalStatus();
    }, [refreshLocalStatus]);

    React.useEffect(() => {
        const handler = (event: Event) => {
            const progress = (event as CustomEvent<{
                modelId: string;
                downloaded: number;
                total: number;
                phase: LocalAiModelStatus['phase'];
            }>).detail;
            setLocalStatus((current) => current ? {
                ...current,
                models: current.models.map((model) =>
                    model.modelId === progress.modelId
                        ? { ...model, downloaded: progress.downloaded, total: progress.total, phase: progress.phase }
                        : model
                ),
            } : current);
            if (progress.phase === 'idle') {
                refreshLocalStatus();
            }
        };
        window.addEventListener('local-ai-model-download-progress', handler);
        return () => window.removeEventListener('local-ai-model-download-progress', handler);
    }, [refreshLocalStatus]);

    /** 是否有任意本地模型已就绪；决定本地路线是否可应用。 */
    const selectedModel = localStatus?.models.find((model) => model.modelId === selectedModelId) ?? null;
    const anyDownloading = localStatus?.models.some((model) => model.phase !== 'idle') ?? false;

    /**
     * 下载指定模型；进度由事件驱动，完成后按钮变为可应用。
     *
     * @param model 目标模型；由点击行直接传入，避免读取到旧的选中态。
     */
    const downloadSelected = async (model: LocalAiModelStatus) => {
        const name = model.name;
        try {
            await settingsApi.downloadLocalAi(model.modelId);
            toast.success(`${name}: ${t('settings:common.downloadDone')}`);
        } catch (error) {
            if ((error instanceof Error ? error.name : '') !== 'AbortError') {
                toast.error(`${name}: ${error instanceof Error ? error.message : String(error)}`);
            }
        } finally {
            refreshLocalStatus();
        }
    };

    /**
     * 取消当前下载；后端会保留已下载部分以便续传。
     */
    const cancelDownload = async () => {
        try {
            await settingsApi.cancelLocalAiDownload();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
            refreshLocalStatus();
        }
    };

    /**
     * 应用本地引擎：切换活跃模型并把字幕翻译与词典引擎一并设为本地。
     *
     * 整句学习是 OpenAI 专属能力，本地路线下一并关闭，避免运行时报缺凭据。
     */
    const applyLocal = async () => {
        if (!selectedModel?.ready || !engineDetail) {
            return;
        }
        setApplying(true);
        try {
            await settingsApi.useLocalAiModel(selectedModel.modelId);
            await settingsApi.saveEngineSelection({
                ...engineDetail,
                openai: { ...engineDetail.openai, enableSentenceLearning: false },
                providers: { subtitleTranslationEngine: 'local', dictionaryEngine: 'local' },
            });
            toast.success(t('engine.localModelApplied'));
            onApplied({ type: 'local', modelName: selectedModel.name });
        } catch (error) {
            toast.error(t('engine.applyFailed', {
                message: error instanceof Error ? error.message : String(error),
            }));
        } finally {
            setApplying(false);
        }
    };

    /**
     * 解析云端表单里的可用模型列表；留空时保持服务凭据页现有值，避免把可用模型清单清空。
     */
    const parseCloudModels = (): string[] => {
        if (!credentialDetail) {
            return [];
        }
        const parsed = modelsText
            .split(/[,，\n]/)
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
        return parsed.length > 0 ? parsed : credentialDetail.openai.models.map((item) => item.model);
    };

    /**
     * 将云端表单保存为服务凭据；腾讯、有道凭据保持现有值不变。
     */
    const saveCloudCredentials = async (): Promise<void> => {
        if (!credentialDetail) {
            throw new Error('credentials not loaded');
        }
        const payload: ServiceCredentialSettingSaveVO = {
            ...credentialDetail,
            openai: {
                ...credentialDetail.openai,
                key: apiKey.trim(),
                endpoint: endpoint.trim(),
                models: parseCloudModels(),
            },
        };
        await settingsApi.saveServiceCredentials(payload);
    };

    /**
     * 测试云端连接：先保存凭据再调用测试接口（测试接口从存储读取凭据）。
     */
    const testCloud = async () => {
        setTesting(true);
        try {
            await saveCloudCredentials();
            const result = await settingsApi.testServiceCredential('openai');
            if (result.success) {
                toast.success(t('engine.cloudTestSuccess'));
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
            setTesting(false);
        }
    };

    /**
     * 应用云端 API：保存凭据并把字幕翻译与词典引擎一并设为 OpenAI。
     *
     * 用户填写了可用模型列表时，三个功能模型都取列表第一项；否则保持设置页现有值。
     */
    const applyCloud = async () => {
        if (!engineDetail) {
            return;
        }
        setApplying(true);
        try {
            await saveCloudCredentials();
            const models = parseCloudModels();
            const primaryModel = models[0];
            const nextDetail: EngineSelectionSettingVO = {
                ...engineDetail,
                openai: {
                    ...engineDetail.openai,
                    featureModels: primaryModel
                        ? {
                            sentenceLearning: primaryModel,
                            subtitleTranslation: primaryModel,
                            dictionary: primaryModel,
                        }
                        : engineDetail.openai.featureModels,
                },
                providers: { subtitleTranslationEngine: 'openai', dictionaryEngine: 'openai' },
            };
            await settingsApi.saveEngineSelection(nextDetail);
            toast.success(t('engine.cloudApplied'));
            onApplied({ type: 'cloud' });
        } catch (error) {
            toast.error(t('engine.applyFailed', {
                message: error instanceof Error ? error.message : String(error),
            }));
        } finally {
            setApplying(false);
        }
    };

    /** 两个路线选择卡的公共样式与选中态。 */
    const choiceCardClass = (active: boolean) => cn(
        'flex-1 cursor-pointer rounded-2xl border p-5 text-left transition-colors',
        active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
    );

    return (
        <div className="flex flex-col gap-5">
            <div className="text-center">
                <h2 className="text-2xl font-bold">{t('engine.title')}</h2>
                <p className="text-sm text-muted-foreground mt-2">{t('engine.description')}</p>
            </div>
            <div className="flex gap-4">
                <button type="button" className={choiceCardClass(choice === 'local')} onClick={() => setChoice('local')}>
                    <Cpu className="h-6 w-6 mb-2" />
                    <div className="font-semibold">{t('engine.localTitle')}</div>
                    <div className="text-xs text-muted-foreground mt-1">{t('engine.localDescription')}</div>
                </button>
                <button type="button" className={choiceCardClass(choice === 'cloud')} onClick={() => setChoice('cloud')}>
                    <CloudCog className="h-6 w-6 mb-2" />
                    <div className="font-semibold">{t('engine.cloudTitle')}</div>
                    <div className="text-xs text-muted-foreground mt-1">{t('engine.cloudDescription')}</div>
                </button>
            </div>

            {choice === 'local' && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">{t('engine.localModelLabel')}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        {(localStatus?.models ?? []).filter((model) => !model.custom).map((model) => {
                            const percent = modelPercent(model);
                            return (
                                <div
                                    key={model.modelId}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => {
                                        if (anyDownloading && model.phase === 'idle') {
                                            return;
                                        }
                                        setSelectedModelId(model.modelId);
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            setSelectedModelId(model.modelId);
                                        }
                                    }}
                                    className={cn(
                                        'rounded-xl border p-3 text-left transition-colors cursor-pointer',
                                        selectedModelId === model.modelId ? 'border-primary bg-primary/5' : 'border-border',
                                        anyDownloading && model.phase === 'idle' && 'opacity-60',
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-sm font-medium">{model.name}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {model.sizeLabel} · {t('engine.localModelMemory', { gb: model.memoryEstimateGb })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {model.ready && model.modelId === localStatus?.activeModelId && (
                                                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                                                    {t('engine.localModelInUse')}
                                                </span>
                                            )}
                                            {model.ready && model.modelId !== localStatus?.activeModelId && (
                                                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                                    {t('engine.localModelReady')}
                                                </span>
                                            )}
                                            {model.phase === 'downloading' && (
                                                <span className="text-xs text-muted-foreground">
                                                    {t('engine.localModelDownloading', { percent: percent ?? 0 })}
                                                </span>
                                            )}
                                            {model.phase === 'verifying' && (
                                                <span className="text-xs text-muted-foreground">{t('engine.localModelVerifying')}</span>
                                            )}
                                            {model.phase === 'idle' && !model.ready && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={selectedModelId === model.modelId ? 'default' : 'outline'}
                                                    disabled={anyDownloading}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setSelectedModelId(model.modelId);
                                                        downloadSelected(model);
                                                    }}
                                                >
                                                    <Download className="mr-1 h-3.5 w-3.5" />
                                                    {t('engine.localModelDownload')}
                                                </Button>
                                            )}
                                            {model.phase !== 'idle' && (
                                                <Button type="button" size="sm" variant="outline" onClick={(event) => {
                                                    event.stopPropagation();
                                                    cancelDownload();
                                                }}>
                                                    <Square className="mr-1 h-3 w-3" />
                                                    {t('engine.localModelCancel')}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    {model.phase === 'downloading' && percent !== null && (
                                        <Progress value={percent} className="mt-2 h-1.5" />
                                    )}
                                </div>
                            );
                        })}
                        {!localStatus && (
                            <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            </div>
                        )}
                        <Button
                            type="button"
                            className="mt-2"
                            disabled={!selectedModel?.ready || applying || anyDownloading}
                            onClick={applyLocal}
                        >
                            {applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('engine.localModelApply')}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {choice === 'cloud' && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">{t('engine.cloudTitle')}</CardTitle>
                        <CardDescription>{t('engine.cloudNote')}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1.5">
                            <Label>{t('engine.cloudKeyLabel')}</Label>
                            <Input
                                type="password"
                                value={apiKey}
                                onChange={(event) => setApiKey(event.target.value)}
                                placeholder={t('engine.cloudKeyPlaceholder')}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>{t('engine.cloudEndpointLabel')}</Label>
                            <Input
                                value={endpoint}
                                onChange={(event) => setEndpoint(event.target.value)}
                                placeholder={t('engine.cloudEndpointPlaceholder')}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>{t('engine.cloudModelsLabel')}</Label>
                            <Input
                                value={modelsText}
                                onChange={(event) => setModelsText(event.target.value)}
                                placeholder={t('engine.cloudModelsPlaceholder')}
                            />
                        </div>
                        <div className="flex gap-2 mt-1">
                            <Button type="button" variant="outline" disabled={testing || applying} onClick={testCloud}>
                                {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t('engine.cloudTest')}
                            </Button>
                            <Button type="button" disabled={applying} onClick={applyCloud}>
                                {applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t('engine.cloudApply')}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default EngineStep;
