import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { AudioLines, Loader2 } from 'lucide-react';

import type { DubbingExportStatus, DubbingLibraryEntry } from '@/common/contracts/dubbing';
import UrlUtil from '@/common/utils/UrlUtil';
import { dubbingApi } from '@/fronted/features/player/dubbing/dubbingApi';
import { registerRendererApi } from '@/fronted/infrastructure/electron/rendererApiRegistry';
import { requestVideoThumbnail } from '@/fronted/lib/video-thumbnail';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import PageHeader from '@/fronted/components/shared/common/PageHeader';
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
import { cn } from '@/fronted/lib/utils';
import DubbingPreviewPane, { type VideoExportState } from './components/DubbingPreviewPane';

const logger = getRendererLogger('DubbingExportPage');

/**
 * 后端导出状态 → 单条视频的界面导出状态。
 *
 * completed 时 outputPath 由后端保证给出（成功即有产物路径）。
 */
const statusToRowState = (status: DubbingExportStatus): VideoExportState => {
    if (status.status === 'running') {
        return { stage: 'running', progress: status.progress };
    }
    if (status.status === 'completed') {
        return { stage: 'done', outputPath: status.outputPath! };
    }
    return { stage: 'failed', message: status.message ?? '' };
};

/**
 * 配音导出页（两栏布局）。
 *
 * 左栏展示已配音视频的缩略图、标题与已录句数；
 * 右栏联动展示当前选中视频的精简播放器、右上角导出按钮与上下文折叠字幕列表。
 */
export default function DubbingExportPage() {
    const { t } = useTranslation('pages');

    const [entries, setEntries] = useState<DubbingLibraryEntry[]>([]);
    const [selectedVideoKey, setSelectedVideoKey] = useState<string | null>(null);
    const [thumbnails, setThumbnails] = useState<Record<string, string | null>>({});
    const [loading, setLoading] = useState(true);
    const [rowStates, setRowStates] = useState<Record<string, VideoExportState>>({});
    const [pendingClear, setPendingClear] = useState<DubbingLibraryEntry | null>(null);

    // 后端同一时间只允许一个导出任务；有行在跑时禁用所有行的动作按钮
    const exporting = Object.values(rowStates).some((state) => state.stage === 'running');

    const loadEntries = useCallback(async (): Promise<void> => {
        try {
            const list = await dubbingApi.listLibrary();
            setEntries(list);
            setSelectedVideoKey((prev) => {
                if (prev && list.some((item) => item.videoKey === prev)) {
                    return prev;
                }
                return list[0]?.videoKey ?? null;
            });
        } catch (error) {
            logger.error('加载配音列表失败', { error });
            toast.error(t('dubbingExport.loadFailed'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    // 挂载后拉一次列表。这里显式 await：loadEntries 的 setEntries / setLoading
    // 都发生在 await 之后，不 await 的话编译器会把整串更新当成 effect 内的同步
    // setState（react-hooks/set-state-in-effect），从而判定这个组件不可优化。
    useEffect(() => {
        void (async () => {
            await loadEntries();
        })();
    }, [loadEntries]);

    // 为列表中的视频按需生成低分辨率缩略图（纯音频返回 null 显示占位图标）
    useEffect(() => {
        let cancelled = false;
        const missing = entries.filter((item) => !(item.videoKey in thumbnails));
        if (missing.length === 0) {
            return;
        }
        void (async () => {
            const updates: Record<string, string | null> = {};
            for (const item of missing) {
                try {
                    const thumbPath = await requestVideoThumbnail({
                        filePath: item.videoPath,
                        time: 1,
                        quality: 'low',
                        width: 240,
                    });
                    updates[item.videoKey] = thumbPath ? UrlUtil.toUrl(thumbPath) : null;
                } catch {
                    updates[item.videoKey] = null;
                }
            }
            if (!cancelled) {
                setThumbnails((prev) => ({ ...prev, ...updates }));
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [entries, thumbnails]);

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

    const selectedEntry = entries.find((item) => item.videoKey === selectedVideoKey) ?? null;

    return (
        <div className="w-full h-full flex flex-col overflow-hidden select-none bg-background text-foreground">
            <div className="px-6 pt-5 pb-2">
                <PageHeader title={t('dubbingExport.title')} description={t('dubbingExport.description')} />
            </div>

            <div className="flex-1 min-h-0 px-6 pb-5 pt-1 overflow-hidden">
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
                    <div
                        className="w-full h-full min-h-0 grid gap-5"
                        style={{
                            gridTemplateColumns: 'minmax(340px, 0.85fr) minmax(460px, 1.15fr)',
                            gridTemplateRows: '100%',
                        }}
                    >
                        {/* 左栏：缩略图 + 标题 + 已录句数 */}
                        <div className="h-full min-h-0 overflow-y-auto pr-2 border-r border-border/40 flex flex-col gap-2">
                            {entries.map((entry) => {
                                const isSelected = entry.videoKey === selectedVideoKey;
                                const thumbUrl = thumbnails[entry.videoKey];
                                const state = rowStates[entry.videoKey];
                                return (
                                    <div
                                        key={entry.videoKey}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setSelectedVideoKey(entry.videoKey)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setSelectedVideoKey(entry.videoKey);
                                            }
                                        }}
                                        className={cn(
                                            'rounded-xl border p-2.5 cursor-pointer transition-colors',
                                            isSelected
                                                ? 'border-primary/50 bg-accent/50'
                                                : 'border-border/60 bg-card hover:bg-accent/30',
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-20 h-[45px] shrink-0 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                                                {thumbUrl ? (
                                                    <img
                                                        src={thumbUrl}
                                                        alt={entry.videoName}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <AudioLines className="w-4 h-4 text-muted-foreground/50" />
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs font-medium text-foreground truncate" title={entry.videoPath}>
                                                    {entry.videoName}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground mt-1">
                                                    {t('dubbingExport.recordedCount', { count: entry.dubbedSentenceCount })}
                                                    {entry.updatedAt > 0 && (
                                                        <>
                                                            <span className="mx-1">·</span>
                                                            {new Date(entry.updatedAt).toLocaleDateString()}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {state?.stage === 'running' && (
                                            <div className="flex items-center gap-2 mt-2">
                                                <Progress value={state.progress} className="flex-1 h-1" />
                                                <span className="text-[10px] text-muted-foreground tabular-nums">
                                                    {state.progress}%
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* 右栏：精简播放器 + 右上角导出 + 上下文折叠列表 */}
                        <div className="h-full min-h-0 overflow-hidden">
                            {selectedEntry && (
                                <DubbingPreviewPane
                                    key={selectedEntry.videoKey}
                                    entry={selectedEntry}
                                    exportState={rowStates[selectedEntry.videoKey]}
                                    exporting={exporting}
                                    onExport={() => void handleExport(selectedEntry)}
                                    onClearVideo={() => setPendingClear(selectedEntry)}
                                    onSentenceCleared={loadEntries}
                                />
                            )}
                        </div>
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
