import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Mic, Square } from 'lucide-react';

import useFile from '@/fronted/features/file-browser/fileStore';
import { cn } from '@/fronted/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { useDubbing } from '../dubbingStore';
import { dubbingControls } from '../dubbingControls';

/**
 * 录音计时徽章：以录音开始时间戳为 key，每场录音重新挂载、从 0 计时。
 */
function RecordingBadge({ recordingStartTs }: { recordingStartTs: number }) {
    const { t } = useTranslation('player');
    const [elapsedSec, setElapsedSec] = useState(0);
    useEffect(() => {
        const timer = window.setInterval(() => {
            setElapsedSec((Date.now() - recordingStartTs) / 1000);
        }, 100);
        return () => window.clearInterval(timer);
    }, [recordingStartTs]);
    return (
        <span className="font-mono text-[10px] font-semibold leading-none text-red-600 dark:text-red-400 tabular-nums">
            {t('dubbing.recording', { seconds: elapsedSec.toFixed(1) })}
        </span>
    );
}

/**
 * 配音录制按钮（主字幕区右下角胶囊控制栏）：点击开始/停止录制当前句，与 Q 键等效。
 *
 * 录音流程状态直接呈现在按钮上：录音中变红色方块并计时，保存中转圈，回放中显示提示徽章。
 */
export default function DubbingRecordButton() {
    const { t } = useTranslation('player');

    const phase = useDubbing((s) => s.phase);
    const recordingStartTs = useDubbing((s) => s.recordingStartTs);
    const srtHash = useFile((s) => s.srtHash);

    if (!srtHash) {
        return null;
    }

    const tooltip = phase === 'recording'
        ? t('dubbing.stop')
        : phase === 'saving'
            ? t('dubbing.saving')
            : phase === 'replaying'
                ? t('dubbing.skipReplay')
                : t('dubbing.record');

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    onClick={() => dubbingControls.primary()}
                    aria-label={tooltip}
                    className={cn(
                        'flex items-center gap-1 px-1 py-1 rounded-full transition-colors',
                        phase === 'recording'
                            ? 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/60'
                            : 'text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-300/60 dark:hover:bg-neutral-600/60'
                    )}
                >
                    {phase === 'recording' ? (
                        <>
                            <Square className="w-3.5 h-3.5 fill-current animate-pulse" />
                            {recordingStartTs && <RecordingBadge key={recordingStartTs} recordingStartTs={recordingStartTs} />}
                        </>
                    ) : phase === 'saving' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : phase === 'replaying' ? (
                        <>
                            <Mic className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                            <span className="text-[10px] font-medium leading-none text-sky-600 dark:text-sky-400 animate-pulse">
                                {t('dubbing.replaying')}
                            </span>
                        </>
                    ) : (
                        <Mic className="w-3.5 h-3.5" />
                    )}
                </button>
            </TooltipTrigger>
            <TooltipContent side="top">{tooltip}</TooltipContent>
        </Tooltip>
    );
}
