import path from 'path';

import WatchHistoryRepository, {
    WatchHistoryProjectType,
} from '@/backend/application/ports/repositories/WatchHistoryRepository';
import WatchHistoryExtRepository from '@/backend/application/ports/repositories/WatchHistoryExtRepository';
import StorageDirectoryProvider, {
    StorageDirectoryTarget,
} from '@/backend/application/ports/gateways/storage/StorageDirectoryProvider';
import { ObjUtil } from '@/backend/utils/ObjUtil';
import MediaUtil from '@/common/utils/MediaUtil';
import TimeUtil from '@/common/utils/TimeUtil';
import { getHtml5VariantPath } from '@/backend/application/services/impl/watch-history-file-rules';
import FileSystemGateway from '@/backend/application/ports/gateways/storage/FileSystemGateway';

/**
 * 负责扫描媒体文件并维护观看历史数据库记录。
 *
 * 该类只处理“磁盘文件与数据库记录如何同步”，不负责展示数据构建或 IPC 编排。
 */
export default class WatchHistoryLibrary {
    /**
     * 创建媒体库同步器。
     *
     * @param watchHistoryRepository 观看历史仓储。
     * @param watchHistoryExtRepository 观看历史扩展信息仓储。
     * @param storageDirectoryProvider 存储目录与访问权限提供器。
     * @param fileSystemGateway 文件系统访问入口。
     */
    public constructor(
        private readonly watchHistoryRepository: WatchHistoryRepository,
        private readonly watchHistoryExtRepository: WatchHistoryExtRepository,
        private readonly storageDirectoryProvider: StorageDirectoryProvider,
        private readonly fileSystemGateway: FileSystemGateway,
    ) {
    }

    /**
     * 将用户选择的文件或目录加入观看历史。
     *
     * @param filePaths 文件或目录路径列表。
     * @returns 新建或已存在的观看记录 ID。
     */
    public async create(filePaths: string[]): Promise<string[]> {
        const existingPaths: string[] = [];
        for (const filePath of filePaths) {
            await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(filePath);
            if (!await this.fileSystemGateway.pathIsMissing(filePath)) {
                existingPaths.push(filePath);
            }
        }

        const ids: string[] = [];
        for (const filePath of existingPaths) {
            if (await this.fileSystemGateway.directoryExists(filePath)) {
                ids.push(...await this.scanFolder(filePath));
                continue;
            }
            if (MediaUtil.isMedia(filePath) && await this.fileSystemGateway.fileExists(filePath)) {
                ids.push(...await this.ensureRecord(await this.preferHtml5VideoPath(filePath)));
            }
        }

        for (const id of ids) {
            await this.watchHistoryRepository.updateById(id, {
                updated_at: TimeUtil.timeUtc(),
            });
        }
        return ids;
    }

    /**
     * 扫描文件夹并补建其中的视频观看记录。
     *
     * @param folder 待扫描的文件夹。
     * @returns 新建或已存在的观看记录 ID。
     */
    public async scanFolder(folder: string): Promise<string[]> {
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(folder);
        if (!await this.fileSystemGateway.directoryExists(folder)) {
            return [];
        }

        const videoPaths = (await this.fileSystemGateway.listFileNames(folder))
            .filter((fileName) => MediaUtil.isMedia(fileName))
            .map((fileName) => path.join(folder, fileName));

        const ids: string[] = [];
        for (const videoPath of videoPaths) {
            ids.push(...await this.ensureRecord(videoPath, WatchHistoryProjectType.DIRECTORY));
        }
        return ids;
    }

    /**
     * 确保指定视频存在对应的观看记录。
     *
     * @param videoPath 视频文件路径。
     * @param projectType 独立文件或目录内文件。
     * @returns 新建或已存在的观看记录 ID。
     */
    public async ensureRecord(
        videoPath: string,
        projectType: WatchHistoryProjectType = WatchHistoryProjectType.FILE,
    ): Promise<string[]> {
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(videoPath);
        if (!await this.fileSystemGateway.fileExists(videoPath)) {
            return [];
        }

        const folder = path.dirname(videoPath);
        const fileName = path.basename(videoPath);
        const records = await this.watchHistoryRepository.findByBasePathFileNameType(
            folder,
            fileName,
            projectType,
        );
        if (records.length > 0) {
            return records.map((record) => record.id);
        }

        const record = await this.watchHistoryRepository.insert({
            id: this.mapId(folder, fileName, projectType),
            base_path: folder,
            file_name: fileName,
            project_type: projectType,
            current_position: 0,
        });
        return [record.id];
    }

    /**
     * 扫描视频库根目录和一级子目录，补建缺失的观看记录。
     */
    public async sync(): Promise<void> {
        const libraryPath = await this.storageDirectoryProvider.provideDirectory(
            StorageDirectoryTarget.VIDEOS,
        );
        if (!await this.fileSystemGateway.directoryExists(libraryPath)) {
            return;
        }

        const fileNames = await this.fileSystemGateway.listFileNames(libraryPath);
        const videoPaths = fileNames
            .filter((fileName) => MediaUtil.isMedia(fileName))
            .map((fileName) => path.join(libraryPath, fileName));
        for (const videoPath of videoPaths) {
            await this.ensureRecord(videoPath);
        }

        const folders = (await this.fileSystemGateway.listDirectoryNames(libraryPath))
            .map((directoryName) => path.join(libraryPath, directoryName));
        for (const folder of folders) {
            await this.scanFolder(folder);
        }
    }

    /**
     * 删除源文件已经明确不存在的观看记录。
     *
     * 权限不足等无法确认文件状态的情况不会删除记录。
     */
    public async cleanDeletedRecords(): Promise<void> {
        const files = await this.watchHistoryRepository.listDistinctBasePathFileName();
        const deletedFiles: typeof files = [];
        for (const file of files) {
            if (await this.fileSystemGateway.pathIsMissing(path.join(file.base_path, file.file_name))) {
                deletedFiles.push(file);
            }
        }

        for (const { base_path, file_name } of deletedFiles) {
            const records = await this.watchHistoryRepository.findByBasePathFileName(
                base_path,
                file_name,
            );
            for (const record of records) {
                await this.watchHistoryExtRepository.deleteByWatchHistoryId(record.id);
            }
            await this.watchHistoryRepository.deleteByBasePathFileName(base_path, file_name);
        }
    }

    /**
     * 为观看记录生成稳定 ID。
     *
     * @param folder 视频所在目录。
     * @param fileName 视频文件名。
     * @param projectType 记录类型。
     * @returns 基于路径和类型生成的哈希 ID。
     */
    private mapId(folder: string, fileName: string, projectType: WatchHistoryProjectType): string {
        return ObjUtil.hash(`${folder}-${fileName}-${projectType}`);
    }

    /**
     * 优先选择视频已生成的 HTML5 变体。
     *
     * @param filePath 原始视频或 HTML5 变体路径。
     * @returns HTML5 变体存在时返回其路径，否则返回原路径。
     */
    public async preferHtml5VideoPath(filePath: string): Promise<string> {
        const html5Path = getHtml5VariantPath(filePath);
        return await this.fileSystemGateway.fileExists(html5Path) ? html5Path : filePath;
    }
}
