import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Bot,
    CheckCircle2,
    Copy,
    Cpu,
    Download,
    ExternalLink,
    FolderOpen,
    Gauge,
    Loader2,
    Square,
    Trash2,
    XCircle,
} from 'lucide-react';
import { Button } from '@/fronted/components/ui/button';
import { Progress } from '@/fronted/components/ui/progress';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/fronted/components/ui/alert-dialog';
import { SettingBlockHeader } from '@/fronted/features/settings/components/form';
import { ManualDownloadGuide } from '@/fronted/components/shared/ManualDownloadGuide';
import type { LocalAiStatus } from '@/common/contracts/local-ai';

export interface LocalLlmCardProps {
    status: LocalAiStatus | null;
    busy: boolean;
    testingModelId: string | null;
    /** 卡片标题；不传时用设置页通用文案。 */
    title?: string;
    /** 卡片说明；不传时用设置页通用文案。 */
    description?: string;
    /** 硬件条件提示；不传时不展示。 */
    hardwareHint?: React.ReactNode;
    testResultsMap: Record<string, {
        success: boolean;
        warmSec: string;
        tps: string;
        errorMessage?: string;
    } | null>;
    onUseModel: (modelId: string, name: string) => void;
    onTestModel: (modelId: string) => void;
    onDownloadModel: (modelId: string, name: string) => void;
    onCancelDownload: () => void;
    onDeleteModel: (modelId: string, name: string) => void;
    onOpenFolder: (path?: string) => void;
    onCopy: (text: string) => void;
    /** 打开外部下载链接（手动下载教程用）。 */
    onOpenUrl: (url: string) => void;
}

/**
 * 本地智能模型卡片：模型下载/启用/删除，以及手动导入指南。
 *
 * 主界面只展示"内置模型/自定义模型 + 状态 + 动作"；模型名、体积、内存占用、
 * 下载地址与目录等实现细节收敛到手动下载教程区。
 */
export const LocalLlmCard: React.FC<LocalLlmCardProps> = ({
    status,
    busy,
    testingModelId,
    title,
    description,
    hardwareHint,
    testResultsMap,
    onUseModel,
    onTestModel,
    onDownloadModel,
    onCancelDownload,
    onDeleteModel,
    onOpenFolder,
    onCopy,
    onOpenUrl,
}) => {
    const { t } = useTranslation('settings');

    /** 官方目录中的内置模型；手动下载教程以它为示例。 */
    const builtinModel = status?.models.find((model) => !model.custom);

    return (
        <div className="p-4 space-y-4">
            <SettingBlockHeader
                title={title ?? t('serviceCredentials.localAi.cardTitle')}
                description={description ?? t('serviceCredentials.localAi.cardDescription')}
                icon={Bot}
            />

            {/* 硬件条件提示：本地增强模型对内存与算力有一定要求 */}
            {hardwareHint && (
                <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <Cpu className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{hardwareHint}</span>
                </div>
            )}

            {/* 模型列表 */}
            <div className="space-y-3">
                {status?.models.map((model) => {
                    const anyDownloading = status?.models.some((item) => item.phase !== 'idle') ?? false;
                    const isActive = model.ready && model.modelId === status.activeModelId;
                    const isTestingThisModel = testingModelId === model.modelId;
                    const testResult = testResultsMap[model.modelId];

                    return (
                        <div key={model.modelId} className="space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex flex-1 items-center gap-2 min-w-0">
                                    {/* 只有自定义模型才展示文件名；内置模型靠卡片标题即可识别 */}
                                    {model.custom && (
                                        <span className="text-sm font-medium text-foreground truncate">{model.name}</span>
                                    )}
                                    {isActive ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                                            <CheckCircle2 className="h-3 w-3" />
                                            {t('serviceCredentials.localAi.inUse')}
                                        </span>
                                    ) : model.ready ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-muted/80 px-2 py-0.5 text-xs text-muted-foreground">
                                            {t('serviceCredentials.localAi.readyNotInUse')}
                                        </span>
                                    ) : model.phase !== 'idle' ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            {model.phase === 'verifying'
                                                ? t('serviceCredentials.localAi.phaseVerifying')
                                                : t('serviceCredentials.localAi.phaseDownloading')}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-muted/80 px-2 py-0.5 text-xs text-muted-foreground">
                                            {t('common.notDownloaded')}
                                        </span>
                                    )}

                                    {/* 测速结果内联展示，不新增行高，避免卡片内元素跳动 */}
                                    {testResult && (
                                        testResult.success ? (
                                            <span className="flex items-center gap-3 min-w-0 truncate text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" />
                                                    {t('serviceCredentials.localAi.speedWarm')}
                                                    <span className="font-mono font-medium text-foreground">{testResult.warmSec}s</span>
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    {t('serviceCredentials.localAi.speedTps')}
                                                    <span className="font-mono font-semibold text-primary">{testResult.tps} {t('serviceCredentials.localAi.speedTpsUnit')}</span>
                                                </span>
                                            </span>
                                        ) : (
                                            <span
                                                className="flex items-center gap-1 min-w-0 truncate text-xs text-destructive"
                                                title={testResult.errorMessage || t('common.testFailed')}
                                            >
                                                <XCircle className="h-3.5 w-3.5 shrink-0" />
                                                <span className="truncate">{testResult.errorMessage || t('common.testFailed')}</span>
                                            </span>
                                        )
                                    )}
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
                                    {!model.ready && model.phase === 'idle' && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            disabled={busy || anyDownloading}
                                            onClick={() => onDownloadModel(model.modelId, model.name)}
                                        >
                                            <Download className="mr-1.5 h-3.5 w-3.5" />
                                            {t('common.download')}
                                        </Button>
                                    )}
                                    {!model.ready && model.phase !== 'idle' && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={busy}
                                            onClick={onCancelDownload}
                                        >
                                            <Square className="mr-1.5 h-3.5 w-3.5 text-destructive" />
                                            {t('serviceCredentials.localAi.cancelDownload')}
                                        </Button>
                                    )}
                                    {model.ready && !isActive && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            disabled={busy || testingModelId !== null}
                                            onClick={() => onUseModel(model.modelId, model.name)}
                                        >
                                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                            {t('serviceCredentials.localAi.use')}
                                        </Button>
                                    )}
                                    {model.ready && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="min-w-24 justify-center whitespace-nowrap"
                                            disabled={busy || testingModelId !== null}
                                            onClick={() => onTestModel(model.modelId)}
                                        >
                                            {isTestingThisModel ? (
                                                <>
                                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-primary" />
                                                    {t('serviceCredentials.localAi.testing')}
                                                </>
                                            ) : (
                                                <>
                                                    <Gauge className="mr-1.5 h-3.5 w-3.5" />
                                                    {t('serviceCredentials.localAi.test')}
                                                </>
                                            )}
                                        </Button>
                                    )}
                                    {model.ready && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-muted-foreground hover:text-destructive"
                                                    disabled={busy || testingModelId !== null}
                                                >
                                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                                    {t('serviceCredentials.localModel.deleteModel')}
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>{t('serviceCredentials.localAi.deleteConfirmTitle')}</AlertDialogTitle>
                                                    <AlertDialogDescription>{t('serviceCredentials.localAi.deleteConfirmDescription')}</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>{t('serviceCredentials.localAi.cancelDelete')}</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => onDeleteModel(model.modelId, model.name)}>
                                                        {t('serviceCredentials.localAi.confirmDelete')}
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </div>
                            </div>

                            {/* 下载/校验进度条 */}
                            {!model.ready && model.phase !== 'idle' && (
                                <div className="mt-3 space-y-1.5 rounded-lg border border-border/40 bg-muted/30 p-2.5">
                                    <div className="flex justify-between text-xs font-medium text-muted-foreground">
                                        <span>{model.phase === 'verifying' ? t('serviceCredentials.localAi.phaseVerifying') : t('serviceCredentials.localAi.phaseDownloading')}</span>
                                        <span>{Math.min(100, Math.floor(model.downloaded / (model.total || 1) * 100))}%</span>
                                    </div>
                                    <Progress value={(model.downloaded / (model.total || 1)) * 100} className="h-1.5" />
                                </div>
                            )}

                            {model.error && (
                                <div className="mt-2 text-xs text-destructive">{model.error}</div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 手动下载与导入教程：仅内置模型未就绪时出现，技术细节只在这里 */}
            {builtinModel && !builtinModel.ready && (
                <ManualDownloadGuide title={t('serviceCredentials.localAi.customGuideTitle')}>
                    <div className="space-y-1.5">
                        <div className="font-semibold text-foreground">{t('serviceCredentials.localModel.step1Title')}</div>
                        {builtinModel.downloadUrls.length > 0 ? (
                            <>
                                <div className="text-muted-foreground/90">
                                    {t('serviceCredentials.localModel.modelToDownload', { model: `${builtinModel.name}（${builtinModel.sizeLabel}）` })}
                                </div>
                                <div className="bg-background/80 rounded border border-border/60 p-2 space-y-2 font-mono text-[11px] break-all select-text">
                                    {/* 首个为官方地址，其余为备用镜像；网络受限时可改用镜像地址手动下载 */}
                                    {builtinModel.downloadUrls.map((url, index) => (
                                        <div key={url} className="space-y-1">
                                            <div className="flex items-start gap-1.5">
                                                {index > 0 && (
                                                    <span className="shrink-0 mt-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 font-sans text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                                        {t('serviceCredentials.localModel.backupSource')}
                                                    </span>
                                                )}
                                                <span className="text-muted-foreground/70 break-all">{url}</span>
                                            </div>
                                            <div className="flex items-center gap-1 font-sans">
                                                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onCopy(url)}>
                                                    <Copy className="w-3 h-3 mr-1" />
                                                    {t('serviceCredentials.localModel.copyDownloadUrl')}
                                                </Button>
                                                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenUrl(url)}>
                                                    <ExternalLink className="w-3 h-3 mr-1" />
                                                    {t('serviceCredentials.localModel.openInBrowser')}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <p className="leading-relaxed">{t('serviceCredentials.localAi.customGuideStep1')}</p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <div className="font-semibold text-foreground">{t('serviceCredentials.localModel.step2Title')}</div>
                        <div className="bg-background/80 rounded border border-border/60 p-2.5 space-y-2 font-mono text-[11px] break-all select-text">
                            <div className="text-muted-foreground/70">{status?.modelsDirectory ?? ''}</div>
                            <div className="flex items-center gap-2 pt-1 font-sans">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    disabled={!status}
                                    onClick={() => status && onCopy(status.modelsDirectory)}
                                >
                                    <Copy className="w-3 h-3 mr-1" />
                                    {t('serviceCredentials.localAi.copyPath')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    disabled={!status}
                                    onClick={() => status && onOpenFolder(status.modelsDirectory)}
                                >
                                    <FolderOpen className="w-3 h-3 mr-1" />
                                    {t('common.openFolder')}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-0.5 text-muted-foreground/90 bg-muted/30 p-2 rounded">
                        <div className="font-semibold text-foreground">{t('serviceCredentials.localModel.step3Title')}</div>
                        <div>{t('serviceCredentials.localAi.customGuideStep3')}</div>
                    </div>
                </ManualDownloadGuide>
            )}

            {/* 运行时不可用时的显式提示 */}
            {status && !status.runtimeReady && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
                    <span>{t('serviceCredentials.localAi.runtimeMissing')}</span>
                </div>
            )}
        </div>
    );
};
