import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { AudioLines, FolderOpen, Loader2, Trash2 } from 'lucide-react';

import { DubbingExportStatus, DubbingLibraryEntry } from '@/common/contracts/dubbing';
import { dubbingApi } from '@/fronted/features/player/dubbing/dubbingApi';
import { registerRendererApi } from '@/fronted/infrastructure/electron/rendererApiRegistry';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import PageHeader from '@/fronted/components/shared/common/PageHeader';
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
} from '@/fronted/components/ui/alert-dialog';

const logger = getRendererLogger('DubbingExportPage');

/**
 * 单行导出任务的界面状态；仅在该行有过导出动作后存在。
 */
type RowExportState =
    | { stage: 'running'; progress: number }
    | { stage: 'done'; outputPath: string }
    | { stage: 'failed'; message: string };

/**
 * 后端导出状态 → 单行界面状态。
 *
 * completed 时 outputPath 由后端保证给出（成功即有产物路径）。
 */
const statusToRowState = (status: DubbingExportStatus): RowExportState => {
    if (status.status === 'running') {
        return { stage: 'running', progress: status.progress };
    }
    if (status.status === 'completed') {
        return { stage: 'done', outputPath: status.outputPath! };
    }
    return { stage: 'failed', message: status.message ?? '' };
};

/**
 * 配音导出页。
 *
 * 列出所有「视频文件仍存在且录过音」的视频，每行可单独导出（已配音句子替换为录音）或清除配音。
 * 播放器控制台的导出按钮只是进入本页的快捷方式，真正的导出动作在这里完成。
 *
 * 行状态唯一真相源是后端：导出是后台长任务，用户可能中途离开本页，回来时靠挂载查询
 * 恢复状态；进行中的进度则由后端持续推送，本页发起导出的 promise 只负责完成/失败 toast。
 */
export default function DubbingExportPage() {
    const { t } = useTranslation('pages');

    const [entries, setEntries] = useState<DubbingLibraryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [rowStates, setRowStates] = useState<Record<string, RowExportState>>({});
    const [pendingClear, setPendingClear] = useState<DubbingLibraryEntry | null>(null);

    // 后端同一时间只允许一个导出任务；有行在跑时禁用所有行的动作按钮
    const exporting = Object.values(rowStates).some((state) => state.stage === 'running');

    const loadEntries = useCallback(async (): Promise<void> => {
        try {
            setEntries(await dubbingApi.listLibrary());
        } catch (error) {
            logger.error('加载配音列表失败', { error });
            toast.error(t('dubbingExport.loadFailed'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void loadEntries();
    }, [loadEntries]);

    // 挂载时恢复最近一次导出任务的状态：任务可能在离开本页期间完成或失败
    useEffect(() => {
        dubbingApi.exportStatus().then((status) => {
            if (status) {
                setRowStates((prev) => ({ ...prev, [status.videoKey]: statusToRowState(status) }));
            }
        }, (error) => {
            logger.warn('查询配音导出状态失败', { error });
        });
    }, []);

    // 行状态只来自后端推送；completed/failed 与本页 promise 的结果同源，不会分叉
    useEffect(() => {
        return registerRendererApi('dubbing/export-status-update', (params) => {
            setRowStates((prev) => ({ ...prev, [params.videoKey]: statusToRowState(params) }));
        });
    }, []);

    const handleExport = async (entry: DubbingLibraryEntry): Promise<void> => {
        const folders = await dubbingApi.selectFolder({ createDirectory: true });
        const outputFolder = folders?.[0];
        if (!outputFolder) {
            return;
        }
        try {
            await dubbingApi.export({ videoKey: entry.videoKey, outputFolder });
            toast.success(t('dubbingExport.exported'));
        } catch (error) {
            logger.error('配音导出失败', { error, videoKey: entry.videoKey });
            toast.error(error instanceof Error ? error.message : String(error));
        }
    };

    const handleClear = async (entry: DubbingLibraryEntry): Promise<void> => {
        try {
            await dubbingApi.clearVideo(entry.videoKey);
            setRowStates((prev) => {
                const next = { ...prev };
                delete next[entry.videoKey];
                return next;
            });
            await loadEntries();
            toast.success(t('dubbingExport.cleared'));
        } catch (error) {
            logger.error('清除配音失败', { error, videoKey: entry.videoKey });
            toast.error(t('dubbingExport.clearFailed'));
        } finally {
            setPendingClear(null);
        }
    };

    const renderRowState = (entry: DubbingLibraryEntry): ReactNode => {
        const state = rowStates[entry.videoKey];
        if (!state) {
            return null;
        }
        if (state.stage === 'running') {
            return (
                <div className="flex items-center gap-2 w-40">
                    <Progress value={state.progress} className="flex-1" />
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {t('dubbingExport.exporting', { progress: state.progress })}
                    </span>
                </div>
            );
        }
        if (state.stage === 'done') {
            return (
                <button
                    type="button"
                    onClick={() => void dubbingApi.openFolder(state.outputPath)}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    <FolderOpen className="w-3.5 h-3.5" />
                    {t('dubbingExport.openFolder')}
                </button>
            );
        }
        return <span className="text-xs text-red-500">{state.message || t('dubbingExport.exportFailed')}</span>;
    };

    return (
        <div className="w-full h-full flex flex-col overflow-hidden select-none bg-background text-foreground">
            <div className="px-6 pt-5 pb-2">
                <PageHeader title={t('dubbingExport.title')} description={t('dubbingExport.description')} />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-5 pt-1">
                {loading ? (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                ) : entries.length === 0 ? (
                    <div className="w-full h-full flex flex-col gap-3 items-center justify-center text-center text-muted-foreground/60">
                        <AudioLines className="w-8 h-8 text-muted-foreground/40" />
                        <h3 className="text-base font-medium text-foreground/80">{t('dubbingExport.empty.title')}</h3>
                        <p className="text-xs max-w-sm leading-5">{t('dubbingExport.empty.guide')}</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {entries.map((entry) => (
                            <div
                                key={entry.videoKey}
                                className="flex items-center gap-4 rounded-xl border border-border/60 bg-card px-4 py-3"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium text-foreground truncate" title={entry.videoPath}>
                                        {entry.videoName}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                        {t('dubbingExport.recordedCount', { count: entry.dubbedSentenceCount })}
                                        <span className="mx-1.5">·</span>
                                        {t('dubbingExport.updatedAt', { time: new Date(entry.updatedAt).toLocaleString() })}
                                    </div>
                                </div>

                                {renderRowState(entry)}

                                <div className="flex items-center gap-1.5 shrink-0">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-lg"
                                        disabled={exporting}
                                        onClick={() => void handleExport(entry)}
                                    >
                                        {t('dubbingExport.export')}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                        disabled={exporting}
                                        onClick={() => setPendingClear(entry)}
                                        aria-label={t('dubbingExport.clear')}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <AlertDialog open={pendingClear !== null} onOpenChange={(open) => !open && setPendingClear(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('dubbingExport.clearTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('dubbingExport.clearDescription', { name: pendingClear?.videoName ?? '' })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('dubbingExport.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 text-white hover:bg-red-600/90"
                            onClick={() => pendingClear && void handleClear(pendingClear)}
                        >
                            {t('dubbingExport.clearConfirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
