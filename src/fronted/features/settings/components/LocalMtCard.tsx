import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Copy, Download, ExternalLink, FolderOpen, Languages, Square, Trash2 } from 'lucide-react';
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
import type { LocalMtStatus } from '@/common/contracts/local-mt';

export interface LocalMtCardProps {
    status: LocalMtStatus | null;
    busy: boolean;
    onDownload: () => void;
    onCancelDownload: () => void;
    onDelete: () => void;
    onOpenFolder: (path?: string) => void;
    onCopy: (text: string) => void;
    onOpenUrl: (url: string) => void;
}

/**
 * 本地模型卡片中的"本地快速翻译"区块：离线翻译模型的下载、进度与删除。
 *
 * 只渲染区块内容，外层"本地模型"卡片由页面提供。
 */
export const LocalMtCard: React.FC<LocalMtCardProps> = ({
    status,
    busy,
    onDownload,
    onCancelDownload,
    onDelete,
    onOpenFolder,
    onCopy,
    onOpenUrl,
}) => {
    const { t } = useTranslation('settings');

    /** 下载/校验进度百分比（0-100）。 */
    const percent = Math.min(100, Math.floor((status?.downloaded ?? 0) / (status?.total || 1) * 100));

    return (
        <div className="p-4 space-y-3">
            <SettingBlockHeader
                title={t('serviceCredentials.localMt.cardTitle')}
                description={t('serviceCredentials.localMt.cardDescription')}
                icon={Languages}
                action={
                    status?.ready ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenFolder(status.modelPath)}
                        >
                            <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                            {t('common.openFolder')}
                        </Button>
                    ) : null
                }
            />

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
                    {status?.ready ? (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-destructive"
                                    disabled={busy}
                                >
                                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                    {t('serviceCredentials.localModel.deleteModel')}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>{t('serviceCredentials.localMt.deleteConfirmTitle')}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        {t('serviceCredentials.localMt.deleteConfirmDescription')}
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>{t('serviceCredentials.localModel.cancelDelete')}</AlertDialogCancel>
                                    <AlertDialogAction onClick={onDelete}>
                                        {t('serviceCredentials.localModel.confirmDelete')}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    ) : status && status.phase !== 'idle' ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={onCancelDownload}
                        >
                            <Square className="w-3.5 h-3.5 mr-1.5 text-destructive" />
                            {t('serviceCredentials.localModel.cancelDownload')}
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={onDownload}
                        >
                            <Download className="w-3.5 h-3.5 mr-1.5" />
                            {t('common.download')}
                        </Button>
                    )}
                </div>
            </div>

            {status && status.phase !== 'idle' && (
                <div className="space-y-1.5 p-3 rounded-lg bg-muted/30 border border-border/40">
                    <div className="flex justify-between text-xs text-muted-foreground font-medium">
                        <span>
                            {status.phase === 'verifying'
                                ? t('serviceCredentials.localModel.installing')
                                : t('serviceCredentials.localModel.downloading')}
                        </span>
                        <span>{percent}%</span>
                    </div>
                    <Progress value={percent} className="h-1.5" />
                </div>
            )}

            {status?.error && (
                <p className="text-xs text-destructive">{status.error}</p>
            )}

            {/* 未就绪时提供可折叠的手动下载教程：该模型是逐文件下载，需保持目录结构 */}
            {status && !status.ready && (
                <ManualDownloadGuide title={t('serviceCredentials.localModel.guideTitle')}>
                    <div className="space-y-1.5">
                        <div className="font-semibold text-foreground">{t('serviceCredentials.localModel.step1Title')}</div>
                        <div className="text-muted-foreground/90">{t('serviceCredentials.localMt.filesToDownload')}</div>
                        <div className="bg-background/80 rounded border border-border/60 p-2 space-y-2 font-mono text-[11px] break-all select-text">
                            {/* 首个为官方地址，其余为备用镜像；网络受限时可改用镜像地址手动下载 */}
                            {status.downloadUrls.map((url, index) => (
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
                    </div>

                    <div className="space-y-1.5">
                        <div className="font-semibold text-foreground">{t('serviceCredentials.localModel.step2Title')}</div>
                        <div className="bg-background/80 rounded border border-border/60 p-2 space-y-1.5 font-mono text-[11px] break-all select-text">
                            <div className="text-muted-foreground/70">{status.modelPath}</div>
                            <div className="flex items-center gap-2 pt-1 font-sans">
                                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onCopy(status.modelPath)}>
                                    <Copy className="w-3 h-3 mr-1" />
                                    {t('serviceCredentials.localModel.copyTargetPath')}
                                </Button>
                                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenFolder(status.modelPath)}>
                                    <FolderOpen className="w-3 h-3 mr-1" />
                                    {t('serviceCredentials.localModel.openTargetFolder')}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-0.5 text-muted-foreground/90 bg-muted/30 p-2 rounded">
                        <div className="font-semibold text-foreground">{t('serviceCredentials.localModel.step3Title')}</div>
                        <div>{t('serviceCredentials.localMt.installHint')}</div>
                    </div>
                </ManualDownloadGuide>
            )}
        </div>
    );
};
