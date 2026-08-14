import path from 'path';
import { randomUUID } from 'crypto';
import { inject, injectable } from 'inversify';
import FileSystemGateway from '@/backend/application/ports/gateways/storage/FileSystemGateway';
import StorageDirectoryProvider from '@/backend/application/ports/gateways/storage/StorageDirectoryProvider';
import FfmpegService from '@/backend/application/services/FfmpegService';
import TYPES from '@/backend/ioc/types';
import { ChapterParseResult } from '@/common/types/chapter-result';
import MediaUtil from '@/common/utils/MediaUtil';
import SrtUtil from '@/common/utils/SrtUtil';
import TimeUtil from '@/common/utils/TimeUtil';
import parseChapter from '@/common/utils/praser/chapter-parser';
import StrUtil from '@/common/utils/str-util';

/** 视频章节切分请求。 */
export interface SplitVideoRequest {
    /** 待切分的视频文件绝对路径。 */
    videoPath: string;
    /** 字幕文件绝对路径；不需要切分字幕时为 `null`。 */
    srtPath: string | null;
    /** 已解析并确认有效的章节列表。 */
    chapters: ChapterParseResult[];
}

/**
 * 按章节切分视频，并在提供字幕时生成对应的分段字幕。
 */
@injectable()
export default class SplitVideoService {
    public constructor(
        @inject(TYPES.FfmpegService)
        private readonly ffmpegService: FfmpegService,
        @inject(TYPES.StorageDirectoryProvider)
        private readonly storageDirectoryProvider: StorageDirectoryProvider,
        @inject(TYPES.FileSystemGateway)
        private readonly fileSystemGateway: FileSystemGateway,
    ) {}

    /**
     * 将章节文本解析为预览列表。
     * @param chapterText 用户输入的章节文本。
     * @returns 解析后的章节列表。
     */
    public async previewSplit(chapterText: string): Promise<ChapterParseResult[]> {
        if (StrUtil.isBlank(chapterText)) {
            return [];
        }
        return parseChapter(chapterText);
    }

    /**
     * 按章节切分视频，并可选地切分配套字幕。
     * @param request 视频、字幕和章节信息。
     * @returns 分段文件所在目录。
     */
    public async splitByChapters(request: SplitVideoRequest): Promise<string> {
        await this.validateRequest(request);

        const folderName = path.join(
            path.dirname(request.videoPath),
            path.basename(request.videoPath, path.extname(request.videoPath)),
        );
        const splitVideos = await this.splitVideoParts(request.videoPath, request.chapters, folderName);

        if (request.srtPath !== null) {
            await this.splitSubtitle(request.srtPath, splitVideos);
        }

        return folderName;
    }

    /**
     * 校验切分请求中的文件和章节数据。
     * @param request 待校验的切分请求。
     */
    private async validateRequest(request: SplitVideoRequest): Promise<void> {
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(request.videoPath);
        if (!(await this.fileSystemGateway.fileExists(request.videoPath))) {
            throw new Error(`视频文件不存在：${request.videoPath}`);
        }
        if (request.chapters.length === 0) {
            throw new Error('至少需要一个有效章节才能切分视频');
        }
        if (request.chapters.some((chapter) => !chapter.timestampValid || StrUtil.isBlank(chapter.title))) {
            throw new Error('章节标题和时间必须有效');
        }

        const duration = await this.ffmpegService.duration(request.videoPath);
        if (!Number.isFinite(duration) || duration <= 0) {
            throw new Error(`无法读取有效的视频时长：${request.videoPath}`);
        }

        const chapterStarts = request.chapters.map((chapter) => TimeUtil.parseDuration(chapter.timestampStart));
        for (let index = 0; index < request.chapters.length; index++) {
            const chapter = request.chapters[index];
            const start = chapterStarts[index];
            if (!Number.isFinite(start) || start < 0 || start >= duration) {
                throw new Error(`章节“${chapter.title}”的开始时间超出视频范围`);
            }
            if (index > 0 && start <= chapterStarts[index - 1]) {
                throw new Error('章节开始时间必须严格递增');
            }
            const hasControlCharacter = Array.from(chapter.title)
                .some((character) => character.charCodeAt(0) < 32);
            if (/[<>:"/\\|?*]/u.test(chapter.title) || hasControlCharacter) {
                throw new Error(`章节标题包含文件名不支持的字符：${chapter.title}`);
            }
        }

        if (request.srtPath === null) {
            return;
        }
        if (StrUtil.isBlank(request.srtPath)) {
            throw new Error('字幕路径不能为空字符串；不切分字幕时请传入 null');
        }
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(request.srtPath);
        if (!(await this.fileSystemGateway.fileExists(request.srtPath))) {
            throw new Error(`字幕文件不存在：${request.srtPath}`);
        }
    }

    /**
     * 调用 FFmpeg 切分视频，并按章节时间和标题重命名输出文件。
     * @param videoPath 视频文件绝对路径。
     * @param chapters 有效章节列表。
     * @param folderName 输出目录绝对路径。
     * @returns 重命名后的分段视频路径。
     */
    private async splitVideoParts(
        videoPath: string,
        chapters: ChapterParseResult[],
        folderName: string,
    ): Promise<string[]> {
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(folderName);
        await this.fileSystemGateway.ensureDirectory(folderName);

        const chapterStarts = chapters.map((chapter) => TimeUtil.parseDuration(chapter.timestampStart));
        // 每次使用独立前缀，避免失败任务留下的旧分段混入本次结果。
        const outputFilePrefix = `split-${randomUUID()}`;
        const outputFiles = await this.ffmpegService.splitVideoByTimes({
            inputFile: videoPath,
            times: chapterStarts.filter((start) => start > 0),
            outputFolder: folderName,
            outputFilePrefix,
        });

        if (outputFiles.length !== chapters.length) {
            throw new Error(`视频切分结果数量异常：预期 ${chapters.length} 个，实际 ${outputFiles.length} 个`);
        }

        const targetPaths = outputFiles.map((outputFile, index) => {
            const chapter = chapters[index];
            const fileName = `${chapter.timestampStart}-${chapter.title}${path.extname(outputFile)}`.replaceAll(':', '');
            return path.join(folderName, fileName);
        });
        for (const targetPath of targetPaths) {
            if (await this.fileSystemGateway.fileExists(targetPath)) {
                throw new Error(`切分输出文件已存在：${targetPath}`);
            }
        }

        for (let index = 0; index < outputFiles.length; index++) {
            await this.fileSystemGateway.moveFile(outputFiles[index], targetPaths[index]);
        }
        return targetPaths;
    }

    /**
     * 按已生成的视频分段时长切分字幕。
     * @param srtPath 原字幕文件绝对路径。
     * @param splitVideos 分段视频文件绝对路径。
     */
    private async splitSubtitle(srtPath: string, splitVideos: string[]): Promise<void> {
        const content = await this.fileSystemGateway.readTextFile(srtPath);
        const subtitles = MediaUtil.isAss(srtPath)
            ? SrtUtil.parseAss(content)
            : SrtUtil.parseSrt(content);

        let segmentStart = -0.2;
        for (const splitVideo of splitVideos) {
            const duration = await this.ffmpegService.duration(splitVideo);
            const segmentEnd = segmentStart + duration;
            const lines = subtitles
                .filter((line) => line.end >= segmentStart && line.start <= segmentEnd)
                .map((line, index) => ({
                    index: index + 1,
                    start: Math.max(line.start - segmentStart, 0),
                    end: Math.min(line.end - segmentStart, duration),
                    contentEn: line.contentEn,
                    contentZh: line.contentZh,
                }));
            const srtContent = SrtUtil.srtLinesToSrt(lines, { reindex: true });
            const subtitlePath = splitVideo.replace(path.extname(splitVideo), '.srt');
            await this.fileSystemGateway.writeTextFile(subtitlePath, srtContent);
            segmentStart = segmentEnd;
        }
    }
}
