import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { codeBlock } from 'common-tags';
import { useTranslation } from 'react-i18next';
import { AudioLines } from 'lucide-react';

import useFile from '@/fronted/features/file-browser/fileStore';
import { usePlayer } from '@/fronted/features/player/playerStore';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { registerRendererApi } from '@/fronted/infrastructure/electron/rendererApiRegistry';
import TooltippedButton from '@/fronted/components/shared/common/TooltippedButton';
import { Button } from '@/fronted/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/fronted/components/ui/dialog';
import { Progress } from '@/fronted/components/ui/progress';
import { dubbingApi } from '../dubbingApi';
import { useDubbing } from '../dubbingStore';

const logger = getRendererLogger('DubbingExportButton');

interface DubbingExportButtonProps {
    className?: string;
}

type ExportState =
    | { stage: 'idle' }
    | { stage: 'running'; progress: number }
    | { stage: 'done'; outputPath: string }
    | { stage: 'failed'; message: string };

/**
 * 控制台"导出配音视频"按钮。
 *
 * 点击弹出对话框确认配音进度，选择导出目录后把已配音句子的音频替换为用户录音
 * （超长自动变速对齐句长），其余句子保留原声，导出为完整视频。
 */
export default function DubbingExportButton({ className }: DubbingExportButtonProps) {
    const { t } = useTranslation('player');
    const srtHash = useFile((s) => s.srtHash);
    const videoPath = useFile((s) => s.videoPath);
    const manifest = useDubbing((s) => s.manifest);
    const totalSentences = usePlayer((s) => s.sentences.length);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [exportState, setExportState] = useState<ExportState>({ stage: 'idle' });

    const dubbedCount = manifest ? Object.keys(manifest.sentences).length : 0;
    const canExport = !!srtHash && !!videoPath && dubbedCount > 0;

    // 导出期间监听后端进度推送
    useEffect(() => {
        if (!dialogOpen || !srtHash) {
            return;
        }
        return registerRendererApi('dubbing/export-status-update', (params) => {
            if (params.videoKey !== srtHash) {
                return;
            }
            if (params.status === 'running') {
                setExportState({ stage: 'running', progress: params.progress });
            }
        });
    }, [dialogOpen, srtHash]);

    const handleOpenDialog = (): void => {
        if (!canExport) {
            toast(t('dubbing.export.nothingToExport'), { icon: 'ℹ️' });
            return;
        }
        setExportState({ stage: 'idle' });
        setDialogOpen(true);
    };

    /**
     * 组装导出片段：已配音句子按调轴后的有效时间区间计算。
     */
    const buildSegments = (): Array<{ index: number; startSecond: number; endSecond: number }> => {
        const sentences = usePlayer.getState().sentences;
        const currentManifest = useDubbing.getState().manifest;
        if (!currentManifest) {
            return [];
        }
        return sentences
            .filter((sentence) => !!currentManifest.sentences[String(sentence.index)])
            .map((sentence) => ({
                index: sentence.index,
                startSecond: sentence.adjustedStart ?? sentence.start,
                endSecond: sentence.adjustedEnd ?? sentence.end,
            }));
    };

    const handleStartExport = async (): Promise<void> => {
        if (!srtHash || !videoPath) {
            return;
        }
        const segments = buildSegments();
        if (segments.length === 0) {
            toast.error(t('dubbing.export.nothingToExport'));
            return;
        }
        const folders = await dubbingApi.selectFolder({ createDirectory: true });
        const outputFolder = folders?.[0];
        if (!outputFolder) {
            return;
        }

        setExportState({ stage: 'running', progress: 0 });
        try {
            const outputPath = await dubbingApi.export({
                videoKey: srtHash,
                videoPath,
                outputFolder,
                segments,
            });
            setExportState({ stage: 'done', outputPath });
        } catch (error) {
            logger.error('配音导出失败', { error });
            setExportState({
                stage: 'failed',
                message: error instanceof Error ? error.message : String(error),
            });
        }
    };

    const buttonText = t('dubbing.export.button', { count: dubbedCount });

    const tooltipMd = codeBlock`
    #### ${t('dubbing.export.tooltipTitle')}
    _${t('dubbing.export.tooltipSubtitle')}_

    ${t('dubbing.export.currentProgress', { dubbed: dubbedCount, total: totalSentences })}
    1. ${t('dubbing.export.workflow1')}
    2. ${t('dubbing.export.workflow2')}
    3. ${t('dubbing.export.workflow3')}
    `;

    return (
        <>
            <TooltippedButton
                icon={AudioLines}
                text={buttonText}
                disabled={!canExport}
                onClick={handleOpenDialog}
                tooltipMd={tooltipMd}
                variant="ghost"
                className={className}
            />

            <Dialog open={dialogOpen} onOpenChange={(open) => {
                // 导出中不允许关闭对话框，避免误以为取消
                if (exportState.stage === 'running' && !open) {
                    return;
                }
                setDialogOpen(open);
            }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('dubbing.export.dialogTitle')}</DialogTitle>
                        <DialogDescription>
                            {t('dubbing.export.dialogSummary', { dubbed: dubbedCount, total: totalSentences })}
                        </DialogDescription>
                    </DialogHeader>

                    {exportState.stage === 'idle' && (
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                {t('dubbing.export.cancel')}
                            </Button>
                            <Button onClick={() => void handleStartExport()}>
                                {t('dubbing.export.start')}
                            </Button>
                        </DialogFooter>
                    )}

                    {exportState.stage === 'running' && (
                        <div className="flex flex-col gap-2 py-2">
                            <Progress value={exportState.progress} />
                            <div className="text-xs text-muted-foreground tabular-nums text-center">
                                {t('dubbing.export.inProgress', { progress: exportState.progress })}
                            </div>
                        </div>
                    )}

                    {exportState.stage === 'done' && (
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    void dubbingApi.openFolder(exportState.outputPath);
                                }}
                            >
                                {t('dubbing.export.openFolder')}
                            </Button>
                            <Button onClick={() => setDialogOpen(false)}>
                                {t('dubbing.export.done')}
                            </Button>
                        </DialogFooter>
                    )}

                    {exportState.stage === 'failed' && (
                        <div className="flex flex-col gap-3 py-2">
                            <div className="text-xs text-red-500 break-all">{exportState.message}</div>
                            <DialogFooter>
                                <Button onClick={() => setDialogOpen(false)}>
                                    {t('dubbing.export.close')}
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
