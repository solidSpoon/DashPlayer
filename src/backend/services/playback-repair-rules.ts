import path from 'path';
import { Mp3BitrateMode, LearnedCapabilityOverlay, RepairReason, RepairRecipe } from '@/common/contracts/playback-repair';
import MediaUtil from '@/common/utils/MediaUtil';

/**
 * 播放修复的判定规则（纯逻辑，不做任何 I/O）。
 *
 * 判定顺序遵循「先看容器能不能打开，再看单条流能不能解码」：
 * 任何一条不满足都只做必要的最小处理，避免无谓的整片重编码。
 * 能力清单按当前 Electron/Chromium 的实测结果维护，不按扩展名猜。
 */

/**
 * 可以原样搬进 MP4、且 Chromium 能解码的视频编码。
 *
 * 不在表内的编码（MPEG-4 Part 2、MPEG-2、WMV、FLV1 等）一律整片重编码。
 */
const COPYABLE_VIDEO_CODECS = new Set(['h264', 'hevc', 'vp8', 'vp9', 'av1']);

/**
 * 可以原样搬进 MP4、且 Chromium 能解码出声的音频编码。
 *
 * DTS/AC3/EAC3 会被 Chromium 静默丢弃（画面正常但没有声音），
 * FLAC/Vorbis/PCM 等无法装进 MP4，都必须重编码。
 */
const COPYABLE_AUDIO_CODECS = new Set(['aac', 'mp3', 'opus']);

/** Chromium 打不开的视频容器扩展名。 */
const UNSUPPORTED_VIDEO_CONTAINERS = new Set(['.avi', '.wmv', '.flv']);

/** Chromium 打不开的音频容器扩展名。 */
const UNSUPPORTED_AUDIO_CONTAINERS = new Set(['.wma']);

/**
 * 容器需要替换、但音视频编码可原样搬运的扩展名。
 *
 * MKV 在本机 Electron 上实测可直接播放，但跨平台能否直接播放尚未验证，
 * 因此沿用应用既有约定：MKV 一律产出 MP4，音频编码不可搬运时才重编码。
 */
const CONTAINER_SWAP_CONTAINERS = new Set(['.mkv']);

/**
 * 判断视频编码是否可以直接搬进 MP4 并在 Chromium 里解码。
 *
 * @param codec ffprobe 报告的视频编码名。
 * @returns 可以原样搬运时返回 `true`。
 */
export function isCopyableVideoCodec(codec: string): boolean {
    return COPYABLE_VIDEO_CODECS.has(codec.toLowerCase());
}

/**
 * 判断音频编码是否可以直接搬进 MP4 并在 Chromium 里解码出声。
 *
 * @param codec ffprobe 报告的音频编码名。
 * @returns 可以原样搬运时返回 `true`。
 */
export function isCopyableAudioCodec(codec: string): boolean {
    return COPYABLE_AUDIO_CODECS.has(codec.toLowerCase());
}

/**
 * 判定修复所需的事实集合。
 */
export interface PlaybackFacts {
    /** 媒体文件名（含扩展名）。 */
    fileName: string;
    /** 容器内是否存在视频流。 */
    hasVideoStream: boolean;
    /** 容器内是否存在音轨。 */
    hasAudioStream: boolean;
    /** 容器内视频编码；没有视频流时为空。 */
    videoCodec?: string;
    /** 容器内音频编码；没有音轨时为空。 */
    audioCodec?: string;
    /** MP3 的码率模式；非 MP3 文件为空。 */
    mp3BitrateMode?: Mp3BitrateMode;
}

/**
 * 判定结论。
 */
export interface RepairDecision {
    /** 是否需要修复。 */
    needsRepair: boolean;
    /** 结论原因。 */
    reason: RepairReason;
    /** 需要修复时给出的配方。 */
    recipe?: RepairRecipe;
}

/**
 * 判定修复配方；静态白名单为基础，叠加本机实测的学习结论。
 *
 * 学习覆盖层只收紧不放松：实测「不可解」的编码会被视同白名单外，
 * 但白名单外的编码不会因为实测可解而免修——能否搬运是「编码 + 容器」的联合属性，
 * 单靠编码证据覆盖不了。这样学习层的任何误判最多让修复更保守（多转码），
 * 不会放行坏产物。
 *
 * @param facts 判定所需事实。
 * @param learned 本机实测结论；无证据时传空，完全回落静态白名单。
 * @returns 判定结论。
 */
export function decideRepair(facts: PlaybackFacts, learned?: LearnedCapabilityOverlay): RepairDecision {
    const extension = path.extname(facts.fileName).toLowerCase();

    if (MediaUtil.isAudio(facts.fileName)) {
        // 纯音频分支没有编码探测事实（mp3 之外不作 ffprobe），学习层无从介入；
        // VBR MP3 的 seek 问题也不存在「解码失败」信号，只能靠码率模式判定。
        if (UNSUPPORTED_AUDIO_CONTAINERS.has(extension)) {
            return { needsRepair: true, reason: 'unsupported-container', recipe: 'audio-transcode' };
        }
        if (extension === '.mp3') {
            // 只有确认为定长码率时才认为可以直接播放：VBR 与无法判定都要修。
            if (facts.mp3BitrateMode === 'cbr') {
                return { needsRepair: false, reason: 'playable' };
            }
            return { needsRepair: true, reason: 'mp3-seek-imprecise', recipe: 'audio-transcode' };
        }
        return { needsRepair: false, reason: 'playable' };
    }

    if (UNSUPPORTED_VIDEO_CONTAINERS.has(extension)) {
        return { needsRepair: true, reason: 'unsupported-container', recipe: 'full-transcode' };
    }

    const videoCodec = (facts.videoCodec ?? '').toLowerCase();
    const audioCodec = (facts.audioCodec ?? '').toLowerCase();
    // 学习结论只对已探测到的编码生效。
    const audioUnplayable = audioCodec !== '' && learned?.audio === 'unplayable';

    // 只有音轨的文件（例如只装了音乐的 MKV）：没有视频流，整片重编码没有意义。
    if (!facts.hasVideoStream) {
        if ((audioCodec !== '' && !isCopyableAudioCodec(audioCodec)) || audioUnplayable) {
            return { needsRepair: true, reason: 'unsupported-audio', recipe: 'audio-transcode' };
        }
        if (CONTAINER_SWAP_CONTAINERS.has(extension)) {
            return { needsRepair: true, reason: 'unsupported-container', recipe: 'audio-transcode' };
        }
        return { needsRepair: false, reason: 'playable' };
    }

    if (videoCodec === '' || !isCopyableVideoCodec(videoCodec) || learned?.video === 'unplayable') {
        return { needsRepair: true, reason: 'undecodable-video', recipe: 'full-transcode' };
    }
    if ((audioCodec !== '' && !isCopyableAudioCodec(audioCodec)) || audioUnplayable) {
        return { needsRepair: true, reason: 'unsupported-audio', recipe: 'video-copy-audio-transcode' };
    }
    if (CONTAINER_SWAP_CONTAINERS.has(extension)) {
        return { needsRepair: true, reason: 'unsupported-container', recipe: 'remux-copy' };
    }
    return { needsRepair: false, reason: 'playable' };
}
