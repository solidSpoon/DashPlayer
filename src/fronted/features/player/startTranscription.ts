/**
 * 为当前播放的视频启动后端转录任务，并处理通用提示。
 *
 * 生成字幕按钮与字幕引导 toast 共用此入口，保证两处行为一致。
 */
import toast from 'react-hot-toast';
import i18n from '@/fronted/i18n';
import StrUtil from '@/common/utils/str-util';
import useFile from '@/fronted/features/file-browser/fileStore';
import { usePlayer } from '@/fronted/features/player/playerStore';
import { transcriptApi } from '@/fronted/features/transcript/transcriptApi';
import { useSubtitleSuspicion } from '@/fronted/features/player/subtitleSuspicion';

/**
 * 启动当前视频的后端转录任务。
 *
 * 未选择视频或本地模型缺失时弹出错误提示；成功入队后清空字幕可疑状态
 * （引导生成字幕的目的已达成，小圆点与后续提示一并消失）。
 */
export async function startTranscriptionForCurrentVideo(): Promise<void> {
    const videoPath = useFile.getState().videoPath;
    if (StrUtil.isBlank(videoPath)) {
        toast.error(i18n.t('player:transcript.noVideoSelected'));
        return;
    }
    // 仅在点击瞬间读取播放位置作为转录起点，避免订阅高频播放时钟
    const currentPosition = usePlayer.getState().getExactPlayTime();
    const result = await transcriptApi.startTranscription(videoPath, currentPosition);
    if (result === 'model_missing') {
        toast.error(i18n.t('player:transcript.modelMissing'));
        return;
    }
    useSubtitleSuspicion.getState().setReasons([]);
    toast(i18n.t('player:transcript.addedToQueue'), { icon: '👏' });
}
