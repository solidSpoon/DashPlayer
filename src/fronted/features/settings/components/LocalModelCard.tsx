import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    CheckCircle2,
    Copy,
    Download,
    ExternalLink,
    FolderOpen,
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
import { ManualDownloadGuide } from '@/fronted/components/shared/ManualDownloadGuide';

/**
 * 本地模型卡的展示属性；状态与动作由 useModelInstallation 提供。
 *
 * 主界面只展示"用途 + 状态 + 动作"，模型名称、体积、下载地址与目标路径等
 * 技术信息全部收敛到手动下载教程区，避免普通用户看到实现细节。
 */
export interface LocalModelCardProps {
    /** 模型安装与下载状态。 */
    status: ModelInstallationStatusVO | null;
    downloading: boolean;
    deleting: boolean;
    /** 下载进度百分比（0-100）。 */
    progress: number;
    phase: ModelDownloadPhase;
    /** 卡片用途名（如"字幕语音识别"），仅用于删除确认等提示文案。 */
    title: string;
    /** 手动下载教程里展示的模型名称与体积。 */
    modelFileLabel: string;
    onDownload: () => void;
    onCancelDownload: () => void;
    onDelete: () => void;
    onOpenFolder: () => void;
    /** 复制文本到剪贴板（由页面统一提供，便于提示）。 */
    onCopy: (text: string) => void;
    onOpenUrl: (url: string) => void;
}

/**
 * 本地模型卡内容：状态、下载/删除动作、进度条与手动下载教程。
 *
 * 由 Parakeet、whisper.cpp 与 Sherpa TTS 模型卡共用；外层 SettingCard 标题
 * 与引擎条件渲染由页面负责。
 */
export default function LocalModelCard({
    status,
    downloading,
    deleting,
    progress,
    phase,
    title,
    modelFileLabel,
    onDownload,
    onCancelDownload,
    onDelete,
    onOpenFolder,
    onCopy,
    onOpenUrl,
}: LocalModelCardProps) {
    const { t } = useTranslation('settings');

    /** 下载进度条的阶段文案。 */
    const phaseLabel = (phase: ModelDownloadPhase): string => {
        if (phase === 'extracting') return t('serviceCredentials.localModel.extracting');
        if (phase === 'installing') return t('serviceCredentials.localModel.installing');
        return t('serviceCredentials.localModel.downloading');
    };

    const percent = `${Math.min(100, Math.max(0, Math.round(progress)))}%`;

    return (
        <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
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
                    {!status?.ready && (
                        <span className="text-xs text-muted-foreground truncate">
                            {t('serviceCredentials.localModel.notDownloadedHint')}
                        </span>
                    )}
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
                                            <AlertDialogTitle>{t('serviceCredentials.localModel.deleteConfirmTitle', { name: title })}</AlertDialogTitle>
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

            {/* 未就绪时提供可折叠的手动下载教程：技术细节只在这里出现 */}
            {!status?.ready && status && (
                <ManualDownloadGuide title={t('serviceCredentials.localModel.guideTitle')}>
                    <div className="space-y-1.5">
                        <div className="font-semibold text-foreground">{t('serviceCredentials.localModel.step1Title')}</div>
                        <div className="text-muted-foreground/90">
                            {t('serviceCredentials.localModel.modelToDownload', { model: modelFileLabel })}
                        </div>
                        <div className="bg-background/80 rounded border border-border/60 p-2 space-y-2 font-mono text-[11px] break-all select-text">
                            {/* 首个为官方地址，其余为备用镜像；网络受限时可改用镜像地址手动下载 */}
                            {status.downloadUrls.map((url, index) => (
                                <div key={url} className="space-y-1">
                                    <div className="flex items-start gap-1.5">
                                        {index > 0 && (
                                            <span className="shrink-0 mt-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 font-sans text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                                {t('serviceCredentials.localModel.backupMirror')}
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
                        <div className="font-semibold text-foreground">{t('serviceCredentials.localModel.step3Title')}</div>
                        <div>{t('serviceCredentials.localModel.installHint')}</div>
                    </div>
                </ManualDownloadGuide>
            )}
        </div>
    );
}
