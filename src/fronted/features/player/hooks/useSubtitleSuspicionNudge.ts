/**
 * 判断当前视频是否需要向用户提示字幕可疑。
 */
import useSWR from 'swr';
import { SWR_KEY } from '@/fronted/lib/swr-util';
import useFile from '@/fronted/features/file-browser/fileStore';
import { transcriptApi } from '@/fronted/features/transcript/transcriptApi';
import { isTaskPendingOrRunning } from '@/common/contracts/transcript/transcript-task';
import { useSubtitleSuspicion } from '@/fronted/features/player/subtitleSuspicion';

/**
 * 当前视频是否该提示字幕可疑，引导 toast 与转录按钮圆点共用同一判断。
 *
 * 已有排队中或正在跑的转录任务时不再提示：用户已经在等这份字幕生成，
 * 再引导一次既没有意义，点下去也会因任务已在队列而静默失败。
 *
 * @returns 是否需要提示；字幕不可疑或已有未跑完的转录任务时为 false。
 */
export function useSubtitleSuspicionNudge(): boolean {
    const hasSuspicion = useSubtitleSuspicion((s) => s.reasons.length > 0);
    const videoPath = useFile((s) => s.videoPath);
    const { data: tasks = [] } = useSWR(SWR_KEY.TRANSCRIPTION_TASKS, transcriptApi.listTasks);
    if (!hasSuspicion) {
        return false;
    }
    return !tasks.some((task) => task.file === videoPath && isTaskPendingOrRunning(task.status));
}
