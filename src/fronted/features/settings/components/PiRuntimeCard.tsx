import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Download, Loader2, RefreshCw, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/fronted/components/ui/button';
import { Progress } from '@/fronted/components/ui/progress';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import type {
    PiRuntimeDownloadPhase,
    PiRuntimeDownloadProgress,
    PiRuntimeStatusVO,
} from '@/common/contracts/pi-runtime';

/**
 * 格式化下载阶段提示文案。
 */
const formatPhaseLabel = (phase: PiRuntimeDownloadPhase): string => {
    switch (phase) {
        case 'resolving':
            return '正在解析最新版本信息...';
        case 'downloading':
            return '正在下载 Pi 二进制包...';
        case 'verifying':
            return '正在校验 SHA256...';
        case 'extracting':
            return '正在解压安装...';
        default:
            return '';
    }
};

/**
 * 格式化字节数显示。
 */
const formatBytes = (bytes: number): string => {
    if (bytes <= 0) {
        return '0 B';
    }
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) {
        return `${mb.toFixed(1)} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
};

/**
 * 设置页中的 Pi 二进制运行环境管理卡片。
 */
export const PiRuntimeCard: React.FC = () => {
    const [status, setStatus] = useState<PiRuntimeStatusVO | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState<PiRuntimeDownloadProgress | null>(null);

    const loadStatus = useCallback(async () => {
        try {
            const nextStatus = await settingsApi.getPiRuntimeStatus();
            setStatus(nextStatus);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let active = true;
        settingsApi.getPiRuntimeStatus()
            .then((nextStatus) => {
                if (active) {
                    setStatus(nextStatus);
                }
            })
            .catch((error) => {
                if (active) {
                    toast.error(error instanceof Error ? error.message : String(error));
                }
            })
            .finally(() => {
                if (active) {
                    setLoading(false);
                }
            });
        const handleProgress = (event: Event) => {
            const customEvent = event as CustomEvent<PiRuntimeDownloadProgress>;
            setProgress(customEvent.detail);
        };
        window.addEventListener('pi-runtime-download-progress', handleProgress);
        return () => {
            active = false;
            window.removeEventListener('pi-runtime-download-progress', handleProgress);
        };
    }, []);

    const handleDownload = async () => {
        setBusy(true);
        try {
            const res = await settingsApi.downloadPiRuntime();
            if (res.success) {
                toast.success(res.message);
            } else {
                toast.error(res.message);
            }
            await loadStatus();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
            setBusy(false);
            setProgress(null);
        }
    };

    const handleCancel = async () => {
        try {
            await settingsApi.cancelPiRuntimeDownload();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        }
    };

    const handleRemove = async () => {
        setBusy(true);
        try {
            await settingsApi.removePiRuntime();
            toast.success('已移除受管 Pi 运行环境');
            await loadStatus();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
            setBusy(false);
        }
    };

    const isDownloading = Boolean(busy || status?.downloading);
    const activePhase = progress?.phase && progress.phase !== 'idle'
        ? progress.phase
        : status?.phase && status.phase !== 'idle'
            ? status.phase
            : 'idle';
    const activePercent = progress?.percent ?? status?.percent ?? 0;

    return (
        <div className="p-4 text-sm">
            {loading && !status ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>正在检查运行环境...</span>
                </div>
            ) : status ? (
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 font-medium">
                                {status.installed ? (
                                    <>
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                        <span>已安装 {status.version ? `(${status.version})` : ''}</span>
                                    </>
                                ) : (
                                    <span className="text-amber-600 dark:text-amber-400">尚未安装</span>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {status.installed
                                    ? '可正常使用视频下载等自动化任务'
                                    : '需先下载该运行环境后才能使用视频下载等功能'}
                            </p>
                            {status.message && (
                                <p className="text-xs text-destructive">{status.message}</p>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {isDownloading ? (
                                <Button variant="outline" size="sm" onClick={handleCancel}>
                                    <X className="mr-1.5 h-3.5 w-3.5" />
                                    取消
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        size="sm"
                                        variant={status.installed ? 'outline' : 'default'}
                                        disabled={!status.platformSupported || busy}
                                        onClick={handleDownload}
                                    >
                                        {status.installed ? (
                                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                                        ) : (
                                            <Download className="mr-1.5 h-3.5 w-3.5" />
                                        )}
                                        {status.installed ? '检查更新 / 重装' : '下载安装'}
                                    </Button>
                                    {status.installed && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={busy}
                                            onClick={handleRemove}
                                        >
                                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                            卸载
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {isDownloading && (
                        <div className="space-y-1.5 border-t pt-3">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{formatPhaseLabel(activePhase) || '准备中...'}</span>
                                <span>
                                    {progress && progress.total > 0
                                        ? `${formatBytes(progress.downloaded)} / ${formatBytes(progress.total)} (${activePercent}%)`
                                        : `${activePercent}%`}
                                </span>
                            </div>
                            <Progress value={activePercent} className="h-2" />
                        </div>
                    )}
                </div>
            ) : null}
        </div>
    );
};

export default PiRuntimeCard;
