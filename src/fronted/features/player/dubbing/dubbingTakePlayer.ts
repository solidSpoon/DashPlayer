import { create } from 'zustand';

import UrlUtil from '@/common/utils/UrlUtil';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import { usePlayer } from '@/fronted/features/player/playerStore';
import { resumePlaybackFromSentenceStart } from './dubbingPlayback';

/**
 * 试听/回放状态：正在播的句子序号与倒计时圆环的剩余比例。
 *
 * 触发点有多处（点击录音卡片、短按录音快捷键、录完自动回放），统一订阅这里，
 * 界面不必各自维护一份试听态。
 */
interface TakePlayerState {
    /** 正在播放的句子序号；null 表示当前没有试听 */
    playingIndex: number | null;
    /** 剩余比例 0~1（1=满圈、0=空圈），用于录音卡片外圈的倒计时描边 */
    progress: number;
}

export const useDubbingTakePlayer = create<TakePlayerState>(() => ({ playingIndex: null, progress: 1 }));

/** 当前试听会话：音频元素与试听前的视频播放状态（决定播完是否续播）。 */
interface TakeSession {
    index: number;
    audio: HTMLAudioElement;
    wasPlayingBefore: boolean;
}

/**
 * 进程内唯一的试听会话：同一时刻只允许一路录音在播。
 *
 * 一次性试听（点击卡片、短按快捷键）与录完自动回放共用它，因此天然不会叠音；
 * 新的一路开始前必定先把旧的一路停掉。
 */
let session: TakeSession | null = null;

/** 逐帧驱动倒计时圆环的 rAF 句柄。 */
let rafId: number | null = null;

/**
 * 停止当前试听/回放并断开会话，不改动视频播放状态。
 *
 * @returns 试听开始前视频是否在播放；当前没有试听时返回 false
 */
export function stopTake(): boolean {
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    const current = session;
    if (!current) {
        return false;
    }
    current.audio.onended = null;
    current.audio.pause();
    session = null;
    useDubbingTakePlayer.setState({ playingIndex: null, progress: 1 });
    return current.wasPlayingBefore;
}

/**
 * 停止试听并把播放头挪回当前句句首续播（仅当试听前视频在播放时）。
 *
 * 跳过试听、以及试听自然播完后的善后都走这里，保证“试听完接原声”行为一致。
 */
export function stopTakeAndResume(): void {
    resumePlaybackFromSentenceStart(stopTake());
}

/**
 * 试听某句已录好的配音。
 *
 * 播放前暂停视频避免两路声音叠播；已在试听则先停掉旧的一路再起新的（不恢复播放），
 * 并沿用它记录的“试听前是否在播放”，避免重复试听把续播状态冲成暂停。
 * 播完回到当前句句首续播，方便紧接着听原声对比。
 *
 * @param index 句子序号
 * @param filePath 录音文件绝对路径
 * @param wasPlayingBefore 试听前视频是否在播放；不传则取当前播放状态。
 *        录音流程里视频已被自行暂停，调用方必须显式传入录音前的播放状态
 */
export function playTake(index: number, filePath: string, wasPlayingBefore?: boolean): void {
    const resumeWhenDone = wasPlayingBefore ?? session?.wasPlayingBefore ?? usePlayer.getState().playing;
    if (session) {
        stopTake();
    } else {
        playerActions.pause();
    }
    const audio = new Audio(UrlUtil.toUrl(filePath));
    audio.volume = 0.9;
    session = { index, audio, wasPlayingBefore: resumeWhenDone };
    audio.onended = () => {
        resumePlaybackFromSentenceStart(stopTake());
    };
    useDubbingTakePlayer.setState({ playingIndex: index, progress: 1 });
    const tick = (): void => {
        const current = session;
        if (!current) {
            rafId = null;
            return;
        }
        useDubbingTakePlayer.setState({
            progress: current.audio.duration > 0
                ? Math.max(0, 1 - current.audio.currentTime / current.audio.duration)
                : 1,
        });
        rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    void audio.play();
}
