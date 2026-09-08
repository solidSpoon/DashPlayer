import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Copy,
    Download,
    ExternalLink,
    FolderOpen,
    HelpCircle,
    Loader2,
    Square,
    Trash2,
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
import type { ModelDownloadPhase } from '@/common/contracts/model-download-phase';
import type { ModelInstallationStatusVO } from '@/common/types/vo/model-installation-vo';

/**
 * 本地模型卡的展示属性；状态与动作由 useModelInstallation 提供，文案由各模型卡传入。
 */
export interface LocalModelCardProps {
    /** 模型安装与下载状态。 */
    status: ModelInstallationStatusVO | null;
    downloading: boolean;
    deleting: boolean;
    /** 下载进度百分比（0-100）。 */
    progress: number;
    phase: ModelDownloadPhase;
    /** 模型名称徽标，如 "Parakeet TDT 0.6B v3"。 */
    modelLabel: string;
    /** 体积徽标，如 "~640 MB"。 */
    sizeLabel: string;
    /** 模型用途说明。 */
    description: React.ReactNode;
    /** 手动安装指引步骤一的标题；压缩包与单文件形态文案不同。 */
    step1Title: string;
    /** 手动安装指引步骤三的提示；压缩包为"解压生效"，单文件为"安装生效"。 */
    installHint: string;
    onDownload: () => void;
    onCancelDownload: () => void;
    onDelete: () => void;
    onOpenFolder: () => void;
    /** 复制文本到剪贴板（由页面统一提供，便于提示）。 */
    onCopy: (text: string) => void;
    onOpenUrl: (url: string) => void;
}

/**
 * 本地模型卡内容：状态徽标、下载/删除动作、进度条与手动安装指引。
 *
 * 由 Parakeet 与 whisper.cpp 识别模型卡共用；外层的 SettingCard 标题、
 * 引擎条件渲染由页面负责。
 */
export default function LocalModelCard({
    status,
    downloading,
    deleting,
    progress,
    phase,
    modelLabel,
    sizeLabel,
    description,
    step1Title,
    installHint,
    onDownload,
    onCancelDownload,
    onDelete,
    onOpenFolder,
    onCopy,
    onOpenUrl,
}: LocalModelCardProps) {
    const { t } = useTranslation('settings');
    const [guideOpen, setGuideOpen] = React.useState(false);

    /** 下载进度条的阶段文案。 */
    const phaseLabel = (phase: ModelDownloadPhase): string => {
        if (phase === 'extracting') return t('serviceCredentials.localModel.extracting');
        if (phase === 'installing') return t('serviceCredentials.localModel.installing');
        return t('serviceCredentials.localModel.downloading');
    };

    const percent = `${Math.min(100, Math.max(0, Math.round(progress)))}%`;

    return (
        <div className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 p-3.5 rounded-xl border border-border/50">
                <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{modelLabel}</span>
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{sizeLabel}</span>
                        {status?.ready ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {t('common.ready')}
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                {t('common.notDownloaded')}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {downloading ? (
                        phase === 'downloading' ? (
                            <Button type="button" variant="outline" size="sm" onClick={onCancelDownload}>
                                <Square className="w-3.5 h-3.5 mr-1.5 text-destructive" />
                                {t('serviceCredentials.localModel.cancelDownload')}
                            </Button>
                        ) : (
                            <Button type="button" variant="outline" size="sm" disabled>
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                {t('serviceCredentials.localModel.installing')}
                            </Button>
                        )
                    ) : (
                        <>
                            {!status?.ready && (
                                <Button type="button" size="sm" onClick={onDownload}>
                                    <Download className="w-3.5 h-3.5 mr-1.5" />
                                    {t('common.download')}
                                </Button>
                            )}
                            {status?.ready && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" disabled={deleting}>
                                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                            {t('serviceCredentials.localModel.deleteModel')}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>{t('serviceCredentials.localModel.deleteConfirmTitle', { name: modelLabel })}</AlertDialogTitle>
                                            <AlertDialogDescription>{t('serviceCredentials.localModel.deleteConfirmDescription')}</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>{t('serviceCredentials.localModel.cancelDelete')}</AlertDialogCancel>
                                            <AlertDialogAction onClick={onDelete}>{t('serviceCredentials.localModel.confirmDelete')}</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </>
                    )}
                </div>
            </div>

            {downloading && (
                <div className="space-y-1.5 p-3 rounded-lg bg-muted/30 border border-border/40">
                    <div className="flex justify-between text-xs text-muted-foreground font-medium">
                        <span>{phaseLabel(phase)}</span>
                        <span>{percent}</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                </div>
            )}

            {/* 未就绪时提供可折叠的手动安装指引 */}
            {!status?.ready && status && (
                <div className="rounded-xl border border-border/60 bg-muted/10 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setGuideOpen((open) => !open)}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <span className="flex items-center gap-1.5">
                            <HelpCircle className="w-3.5 h-3.5" />
                            {t('serviceCredentials.localModel.guideTitle')}
                        </span>
                        {guideOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>

                    {guideOpen && (
                        <div className="p-3.5 pt-2 space-y-3.5 text-xs border-t border-border/40 text-muted-foreground">
                            <div className="space-y-1.5">
                                <div className="font-semibold text-foreground">{step1Title}</div>
                                <div className="bg-background/80 rounded border border-border/60 p-2 space-y-1.5 font-mono text-[11px] break-all select-text">
                                    <div className="text-muted-foreground/70">{status.downloadUrl}</div>
                                    <div className="flex items-center gap-2 pt-1 font-sans">
                                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onCopy(status.downloadUrl)}>
                                            <Copy className="w-3 h-3 mr-1" />
                                            {t('serviceCredentials.localModel.copyDownloadUrl')}
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenUrl(status.downloadUrl)}>
                                            <ExternalLink className="w-3 h-3 mr-1" />
                                            {t('serviceCredentials.localModel.openInBrowser')}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="font-semibold text-foreground">{t('serviceCredentials.localModel.step2Title')}</div>
                                <div className="bg-background/80 rounded border border-border/60 p-2 space-y-1.5 font-mono text-[11px] break-all select-text">
                                    <div className="text-muted-foreground/70">{status.archivePath}</div>
                                    <div className="flex items-center gap-2 pt-1 font-sans">
                                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onCopy(status.archivePath)}>
                                            <Copy className="w-3 h-3 mr-1" />
                                            {t('serviceCredentials.localModel.copyTargetPath')}
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onOpenFolder}>
                                            <FolderOpen className="w-3 h-3 mr-1" />
                                            {t('serviceCredentials.localModel.openTargetFolder')}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-0.5 text-muted-foreground/90 bg-muted/30 p-2 rounded">
                                <span className="font-semibold text-foreground">{t('serviceCredentials.localModel.step3Title')}</span>
                                <span>{installHint}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
