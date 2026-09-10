import { Mp3BitrateMode } from '@/common/contracts/playback-repair';

/**
 * MP3 码率模式探测。
 *
 * 只在内存里解析字节，不做任何 I/O：调用方负责读入文件头部若干个字节。
 * 判定优先级为「编码器写入的标签」→「连续帧的实际码率是否恒定」，
 * 两者都拿不到确定结论时返回 `unknown`，由上层按「需要修复」的保守方向处理。
 */

/** MPEG-1 Layer III 码率表（kbps），下标为码率索引。 */
const MPEG1_LAYER3_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];

/** MPEG-2 / MPEG-2.5 Layer III 码率表（kbps），下标为码率索引。 */
const MPEG2_LAYER3_BITRATES = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];

/** 采样率表（Hz），按 MPEG-1 / MPEG-2 / MPEG-2.5 分档。 */
const SAMPLE_RATES = {
    mpeg1: [44100, 48000, 32000],
    mpeg2: [22050, 24000, 16000],
    mpeg25: [11025, 12000, 8000],
};

/** 无标签时向后扫描的帧数；约 5 秒音频，足以看出 VBR 的码率波动。 */
const FRAMES_TO_SCAN = 200;

/** 在首个 MP3 帧内查找编码器标签的窗口长度，标签一定位于帧头之后的边信息区。 */
const TAG_SEARCH_WINDOW = 120;

interface Mp3FrameHeader {
    /** 整帧字节数，用于往后跳帧。 */
    frameLength: number;
    /** 码率索引，用于比较相邻帧码率是否一致。 */
    bitrateIndex: number;
}

/**
 * 跳过 ID3v2 标签与前置填充，返回第一个可能存在的帧同步字位置。
 *
 * @param buffer 文件头部字节。
 * @returns 起始扫描偏移；标签长度异常时返回 0，交由同步字扫描兜底。
 */
function skipId3v2(buffer: Buffer): number {
    if (buffer.length < 10 || buffer.toString('latin1', 0, 3) !== 'ID3') {
        return 0;
    }
    // ID3v2 长度是 4 个「每字节最高位为 0」的 synchsafe 整数。
    const size = ((buffer[6] & 0x7f) << 21)
        | ((buffer[7] & 0x7f) << 14)
        | ((buffer[8] & 0x7f) << 7)
        | (buffer[9] & 0x7f);
    const total = 10 + size;
    return total > 0 && total < buffer.length ? total : 0;
}

/**
 * 解析一个 MP3 帧头。
 *
 * @param buffer 文件头部字节。
 * @param offset 候选帧起始偏移。
 * @returns Layer III 帧的帧长与码率索引；不是合法 Layer III 帧头时返回 `null`。
 */
function parseFrameHeader(buffer: Buffer, offset: number): Mp3FrameHeader | null {
    if (offset + 4 > buffer.length) {
        return null;
    }
    if (buffer[offset] !== 0xff || (buffer[offset + 1] & 0xe0) !== 0xe0) {
        return null;
    }
    const versionBits = (buffer[offset + 1] >> 3) & 0x03;
    const layerBits = (buffer[offset + 1] >> 1) & 0x03;
    // 只处理最常见的 Layer III：Layer I/II 的帧长公式不同，按未知处理更安全。
    if (versionBits === 0x01 || layerBits !== 0x01) {
        return null;
    }
    const bitrateIndex = (buffer[offset + 2] >> 4) & 0x0f;
    const sampleRateIndex = (buffer[offset + 2] >> 2) & 0x03;
    const padding = (buffer[offset + 2] >> 1) & 0x01;
    if (bitrateIndex === 0 || bitrateIndex === 0x0f || sampleRateIndex === 0x03) {
        return null;
    }

    const isMpeg1 = versionBits === 0x03;
    const bitrateKbps = (isMpeg1 ? MPEG1_LAYER3_BITRATES : MPEG2_LAYER3_BITRATES)[bitrateIndex];
    const sampleRate = (isMpeg1
        ? SAMPLE_RATES.mpeg1
        : versionBits === 0x02 ? SAMPLE_RATES.mpeg2 : SAMPLE_RATES.mpeg25)[sampleRateIndex];
    // Layer III 每帧 1152 采样（MPEG-2/2.5 为 576），据此换算帧字节数。
    const samplesPerFrame = isMpeg1 ? 1152 : 576;
    const frameLength = Math.floor(samplesPerFrame / 8 * bitrateKbps * 1000 / sampleRate) + padding;
    return frameLength > 4 ? { frameLength, bitrateIndex } : null;
}

/**
 * 在首个帧内查找编码器写入的索引标签。
 *
 * @param buffer 文件头部字节。
 * @param frameOffset 首个帧的起始偏移。
 * @returns `vbr` 表示带变长索引（Xing/VBRI），`cbr` 表示带定长标记（Info），无标签返回 `null`。
 */
function readEncoderTag(buffer: Buffer, frameOffset: number): Mp3BitrateMode | null {
    const windowEnd = Math.min(buffer.length, frameOffset + 4 + TAG_SEARCH_WINDOW);
    const tag = buffer.toString('latin1', frameOffset + 4, windowEnd);
    // LAME/ffmpeg 写 Xing 表示变长、Info 表示定长；VBRI 来自 Fraunhofer 编码器，同样是变长。
    if (tag.includes('Xing') || tag.includes('VBRI')) {
        return 'vbr';
    }
    if (tag.includes('Info')) {
        return 'cbr';
    }
    return null;
}

/**
 * 探测 MP3 的码率模式。
 *
 * @param buffer 文件头部字节；至少需要覆盖前若干帧（建议 128 KiB），过短时返回 `unknown`。
 * @returns 码率模式；无法解析出连续帧时返回 `unknown`。
 */
export function detectMp3BitrateMode(buffer: Buffer): Mp3BitrateMode {
    const offset = skipId3v2(buffer);
    let frameOffset: number | null = null;
    const searchLimit = Math.min(buffer.length - 4, offset + 4096);
    for (let cursor = offset; cursor < searchLimit; cursor += 1) {
        if (parseFrameHeader(buffer, cursor) !== null) {
            frameOffset = cursor;
            break;
        }
    }
    if (frameOffset === null) {
        return 'unknown';
    }

    const tag = readEncoderTag(buffer, frameOffset);
    if (tag !== null) {
        return tag;
    }

    // 无标签：连续比较帧码率，出现两种码率即为变长；扫满仍未出现则视为定长。
    const bitrateIndexes = new Set<number>();
    let cursor: number | null = frameOffset;
    let scanned = 0;
    while (cursor !== null && scanned < FRAMES_TO_SCAN) {
        const header = parseFrameHeader(buffer, cursor);
        if (header === null) {
            break;
        }
        bitrateIndexes.add(header.bitrateIndex);
        if (bitrateIndexes.size > 1) {
            return 'vbr';
        }
        cursor += header.frameLength;
        scanned += 1;
    }
    return scanned >= FRAMES_TO_SCAN ? 'cbr' : 'unknown';
}
