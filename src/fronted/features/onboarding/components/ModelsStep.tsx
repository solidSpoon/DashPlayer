import React from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { CheckCircle2, Download, Loader2, Mic, Square, Volume2 } from 'lucide-react';
import { Button } from '@/fronted/components/ui/button';
import { Progress } from '@/fronted/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/fronted/components/ui/card';
import { cn } from '@/fronted/lib/utils';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import type { ModelInstallationStatusVO } from '@/common/types/vo/model-installation-vo';
import type { ModelDownloadPhase } from '@/common/contracts/model-download-phase';
import ManualDownloadGuide from './ManualDownloadGuide';

/**
 * 归档类本地模型（Parakeet 转录 / Sherpa TTS）共用的下载状态管理。
 *
 * 模型状态由后端 IPC 提供，下载进度由主进程事件持续推送；phase 回到 idle
 * 表示下载任务结束（成功/失败/取消），此时重新拉取状态复位界面。
 *
 * @param opts.getStatus 查询模型安装状态的接口。
 * @param opts.download 开始下载的接口。
 * @param opts.cancel 取消下载的接口。
 * @param opts.progressEventName 进度推送的 window 事件名。
 */
function useArchiveModelDownload(opts: {
    getStatus: () => Promise<ModelInstallationStatusVO>;
    download: () => Promise<unknown>;
    cancel: () => Promise<{ cancelled: boolean }>;
    progressEventName: string;
}) {
    const { getStatus, download, cancel, progressEventName } = opts;
    const [status, setStatus] = React.useState<ModelInstallationStatusVO | null>(null);
    const [busy, setBusy] = React.useState(false);
    const [percent, setPercent] = React.useState(0);
    const [phase, setPhase] = React.useState<ModelDownloadPhase>('downloading');

    /** 拉取最新安装状态；下载结束后由 idle 事件触发，复位进度显示。 */
    const refresh = React.useCallback(() => {
        getStatus().then(setStatus).catch((error) => {
            toast.error(error instanceof Error ? error.message : String(error));
        });
    }, [getStatus]);

    React.useEffect(() => {
        refresh();
    }, [refresh]);

    React.useEffect(() => {
        const handler = (event: Event) => {
            const progress = (event as CustomEvent<{
                percent: number;
                phase: ModelDownloadPhase;
            }>).detail;
            setPercent(progress.percent);
            setPhase(progress.phase);
            if (progress.phase === 'idle') {
                refresh();
            }
        };
        window.addEventListener(progressEventName, handler);
        return () => window.removeEventListener(progressEventName, handler);
    }, [progressEventName, refresh]);

    /**
     * 开始下载；busy 状态由调用方 promise 结束复位，进度期间显示取消按钮。
     */
    const startDownload = async () => {
        setBusy(true);
        setPercent(0);
        setPhase('downloading');
        try {
            await download();
        } finally {
            setBusy(false);
            refresh();
        }
    };

    /**
     * 取消下载；返回后端是否确认取消，供调用方提示。
     */
    const cancelDownload = async (): Promise<boolean> => {
        const result = await cancel();
        return result.cancelled;
    };

    return { status, busy, percent, phase, download: startDownload, cancel: cancelDownload };
}

/** 单个语音模型卡片的展示参数。 */
interface ModelCardProps {
    /** 模型名称，如 “Parakeet TDT 0.6B v3”。 */
    name: string;
    /** 模型用途说明。 */
    description: string;
    /** 展示用体积标签，如 “~640 MB”。 */
    sizeLabel: string;
    /** 定位徽标：recommended 表示核心功能建议下载，optional 表示可选。 */
    badge: 'recommended' | 'optional';
    /** 图标。 */
    icon: React.ComponentType<{ className?: string }>;
    /** 下载状态管理句柄，由 useArchiveModelDownload 提供。 */
    state: {
        status: ModelInstallationStatusVO | null;
        busy: boolean;
        percent: number;
        phase: ModelDownloadPhase;
        download: () => Promise<void>;
        cancel: () => Promise<boolean>;
    };
}

/** 归档模型卡片：展示就绪状态、下载进度，并提供下载/取消操作。 */
const ModelCard = ({ name, description, sizeLabel, badge, icon: Icon, state }: ModelCardProps) => {
    const { t } = useTranslation('onboarding');

    /**
     * 下载并按结果提示；失败与取消在 toast 中显式暴露。
     */
    const handleDownload = async () => {
        try {
            await state.download();
            toast.success(`${name}: ${t('models.downloadDone')}`);
        } catch (error) {
            toast.error(`${name}: ${t('models.downloadFailed')}\n${error instanceof Error ? error.message : String(error)}`);
        }
    };

    /**
     * 取消下载；后端确认取消时才提示，避免重复取消产生噪音。
     */
    const handleCancel = async () => {
        try {
            if (await state.cancel()) {
                toast.success(`${name}: ${t('models.downloadCancelled')}`);
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        }
    };

    const ready = state.status?.ready ?? false;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Icon className="h-4 w-4" />
                        {name}
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{sizeLabel}</span>
                    </CardTitle>
                    {ready ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {t('models.ready')}
                        </span>
                    ) : (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t('models.notDownloaded')}</span>
                    )}
                </div>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                    <span className={cn(
                        'rounded px-1.5 py-0.5 text-xs font-medium',
                        badge === 'recommended' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                    )}>
                        {t(`models.badge.${badge}`)}
                    </span>
                    {!ready && !state.busy && (
                        <Button type="button" size="sm" onClick={() => handleDownload()}>
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            {t('models.download')}
                        </Button>
                    )}
                    {state.busy && state.phase === 'downloading' && (
                        <Button type="button" variant="outline" size="sm" onClick={() => handleCancel()}>
                            <Square className="mr-1.5 h-3 w-3 text-destructive" />
                            {t('models.cancelDownload')}
                        </Button>
                    )}
                    {state.busy && state.phase !== 'downloading' && (
                        <Button type="button" variant="outline" size="sm" disabled>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            {t(`models.phase.${state.phase}`)}
                        </Button>
                    )}
                </div>
                {state.busy && state.phase === 'downloading' && (
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{t('models.phase.downloading')}</span>
                            <span>{state.percent}%</span>
                        </div>
                        <Progress value={state.percent} className="h-1.5" />
                    </div>
                )}
                {!ready && state.status && (
                    <ManualDownloadGuide
                        url={state.status.downloadUrl}
                        path={state.status.archivePath}
                        footerText={t('manual.archiveFooter')}
                    />
                )}
            </CardContent>
        </Card>
    );
};

/**
 * 引导第二步：下载语音模型。
 *
 * 转录模型（Parakeet）是导入视频生成字幕的核心依赖，发音模型（Sherpa TTS）
 * 用于生词朗读，两者均为可选下载，可稍后在「服务凭据」页补齐。
 */
const ModelsStep = () => {
    const { t } = useTranslation('onboarding');

    const parakeet = useArchiveModelDownload({
        getStatus: settingsApi.getParakeetModelStatus,
        download: settingsApi.downloadParakeetModel,
        cancel: settingsApi.cancelParakeetModelDownload,
        progressEventName: 'parakeet-model-download-progress',
    });

    const sherpaTts = useArchiveModelDownload({
        getStatus: settingsApi.getSherpaTtsModelStatus,
        download: settingsApi.downloadSherpaTtsModel,
        cancel: settingsApi.cancelSherpaTtsModelDownload,
        progressEventName: 'sherpa-tts-model-download-progress',
    });

    return (
        <div className="flex flex-col gap-5">
            <div className="text-center">
                <h2 className="text-2xl font-bold">{t('models.title')}</h2>
                <p className="text-sm text-muted-foreground mt-2">{t('models.description')}</p>
            </div>
            <ModelCard
                name="Parakeet TDT 0.6B v3"
                description={t('models.transcriptionDescription')}
                sizeLabel="~640 MB"
                badge="recommended"
                icon={Mic}
                state={parakeet}
            />
            <ModelCard
                name="Piper en_US Amy Low"
                description={t('models.ttsDescription')}
                sizeLabel="~18 MB"
                badge="optional"
                icon={Volume2}
                state={sherpaTts}
            />
        </div>
    );
};

export default ModelsStep;
