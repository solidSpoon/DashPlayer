import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import { usePlayer } from '@/fronted/features/player/playerStore';

/**
 * 播完用户自己的录音后的善后：把播放位置挪回当前句句首并续播。
 *
 * 配音的两条回放路径（试听卡片、录完自动回放）都走这里，保证行为一致：
 * 仅当回放前视频在播放（shouldResume 为真）时才回句首续播，方便紧接着听
 * 原声对比；回放前本就是暂停状态则保持原样、不动播放头，避免打断用户。
 * 定位不到当前句/字幕未就绪时退化为普通播放。
 *
 * @param shouldResume 回放前视频是否在播放
 */
export function resumePlaybackFromSentenceStart(shouldResume: boolean): void {
    if (!shouldResume) {
        return;
    }
    const { currentSentence, srtTender } = usePlayer.getState();
    if (currentSentence && srtTender) {
        const { start } = srtTender.mapSeekTime(currentSentence);
        playerActions.seekToTarget({ time: start, target: currentSentence, play: true });
        return;
    }
    playerActions.play();
}
