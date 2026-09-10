import UrlUtil from '@/common/utils/UrlUtil';

/**
 * 修复产物的真机试播验收。
 *
 * 后端已经用 ffprobe 校验过结构，这里再用真正要播它的引擎试播一次：
 * 容器能否解析、时长是否有效、该有画面的有没有解出画面、该有声音的有没有解出声音。
 * 只有验收通过，播放器才会切到产物，避免「修完还是不能播」被当成成功。
 */

/** 等待元数据的超时时间，单位为毫秒。 */
const METADATA_TIMEOUT_MS = 15000;

/** 试播时长，单位为毫秒；足够让解码器产出可判定的数据量。 */
const PLAY_PROBE_MS = 1600;

/** 认定「播放确实前进」的最小播放位置，单位为秒。 */
const MIN_PROGRESS_SECOND = 0.2;

export interface PlaybackVerificationTarget {
    /** 该媒体预期要有视频画面。 */
    expectVideo: boolean;
    /** 该媒体预期要有声音。 */
    expectAudio: boolean;
}

export interface PlaybackVerificationResult {
    /** 验收是否通过。 */
    ok: boolean;
    /** 试播是否真的跑起来了；为 false 时计数不可信，不能据此判定文件有问题。 */
    conclusive: boolean;
    /** 未通过时的简短原因，用于日志与提示。 */
    detail?: string;
}

/**
 * 在隐藏的媒体元素里静默试播修复产物并给出验收结论。
 *
 * 试播会把元素设为静音，因此不会打扰用户当前正在看的内容，
 * 也不影响解码计数（解码在音量处理之前完成）。
 *
 * @param outputPath 修复产物绝对路径。
 * @param target 期望解出的内容。
 * @returns 验收结论。
 */
export async function verifyRepairedPlayback(
    outputPath: string,
    target: PlaybackVerificationTarget,
): Promise<PlaybackVerificationResult> {
    // 统一用 video 元素：它同时能播纯音频文件，也让验收代码不必区分两种元素类型。
    const element = document.createElement('video');
    element.src = UrlUtil.toUrl(outputPath);
    element.preload = 'auto';
    element.muted = true;
    element.volume = 0;
    // 放在视口外而不是 display:none，避免部分情况下浏览器跳过解码。
    element.style.position = 'fixed';
    element.style.left = '-10000px';
    element.style.width = '2px';
    element.style.height = '2px';
    document.body.appendChild(element);

    try {
        const loaded = await waitForMetadata(element);
        if (!loaded) {
            return { ok: false, conclusive: true, detail: 'meta-load-failed' };
        }
        if (!(element.duration > 0)) {
            return { ok: false, conclusive: true, detail: 'invalid-duration' };
        }

        const progressed = await playBriefly(element);
        const decoded = readDecodedBytes(element);
        if (target.expectVideo && (!(element.videoWidth > 0) || decoded.video === 0)) {
            return {
                ok: false,
                conclusive: progressed,
                detail: `video-not-decoded:${element.videoWidth}x${element.videoHeight}:${decoded.video}`,
            };
        }
        if (target.expectAudio && decoded.audio === 0) {
            return { ok: false, conclusive: progressed, detail: 'audio-not-decoded' };
        }
        return { ok: true, conclusive: true };
    } finally {
        element.pause();
        element.removeAttribute('src');
        element.load();
        element.remove();
    }
}

/**
 * 等待媒体元数据或错误事件。
 *
 * @param element 用于试播的媒体元素。
 * @returns 元数据加载成功时返回 `true`。
 */
function waitForMetadata(element: HTMLMediaElement): Promise<boolean> {
    return new Promise((resolve) => {
        const finish = (ok: boolean) => {
            clearTimeout(timer);
            element.removeEventListener('loadedmetadata', onLoaded);
            element.removeEventListener('error', onError);
            resolve(ok);
        };
        const onLoaded = () => finish(true);
        const onError = () => finish(false);
        const timer = setTimeout(() => finish(false), METADATA_TIMEOUT_MS);
        element.addEventListener('loadedmetadata', onLoaded, { once: true });
        element.addEventListener('error', onError, { once: true });
    });
}

/**
 * 静默试播一小段，让解码器产出足够判定的数据。
 *
 * @param element 用于试播的媒体元素。
 * @returns 播放确实前进时返回 `true`；被自动播放策略拦下或卡住时返回 `false`。
 */
async function playBriefly(element: HTMLMediaElement): Promise<boolean> {
    try {
        await element.play();
    } catch {
        // 自动播放被拒：不抛错，靠下面的进度判定给出「不确定」结论。
    }
    await new Promise((resolve) => setTimeout(resolve, PLAY_PROBE_MS));
    return element.currentTime > MIN_PROGRESS_SECOND;
}

/**
 * 读取 Chromium 的解码字节计数。
 *
 * @param element 用于试播的媒体元素。
 * @returns 视频与音频的累计解码字节数；浏览器不提供该计数时返回 0。
 */
function readDecodedBytes(element: HTMLMediaElement): { video: number; audio: number } {
    const probe = element as HTMLMediaElement & {
        webkitVideoDecodedByteCount?: number;
        webkitAudioDecodedByteCount?: number;
    };
    return {
        video: probe.webkitVideoDecodedByteCount ?? 0,
        audio: probe.webkitAudioDecodedByteCount ?? 0,
    };
}
