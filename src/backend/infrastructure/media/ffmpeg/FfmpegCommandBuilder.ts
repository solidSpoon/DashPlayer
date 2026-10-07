import TimeUtil from '@/common/utils/TimeUtil';
import type {
    ConvertToWavArgs,
    CreateThumbnailArgs,
    DubbingMixSegment,
    ExtractSubtitleCommandArgs,
    MixDubbedAudioArgs,
    ProcessRecordingArgs,
    RepairArgs,
    SplitVideoByTimesArgs,
    SplitVideoRangeArgs,
    TrimAudioArgs,
    TrimVideoArgs,
} from '@/backend/services/gateways/media/FfmpegGateway';

/**
 * 音频重编码参数。
 *
 * 修复目标只是「能正常播放」：统一降为立体声 128k，
 * 既避开多声道 AAC 在部分设备上的兼容问题，也避开低码率语音源转码后体积翻倍。
 */
const AUDIO_TRANSCODE_ARGS = ['-ac', '2', '-c:a', 'aac', '-b:a', '128k'];

/**
 * 整片重编码保留的最高宽度。
 *
 * 超过 1080p 的旧编码素材降到 1080p：像素量下降后编解码量大幅减少，修复更快；
 * 原本就不超过时，scale 表达式等于原尺寸，不做实际缩放。
 */
const MAX_TRANSCODE_WIDTH = 1920;

/**
 * 滤镜图中的时间字面量格式：毫秒级精度，避免科学计数法污染滤镜表达式。
 */
const formatSeconds = (value: number): string => value.toFixed(3);

/**
 * FFmpeg 命令构建器接口。
 *
 * 参数类型统一从网关契约（FfmpegGateway.ts）导入，保证业务层、网关与构建器看到同一份定义。
 */
export interface FfmpegCommandBuilder {
    /**
     * 构建按起止时间分割视频命令参数。
     */
    buildSplitVideo(args: SplitVideoRangeArgs): string[];

    /**
     * 构建按时间点切段视频命令参数。
     */
    buildSplitVideoByTimes(args: SplitVideoByTimesArgs): string[];

    /**
     * 构建视频裁剪命令参数。
     */
    buildTrimVideo(args: TrimVideoArgs): string[];

    /**
     * 构建缩略图命令参数。
     */
    buildThumbnail(args: CreateThumbnailArgs): string[];

    /**
     * 构建字幕提取命令参数；字幕流必须由网关探测选定后传入，避免命中图形字幕或多流。
     */
    buildExtractSubtitle(args: ExtractSubtitleCommandArgs): string[];

    /**
     * 构建播放修复命令参数。
     *
     * 各配方的取舍：
     * - `remux-copy` / `video-copy-audio-transcode` 只搬流，不重编码视频；
     * - `full-transcode` 强制 8bit yuv420p，避免在无硬解的设备上出现黑屏；
     * - `audio-transcode` 只映射第一条音轨，顺带丢弃 MP3 的封面图视频流。
     */
    buildRepair(args: RepairArgs): string[];

    /**
     * 构建音频转 WAV 命令参数。
     */
    buildConvertToWav(args: ConvertToWavArgs): string[];

    /**
     * 构建音频裁剪命令参数。
     */
    buildTrimAudio(args: TrimAudioArgs): string[];

    /**
     * 构建配音录音处理命令参数：掐头去尾静音后转 48kHz 单声道 PCM WAV。
     */
    buildProcessRecording(args: ProcessRecordingArgs): string[];

    /**
     * 构建配音混音导出命令参数。
     */
    buildDubbingMix(args: MixDubbedAudioArgs): string[];
}

/**
 * 默认 FFmpeg 命令构建实现。
 */
export class DefaultFfmpegCommandBuilder implements FfmpegCommandBuilder {
    /**
     * 构建按起止时间分割视频命令参数。
     */
    public buildSplitVideo(args: SplitVideoRangeArgs): string[] {
        this.assertRange(args.startSecond, args.endSecond, '视频分割');
        const duration = args.endSecond - args.startSecond;
        return [
            '-y',
            '-ss', TimeUtil.secondToTimeStrWithMs(args.startSecond),
            '-accurate_seek',
            '-i', args.inputFile,
            '-t', `${duration}`,
            '-codec', 'copy',
            '-avoid_negative_ts', '1',
            args.outputFile,
        ];
    }

    /**
     * 构建按时间点切段视频命令参数。
     */
    public buildSplitVideoByTimes(args: SplitVideoByTimesArgs): string[] {
        this.assertAscendingTimes(args.times, '视频时间点分段');
        return [
            '-y',
            '-i', args.inputFile,
            '-f', 'segment',
            '-segment_times', args.times.map(t => TimeUtil.secondToTimeStr(t)).join(','),
            '-c', 'copy',
            '-map', '0',
            '-reset_timestamps', '1',
            args.outputPattern,
        ];
    }

    /**
     * 构建视频裁剪命令参数。
     */
    public buildTrimVideo(args: TrimVideoArgs): string[] {
        this.assertRange(args.startSecond, args.endSecond, '视频裁剪');

        const duration = args.endSecond - args.startSecond;
        const videoCodec = args.videoCodec ?? 'libx264';
        const audioCodec = args.audioCodec ?? 'aac';
        const crf = args.crf ?? 23;

        const result: string[] = [
            '-y',
            '-ss', TimeUtil.secondToTimeStrWithMs(args.startSecond),
            '-i', args.inputFile,
            '-t', `${duration}`,
            '-c:v', videoCodec,
            // 强制 8bit yuv420p：源为 10bit 时 libx264/x265 会离出 High10/Main10，浏览器普遍无法播放。
            '-pix_fmt', 'yuv420p',
        ];

        if (args.videoPreset) {
            result.push('-preset', args.videoPreset);
        }

        result.push('-crf', `${crf}`);
        result.push('-c:a', audioCodec);

        if (typeof args.audioChannels === 'number' && args.audioChannels > 0) {
            result.push('-ac', `${Math.floor(args.audioChannels)}`);
        }

        if (args.audioBitrate) {
            result.push('-b:a', args.audioBitrate);
        }

        if (typeof args.outputWidth === 'number' && args.outputWidth > 0) {
            // -2 保证高度取偶：libx264/x265 编码 yuv420p 要求宽高均为偶数，奇数高度会直接报错。
            result.push('-vf', `scale=${Math.floor(args.outputWidth)}:-2`);
        }

        result.push(args.outputFile);
        return result;
    }

    /**
     * 构建缩略图命令参数。
     */
    public buildThumbnail(args: CreateThumbnailArgs): string[] {
        this.assertNonNegative(args.timeSecond, '缩略图时间点');

        const format = args.format ?? 'jpg';
        const result: string[] = [
            '-y',
            '-ss', TimeUtil.secondToTimeStrWithMs(args.timeSecond),
            '-i', args.inputFile,
            '-frames:v', '1',
        ];

        if (typeof args.width === 'number' && args.width > 0) {
            result.push('-vf', `scale=${Math.floor(args.width)}:-1`);
        }

        if (format === 'jpg') {
            const qscale = args.jpgQScale ?? 4;
            result.push('-q:v', `${qscale}`);
        }

        result.push('-f', 'image2', args.outputFile);
        return result;
    }

    /**
     * 构建字幕提取命令参数；只映射探测选定的单条字幕流，避免多流写单文件报错。
     *
     * 显式指定输出封装格式：产物先写到不带扩展名的临时文件，无法由扩展名推断格式。
     */
    public buildExtractSubtitle(args: ExtractSubtitleCommandArgs): string[] {
        return [
            '-y',
            '-i', args.inputFile,
            '-map', `0:${args.streamIndex}`,
            '-c:s', 'srt',
            '-f', 'srt',
            args.outputFile,
        ];
    }

    /**
     * 构建播放修复命令参数。
     *
     * 输出封装格式显式声明：修复产物先写到不带媒体扩展名的临时文件（避免写在中途的
     * 产物被播放与元数据探测选中），ffmpeg 无法再按扩展名推断格式。
     * 音频产物用 `ipod`（即 `.m4a` 扩展名对应的封装器），实测与按扩展名推断的字节一致。
     */
    public buildRepair(args: RepairArgs): string[] {
        const { inputFile, outputFile, recipe } = args;
        switch (recipe) {
            case 'remux-copy':
                return [
                    '-y',
                    '-i', inputFile,
                    '-map', '0:v:0',
                    '-map', '0:a:0?',
                    '-c', 'copy',
                    '-movflags', '+faststart',
                    '-f', 'mp4',
                    outputFile,
                ];
            case 'video-copy-audio-transcode':
                return [
                    '-y',
                    '-i', inputFile,
                    '-map', '0:v:0',
                    '-map', '0:a:0',
                    '-c:v', 'copy',
                    ...AUDIO_TRANSCODE_ARGS,
                    '-movflags', '+faststart',
                    '-f', 'mp4',
                    outputFile,
                ];
            case 'full-transcode':
                return [
                    '-y',
                    '-i', inputFile,
                    '-map', '0:v:0',
                    '-map', '0:a:0?',
                    // veryfast + crf 23：修复场景优先让用户少等，画质仍明显优于源素材。
                    '-c:v', 'libx264',
                    '-preset', 'veryfast',
                    '-crf', '23',
                    '-vf', `scale=min(${MAX_TRANSCODE_WIDTH}\\,iw):-2`,
                    '-pix_fmt', 'yuv420p',
                    '-profile:v', 'high',
                    ...AUDIO_TRANSCODE_ARGS,
                    '-movflags', '+faststart',
                    '-f', 'mp4',
                    outputFile,
                ];
            case 'audio-transcode':
                return [
                    '-y',
                    '-i', inputFile,
                    '-map', '0:a:0',
                    ...AUDIO_TRANSCODE_ARGS,
                    '-movflags', '+faststart',
                    '-f', 'ipod',
                    outputFile,
                ];
            default:
                throw new Error(`未知的修复配方：${recipe satisfies never}`);
        }
    }

    /**
     * 构建音频转 WAV 命令参数。
     */
    public buildConvertToWav(args: ConvertToWavArgs): string[] {
        const sampleRate = args.sampleRate ?? 16000;
        const channels = args.channels ?? 1;

        const result = ['-y'];
        if (args.startSecond !== undefined || args.endSecond !== undefined) {
            if (args.startSecond === undefined || args.endSecond === undefined) {
                throw new Error('WAV 裁剪必须同时提供起止时间');
            }
            this.assertRange(args.startSecond, args.endSecond, 'WAV 裁剪');
            result.push('-ss', TimeUtil.secondToTimeStrWithMs(args.startSecond));
        }
        result.push('-i', args.inputFile);
        if (args.startSecond !== undefined && args.endSecond !== undefined) {
            result.push('-t', `${args.endSecond - args.startSecond}`);
        }
        result.push(
            '-vn',
            '-ar', `${sampleRate}`,
            '-ac', `${channels}`,
            '-c:a', 'pcm_s16le',
            '-f', 'wav',
            args.outputFile,
        );
        return result;
    }

    /**
     * 构建音频裁剪命令参数。
     */
    public buildTrimAudio(args: TrimAudioArgs): string[] {
        this.assertRange(args.startSecond, args.endSecond, '音频裁剪');
        const duration = args.endSecond - args.startSecond;
        const audioCodec = args.audioCodec ?? 'libmp3lame';
        const audioBitrate = args.audioBitrate ?? '192k';

        return [
            '-y',
            '-ss', TimeUtil.secondToTimeStrWithMs(args.startSecond),
            '-i', args.inputFile,
            '-t', `${duration}`,
            '-c:a', audioCodec,
            '-b:a', audioBitrate,
            args.outputFile,
        ];
    }

    /**
     * 构建配音录音处理命令参数。
     *
     * 掐头去尾策略：前后向各跑一次 silenceremove，首尾各保留至多 0.1s 静音、
     * 阈值 -40dB；全部内容都低于阈值时产物为空 WAV，由上层按时长校验显式报错。
     */
    public buildProcessRecording(args: ProcessRecordingArgs): string[] {
        const trimSilence = [
            'silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.1',
            'areverse',
            'silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.1',
            'areverse',
        ].join(',');
        return [
            '-y',
            '-i', args.inputFile,
            '-af', trimSilence,
            '-ar', '48000',
            '-ac', '1',
            '-c:a', 'pcm_s16le',
            '-f', 'wav',
            args.outputFile,
        ];
    }

    /**
     * 构建配音混音导出命令参数。
     *
     * 滤镜图分三部分：
     * - 原声：统一 48kHz 立体声，已配音区间逐段静音（句间 BGM 不受影响）；
     * - 录音：重采样、单声道展开立体声、超长时 atempo 变速压到句长，再补齐/截断到精确句长并按句起点 adelay；
     * - 合成：amix（normalize=0 不衰减音量，duration=first 以全长原声为准），视频流直拷。
     */
    public buildDubbingMix(args: MixDubbedAudioArgs): string[] {
        if (args.segments.length === 0) {
            throw new Error('配音混音至少需要一个替换片段');
        }

        const filters: string[] = [];

        const originalChain = ['aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo'];
        for (const segment of args.segments) {
            this.assertRange(segment.startSecond, segment.endSecond, '配音片段');
            this.assertNonNegative(segment.takeDurationSecond, '配音录音时长');
            originalChain.push(
                `volume=0.0:enable='between(t,${formatSeconds(segment.startSecond)},${formatSeconds(segment.endSecond)})'`,
            );
        }
        filters.push(`[0:a]${originalChain.join(',')}[base]`);

        args.segments.forEach((segment, position) => {
            const chain: string[] = [
                'aresample=48000',
                'pan=stereo|c0=c0|c1=c0',
                ...this.buildTakeTempoFilters(segment),
            ];
            const segmentDuration = formatSeconds(segment.endSecond - segment.startSecond);
            chain.push(`apad=whole_dur=${segmentDuration}`, `atrim=start=0:end=${segmentDuration}`, 'asetpts=PTS-STARTPTS');
            const delayMs = Math.round(segment.startSecond * 1000);
            chain.push(`adelay=${delayMs}|${delayMs}`);
            filters.push(`[${position + 1}:a]${chain.join(',')}[take${position}]`);
        });

        const mixInputs = ['[base]', ...args.segments.map((_, position) => `[take${position}]`)].join('');
        filters.push(`${mixInputs}amix=inputs=${args.segments.length + 1}:duration=first:normalize=0[aout]`);

        const result: string[] = ['-y', '-i', args.videoFile];
        for (const segment of args.segments) {
            result.push('-i', segment.takeFile);
        }
        result.push(
            '-filter_complex', filters.join(';'),
            '-map', '0:v:0',
            '-map', '[aout]',
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-movflags', '+faststart',
            args.outputFile,
        );
        return result;
    }

    /**
     * 录音超长时的变速滤镜：atempo 单实例只支持 0.5~2.0，超出范围时链式拆分。
     * @param segment 配音替换片段。
     * @returns atempo 滤镜列表；录音不超长时为空。
     */
    private buildTakeTempoFilters(segment: DubbingMixSegment): string[] {
        const segmentDuration = segment.endSecond - segment.startSecond;
        const ratio = segment.takeDurationSecond / segmentDuration;
        if (ratio <= 1.001) {
            return [];
        }
        const filters: string[] = [];
        let remaining = ratio;
        while (remaining > 2.0) {
            filters.push('atempo=2.0');
            remaining /= 2.0;
        }
        filters.push(`atempo=${Math.min(remaining, 2.0).toFixed(4)}`);
        return filters;
    }

    /**
     * 校验时间区间是否合法。
     */
    private assertRange(startSecond: number, endSecond: number, label: string): void {
        this.assertNonNegative(startSecond, `${label}起始时间`);
        this.assertNonNegative(endSecond, `${label}结束时间`);
        if (endSecond <= startSecond) {
            throw new Error(`${label}结束时间必须大于起始时间`);
        }
    }

    /**
     * 校验时间值为非负数。
     */
    private assertNonNegative(value: number, label: string): void {
        if (!Number.isFinite(value) || value < 0) {
            throw new Error(`${label}必须是非负数字`);
        }
    }

    /**
     * 校验时间点数组是严格递增的正序列表。
     */
    private assertAscendingTimes(times: number[], label: string): void {
        for (let index = 0; index < times.length; index++) {
            this.assertNonNegative(times[index], `${label}时间点`);
            if (index > 0 && times[index] <= times[index - 1]) {
                throw new Error(`${label}时间点必须严格递增`);
            }
        }
    }
}
