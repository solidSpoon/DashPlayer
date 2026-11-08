import React from 'react';
import { Maximize, Pause, Play } from 'lucide-react';
import { formatClock, t } from './lib';

interface VideoBarProps {
    /** 视频当前是否暂停。 */
    paused: boolean;
    /** 当前播放位置，单位秒。 */
    position: number;
    /** 视频总时长，单位秒；未知时为 0，此时进度条禁用。 */
    duration: number;
    /** 视频是否加载失败；失败时整条控件禁用。 */
    disabled: boolean;
    onTogglePlay: () => void;
    onSeek: (seconds: number) => void;
    onFullscreen: () => void;
}

/**
 * 压在视频下沿的播放控件：播放/暂停、进度条、时间、全屏。
 *
 * 为什么要自绘：`<video controls>` 会让 iOS 在暂停时浮出系统控件层（左上展开箭头、
 * 右上静音与全屏、中央播放与 ±10 秒），那些位置和我们叠在视频上的返回/设置圆钮
 * 反复打架，且位置不受页面控制。去掉原生 controls 后视频区只有这一层。
 *
 * 拖动进度条时本地先跟手（`scrub`），松手才真正 seek——一次拖动会连发几十个 input，
 * 每个都 seek 会让服务端反复重开 Range 请求。
 *
 * @param props 播放状态与三个操作。
 */
const VideoBar = ({
    paused,
    position,
    duration,
    disabled,
    onTogglePlay,
    onSeek,
    onFullscreen,
}: VideoBarProps) => {
    /** 拖动中的预览位置；没在拖动时为 null，显示真实播放位置。 */
    const [scrub, setScrub] = React.useState<number | null>(null);

    const shown = scrub ?? position;
    /** 已播部分占整条的比例，用来给进度条上色（0~1）。 */
    const ratio = duration > 0 ? Math.min(1, Math.max(0, shown / duration)) : 0;

    /**
     * 把这次拖动落成真正的跳转。
     *
     * 松手、触摸取消、失焦都要收口，否则 `scrub` 会一直盖住真实位置。
     */
    const commit = (): void => {
        if (scrub === null) {
            return;
        }
        onSeek(scrub);
        setScrub(null);
    };

    return (
        <div
            className={paused ? 'video-bar' : 'video-bar playing'}
            onPointerDown={(event) => event.stopPropagation()}
        >
            <button
                type="button"
                className="vb-btn"
                disabled={disabled}
                aria-label={paused ? t('播放', 'Play') : t('暂停', 'Pause')}
                onClick={onTogglePlay}
            >
                {paused
                    ? <Play size={20} strokeWidth={2} fill="currentColor" aria-hidden />
                    : <Pause size={20} strokeWidth={2} fill="currentColor" aria-hidden />}
            </button>
            <input
                className="vb-seek"
                type="range"
                min={0}
                max={duration > 0 ? duration : 0}
                step={0.1}
                value={duration > 0 ? Math.min(shown, duration) : 0}
                disabled={disabled || duration <= 0}
                aria-label={t('播放进度', 'Playback position')}
                style={{ '--played': `${ratio * 100}%` } as React.CSSProperties}
                onChange={(event) => setScrub(Number(event.target.value))}
                onPointerUp={commit}
                onPointerCancel={commit}
                onTouchEnd={commit}
                onBlur={commit}
            />
            <span className="vb-time">
                {formatClock(shown)}
                {duration > 0 ? ` / ${formatClock(duration)}` : ''}
            </span>
            <button
                type="button"
                className="vb-btn"
                disabled={disabled}
                aria-label={t('全屏', 'Fullscreen')}
                onClick={onFullscreen}
            >
                <Maximize size={18} strokeWidth={2} aria-hidden />
            </button>
        </div>
    );
};

export default VideoBar;
