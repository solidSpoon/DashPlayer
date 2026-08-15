import path from 'path';

import MediaService from '@/backend/application/services/MediaService';
import { WatchHistoryRecord } from '@/backend/application/ports/repositories/WatchHistoryRepository';
import WatchHistoryExtRepository from '@/backend/application/ports/repositories/WatchHistoryExtRepository';
import StorageDirectoryProvider from '@/backend/application/ports/gateways/storage/StorageDirectoryProvider';
import MatchSrt from '@/backend/utils/MatchSrt';
import MediaUtil from '@/common/utils/MediaUtil';
import StrUtil from '@/common/utils/str-util';
import TimeUtil from '@/common/utils/TimeUtil';
import WatchHistoryVO from '@/common/types/WatchHistoryVO';
import FileSystemGateway from '@/backend/application/ports/gateways/storage/FileSystemGateway';

/**
 * 将观看历史数据库记录转换为 renderer 使用的展示数据。
 *
 * basic 构建只读取数据库字段；完整构建额外读取视频时长并匹配字幕。
 */
export default class WatchHistoryViewBuilder {
    /**
     * 创建观看历史展示数据构建器。
     *
     * @param mediaService 媒体信息服务。
     * @param watchHistoryExtRepository 观看历史扩展信息仓储。
     * @param storageDirectoryProvider 存储目录与访问权限提供器。
     * @param fileSystemGateway 文件系统访问入口。
     */
    public constructor(
        private readonly mediaService: MediaService,
        private readonly watchHistoryExtRepository: WatchHistoryExtRepository,
        private readonly storageDirectoryProvider: StorageDirectoryProvider,
        private readonly fileSystemGateway: FileSystemGateway,
    ) {
    }

    /**
     * 构建包含视频时长和字幕匹配结果的完整展示数据。
     *
     * @param history 观看历史数据库记录。
     * @returns 完整展示数据；视频文件不存在时返回 `null`。
     */
    public async buildFull(history: WatchHistoryRecord): Promise<WatchHistoryVO | null> {
        const filePath = path.join(history.base_path, history.file_name);
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(filePath);
        if (!await this.fileSystemGateway.fileExists(filePath)) {
            return null;
        }

        const srtFile = await this.resolveSubtitle(history, filePath);
        const duration = await this.mediaService.duration(filePath);
        return this.buildBase(history, duration, srtFile);
    }

    /**
     * 构建不读取媒体时长和字幕目录的轻量展示数据。
     *
     * @param history 观看历史数据库记录。
     * @returns basic 展示数据。
     */
    public async buildBasic(history: WatchHistoryRecord): Promise<WatchHistoryVO> {
        return this.buildBase(history, 0, history.srt_file ?? '');
    }

    /**
     * 构建 full/basic 共用的展示字段。
     *
     * @param history 观看历史数据库记录。
     * @param duration 视频时长，basic 数据固定为 0。
     * @param srtFile 字幕文件路径。
     * @returns renderer 使用的展示数据。
     */
    private async buildBase(
        history: WatchHistoryRecord,
        duration: number,
        srtFile: string,
    ): Promise<WatchHistoryVO> {
        const ext = await this.watchHistoryExtRepository.findByWatchHistoryId(history.id);
        return {
            id: history.id,
            basePath: history.base_path,
            fileName: history.file_name,
            isFolder: false,
            updatedAt: TimeUtil.isoToDate(history.updated_at),
            duration,
            current_position: history.current_position,
            srtFile,
            playing: false,
            podcastModeUserSet: ext?.podcast_mode_user_set ?? null,
            podcastModeManual: ext?.podcast_mode_manual ?? null,
        };
    }

    /**
     * 解析观看记录使用的字幕文件。
     *
     * 已关联字幕有效时直接使用；否则在视频目录中匹配最合适的字幕。
     *
     * @param history 观看历史数据库记录。
     * @param videoPath 视频文件路径。
     * @returns 字幕文件路径；未匹配到时返回空字符串。
     */
    private async resolveSubtitle(history: WatchHistoryRecord, videoPath: string): Promise<string> {
        const configuredSubtitle = history.srt_file;
        if (StrUtil.isNotBlank(configuredSubtitle)) {
            await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(configuredSubtitle);
            const exists = await this.fileSystemGateway.fileExists(configuredSubtitle);
            if (exists) {
                return configuredSubtitle;
            }
        }

        const subtitleFiles = await this.listSubtitleFiles(history.base_path);
        return MatchSrt.matchOne(videoPath, subtitleFiles) ?? '';
    }

    /**
     * 按 SRT、其他字幕格式的顺序列出目录中的字幕文件。
     *
     * @param folder 视频所在目录。
     * @returns 字幕文件绝对路径列表。
     */
    private async listSubtitleFiles(folder: string): Promise<string[]> {
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(folder);
        const fileNames = await this.fileSystemGateway.listFileNames(folder);
        const subtitlePaths = fileNames
            .filter((fileName) => MediaUtil.isSubtitle(fileName))
            .map((fileName) => path.join(folder, fileName));

        const srtFiles = subtitlePaths.filter((subtitlePath) => MediaUtil.isSrt(subtitlePath));
        const otherSubtitleFiles = subtitlePaths.filter((subtitlePath) => !MediaUtil.isSrt(subtitlePath));
        return [...srtFiles, ...otherSubtitleFiles];
    }
}
