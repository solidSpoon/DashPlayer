import * as fs from 'fs';

/** 语音识别统一使用的 PCM 采样率（Hz）。 */
export const RECOGNITION_SAMPLE_RATE = 16000;

/** 语音识别统一使用的声道数（单声道）。 */
export const RECOGNITION_CHANNELS = 1;

/** 语音识别统一使用的采样位深（16-bit 有符号整数 PCM）。 */
export const RECOGNITION_BITS_PER_SAMPLE = 16;

/** 单声道 16kHz 16-bit PCM 每秒字节数。 */
export const RECOGNITION_BYTES_PER_SECOND =
    RECOGNITION_SAMPLE_RATE * RECOGNITION_CHANNELS * (RECOGNITION_BITS_PER_SAMPLE / 8);

/** 标准 PCM WAV 文件头固定长度（字节）。 */
const WAV_HEADER_BYTES = 44;

/** 单个采样帧的字节对齐粒度（字节）。 */
const SAMPLE_FRAME_BYTES = RECOGNITION_CHANNELS * (RECOGNITION_BITS_PER_SAMPLE / 8);

/**
 * 依据 PCM 字节长度计算真实音频时长（秒）。
 *
 * @param byteLength 16kHz 单声道 16-bit PCM 文件总字节数。
 * @returns 音频时长（秒）；非正字节数返回 0。
 */
export function pcmDurationSeconds(byteLength: number): number {
    if (!Number.isFinite(byteLength) || byteLength <= 0) {
        return 0;
    }
    return byteLength / RECOGNITION_BYTES_PER_SECOND;
}

/**
 * 构造标准 44 字节 RIFF/WAVE PCM 文件头。
 *
 * @param dataByteLength PCM 音频负载字节长度。
 * @param sampleRate 采样率（Hz），默认 16000。
 * @param channels 声道数，默认 1。
 * @param bitsPerSample 位深，默认 16。
 * @returns 包含 RIFF/fmt/data 块的 44 字节缓冲。
 */
export function buildWavHeader(
    dataByteLength: number,
    sampleRate = RECOGNITION_SAMPLE_RATE,
    channels = RECOGNITION_CHANNELS,
    bitsPerSample = RECOGNITION_BITS_PER_SAMPLE,
): Buffer {
    const byteRate = sampleRate * channels * (bitsPerSample / 8);
    const blockAlign = channels * (bitsPerSample / 8);
    const header = Buffer.alloc(WAV_HEADER_BYTES);

    header.write('RIFF', 0, 'ascii');
    header.writeUInt32LE(36 + dataByteLength, 4);
    header.write('WAVE', 8, 'ascii');
    header.write('fmt ', 12, 'ascii');
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36, 'ascii');
    header.writeUInt32LE(dataByteLength, 40);

    return header;
}

/**
 * 从整轨 PCM 文件中按时间区间切出单个 16kHz 单声道 WAV 文件。
 *
 * 读取字节按采样帧边界对齐；当区间超出实际音轨末尾或区间为空时返回 false 且不写出空文件。
 *
 * @param args PCM 源路径、WAV 输出路径与起止时间（秒）。
 * @returns 实际写出有效音频切片时返回 true；区间无可用音频数据时返回 false。
 */
export async function slicePcmFileToWav(args: {
    pcmPath: string;
    outputWavPath: string;
    startSecond: number;
    endSecond: number;
}): Promise<boolean> {
    const { pcmPath, outputWavPath, startSecond, endSecond } = args;
    if (!Number.isFinite(startSecond) || !Number.isFinite(endSecond) || endSecond <= startSecond) {
        throw new Error(`PCM 切片时间区间非法：${startSecond} -> ${endSecond}`);
    }

    const handle = await fs.promises.open(pcmPath, 'r');
    try {
        const { size: fileSize } = await handle.stat();
        const alignedFileSize = fileSize - (fileSize % SAMPLE_FRAME_BYTES);
        const startByte = Math.max(0, Math.floor(startSecond * RECOGNITION_SAMPLE_RATE) * SAMPLE_FRAME_BYTES);
        const endByte = Math.min(alignedFileSize, Math.ceil(endSecond * RECOGNITION_SAMPLE_RATE) * SAMPLE_FRAME_BYTES);
        const dataLength = endByte - startByte;
        if (dataLength <= 0) {
            return false;
        }

        const pcmBuffer = Buffer.allocUnsafe(dataLength);
        let totalRead = 0;
        while (totalRead < dataLength) {
            const { bytesRead } = await handle.read(
                pcmBuffer,
                totalRead,
                dataLength - totalRead,
                startByte + totalRead,
            );
            if (bytesRead === 0) {
                break;
            }
            totalRead += bytesRead;
        }

        const actualLength = totalRead - (totalRead % SAMPLE_FRAME_BYTES);
        if (actualLength <= 0) {
            return false;
        }

        const header = buildWavHeader(actualLength);
        const payload = actualLength === dataLength ? pcmBuffer : pcmBuffer.subarray(0, actualLength);
        await fs.promises.writeFile(outputWavPath, Buffer.concat([header, payload], WAV_HEADER_BYTES + actualLength));
        return true;
    } finally {
        await handle.close();
    }
}
