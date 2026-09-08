import React from 'react';
import toast from 'react-hot-toast';
import type { ModelInstallationStatusVO } from '@/common/types/vo/model-installation-vo';
import type { ModelDownloadPhase } from '@/common/contracts/model-download-phase';

/**
 * 本地模型管理接口形状；与后端各模型服务的 IPC 封装保持一致。
 */
export interface ModelInstallationApi {
    /** 查询模型安装与下载状态。 */
    getStatus: () => Promise<ModelInstallationStatusVO>;
    /** 开始下载模型。 */
    download: () => Promise<{ success: boolean; message: string }>;
    /** 取消进行中的下载。 */
    cancelDownload: () => Promise<{ cancelled: boolean }>;
    /** 删除已安装的模型。 */
    deleteModel: () => Promise<{ success: boolean; message: string }>;
}

/**
 * useModelInstallation 的配置。
 */
export interface UseModelInstallationOptions {
    /** 模型管理接口。 */
    api: ModelInstallationApi;
    /** 主进程广播下载进度时派发的 window CustomEvent 名。 */
    progressEventName: string;
    /** 模型显示名，用于提示文案。 */
    displayName: string;
}

/**
 * 本地模型卡的通用状态与动作：状态轮询、下载进度事件、下载/取消/删除。
 *
 * 进度事件语义与主进程 ModelArchiveInstaller 对齐：`idle` 为终态，
 * 收到后复位 UI 并重查状态；接近 100% 且仍处于下载阶段时延时重查兜底。
 */
export function useModelInstallation({ api, progressEventName, displayName }: UseModelInstallationOptions) {
    const [status, setStatus] = React.useState<ModelInstallationStatusVO | null>(null);
    const [downloading, setDownloading] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [phase, setPhase] = React.useState<ModelDownloadPhase>('downloading');

    /** 是否已由用户手动触发下载；用于丢弃过期的状态查询响应。 */
    const downloadingRef = React.useRef(false);

    /**
     * 刷新模型状态；若期间用户已手动开始下载，丢弃过期响应，避免覆盖进行中的下载状态。
     */
    const refresh = React.useCallback(async () => {
        const next = await api.getStatus();
        setStatus(next);
        if (downloadingRef.current) {
            return;
        }
        setDownloading(next.downloading);
        if (next.phase) {
            setPhase(next.phase);
        }
        setProgress(next.percent);
    }, [api]);

    React.useEffect(() => {
        // 挂载时拉取一次模型状态；与既有设置页行为一致，状态更新发生在 await 之后。
        // eslint-disable-next-line react-hooks/set-state-in-effect
        refresh().catch(() => null);
    }, [refresh]);

    React.useEffect(() => {
        const handler = (evt: Event) => {
            const detail = (evt as CustomEvent).detail as { percent: number; phase?: ModelDownloadPhase } | undefined;
            if (!detail) return;
            // 终态事件：下载任务已在主进程结束（成功/失败/取消），直接复位 UI 并重新查询状态。
            if (detail.phase === 'idle') {
                downloadingRef.current = false;
                setDownloading(false);
                setProgress(0);
                setPhase('downloading');
                refresh().catch(() => null);
                return;
            }
            if (detail.phase) {
                setPhase(detail.phase);
            }
            setProgress(detail.percent);

            if (detail.percent >= 100 && detail.phase !== 'extracting' && detail.phase !== 'installing') {
                setTimeout(() => {
                    refresh().catch(() => null);
                }, 300);
            }
        };

        window.addEventListener(progressEventName, handler as EventListener);
        return () => {
            window.removeEventListener(progressEventName, handler as EventListener);
        };
    }, [progressEventName, refresh]);

    /**
     * 下载模型；成功/失败均给出提示并刷新状态。
     */
    const download = async () => {
        downloadingRef.current = true;
        setDownloading(true);
        setProgress(0);
        setPhase('downloading');
        try {
            await api.download();
            toast.success(`${'通用下载完成'}\n${displayName} 模型已下载`.replace('通用下载完成', '下载完成'));
            await refresh();
        } catch (error) {
            toast.error(`下载失败\n${error instanceof Error ? error.message : String(error)}`);
        } finally {
            downloadingRef.current = false;
            setDownloading(false);
        }
    };

    /**
     * 取消正在进行的下载。
     */
    const cancelDownload = async () => {
        const result = await api.cancelDownload();
        if (result.cancelled) {
            toast.success(`${displayName} 模型下载已取消`);
        }
    };

    /**
     * 删除已安装的模型并刷新状态。
     */
    const deleteModel = async () => {
        setDeleting(true);
        try {
            await api.deleteModel();
            toast.success(`${displayName} 模型已删除`);
            await refresh();
        } catch (error) {
            toast.error(`删除失败\n${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setDeleting(false);
        }
    };

    return {
        status,
        downloading,
        deleting,
        progress,
        phase,
        refresh,
        download,
        cancelDownload,
        deleteModel,
    };
}
