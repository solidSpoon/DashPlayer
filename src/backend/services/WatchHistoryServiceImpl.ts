import { inject, injectable, postConstruct } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { ObjUtil } from '@/backend/utils/ObjUtil';
import path from 'path';
import MediaService from '@/backend/services/MediaService';
import TimeUtil from '@/common/utils/TimeUtil';
import CollUtil from '@/common/utils/CollUtil';
import WatchHistoryService from '@/backend/services/WatchHistoryService';
import WatchHistoryVO from '@/common/types/WatchHistoryVO';
import StrUtil from '@/common/utils/str-util';
import MatchSrt from '@/backend/utils/MatchSrt';
import MediaUtil from '@/common/utils/MediaUtil';
import WatchHistoryRepository, {
    WatchHistoryProjectType,
    WatchHistoryRecord,
} from '@/backend/services/repositories/WatchHistoryRepository';
import WatchHistoryExtRepository from '@/backend/services/repositories/WatchHistoryExtRepository';
import RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';
import StorageDirectoryProvider, {
    StorageDirectoryTarget,
} from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import {
    getHtml5GroupKey,
    getHtml5VariantPathFromRecord,
    isHtml5VariantFileName,
    mergeHtml5Variants,
} from '@/backend/services/watch-history-file-rules';
import WatchHistoryLibrary from '@/backend/services/WatchHistoryLibrary';
import WatchHistoryViewBuilder from '@/backend/services/WatchHistoryViewBuilder';
import FileSystemGateway from '@/backend/services/gateways/storage/FileSystemGateway';

/** 将一条观看历史记录转换为展示数据。 */
type WatchHistoryItemBuilder = (history: WatchHistoryRecord) => Promise<WatchHistoryVO | null>;

/**
 * 编排观看历史相关的用户动作。
 *
 * 媒体库扫描和记录维护由 WatchHistoryLibrary 负责，展示数据构建由
 * WatchHistoryViewBuilder 负责；本类保留列表、详情、删除和偏好设置等用例流程。
 */
@injectable()
export default class WatchHistoryServiceImpl implements WatchHistoryService {
    private readonly watchHistoryLibrary: WatchHistoryLibrary;
    private readonly watchHistoryViewBuilder: WatchHistoryViewBuilder;

    /**
     * 创建观看历史用例服务。
     *
     * @param storageDirectoryProvider 存储目录与访问权限提供器。
     * @param mediaService 媒体信息服务。
     * @param rendererGateway renderer 事件发送器。
     * @param watchHistoryRepository 观看历史仓储。
     * @param watchHistoryExtRepository 观看历史扩展信息仓储。
     * @param fileSystemGateway 文件系统访问入口。
     */
    public constructor(
        @inject(TYPES.StorageDirectoryProvider)
        private readonly storageDirectoryProvider: StorageDirectoryProvider,
        @inject(TYPES.MediaService)
        mediaService: MediaService,
        @inject(TYPES.RendererGateway)
        private readonly rendererGateway: RendererGateway,
        @inject(TYPES.WatchHistoryRepository)
        private readonly watchHistoryRepository: WatchHistoryRepository,
        @inject(TYPES.WatchHistoryExtRepository)
        private readonly watchHistoryExtRepository: WatchHistoryExtRepository,
        @inject(TYPES.FileSystemGateway)
        private readonly fileSystemGateway: FileSystemGateway,
    ) {
        this.watchHistoryLibrary = new WatchHistoryLibrary(
            watchHistoryRepository,
            watchHistoryExtRepository,
            storageDirectoryProvider,
            fileSystemGateway,
        );
        this.watchHistoryViewBuilder = new WatchHistoryViewBuilder(
            mediaService,
            watchHistoryExtRepository,
            storageDirectoryProvider,
            fileSystemGateway,
        );
    }

    /**
     * 读取观看历史列表。
     *
     * 目录路径和根列表共用查询、构建、合并、排序流程；完整列表与 basic
     * 列表只在单条记录的构建方式上不同。
     *
     * @param basePath 目录路径或目录记录 ID；空字符串表示读取根列表。
     * @param buildItem 单条记录的展示数据构建方式。
     * @param refreshFolder 是否在读取前扫描并刷新指定目录。
     * @returns 按当前目录或更新时间排序的观看历史列表。
     */
    private async listItems(
        basePath: string,
        buildItem: WatchHistoryItemBuilder,
        refreshFolder: boolean,
    ): Promise<WatchHistoryVO[]> {
        if (StrUtil.isNotBlank(basePath)) {
            const folderPath = await this.resolveFolderPath(basePath);
            if (!folderPath) {
                return [];
            }
            if (refreshFolder) {
                await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(folderPath);
                if (!await this.fileSystemGateway.directoryExists(folderPath)) {
                    return [];
                }
                await this.watchHistoryLibrary.scanFolder(folderPath);
            }

            const records = await this.watchHistoryRepository.listByBasePathAndProjectTypeOrderedByFileName(
                folderPath,
                WatchHistoryProjectType.DIRECTORY,
            );
            if (CollUtil.isEmpty(records)) {
                return [];
            }

            const items = await this.buildItems(records, buildItem);
            const merged = mergeHtml5Variants(items);
            merged.sort((a, b) => (
                (a.displayFileName ?? a.fileName).localeCompare(b.displayFileName ?? b.fileName)
            ));
            return merged;
        }

        const files = await this.watchHistoryRepository.listByProjectType(WatchHistoryProjectType.FILE);
        const fileItems = await this.buildItems(files, buildItem);

        const folders = await this.watchHistoryRepository.listDistinctFoldersByProjectType(
            WatchHistoryProjectType.DIRECTORY,
        );
        const folderItems: WatchHistoryVO[] = [];
        for (const folder of folders) {
            const folderHistories = await this.watchHistoryRepository
                .listByBasePathAndProjectTypeOrderedByUpdatedAtDesc(
                    folder,
                    WatchHistoryProjectType.DIRECTORY,
                );
            const item = await this.buildFolderItem(folderHistories, buildItem);
            if (item) {
                folderItems.push(item);
            }
        }

        const merged = mergeHtml5Variants([...fileItems, ...folderItems]);
        merged.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        return merged;
    }

    /**
     * 从目录中最近更新的有效视频构建目录展示项。
     *
     * @param histories 按更新时间倒序排列的目录视频记录。
     * @param buildItem 单条视频记录的构建方式。
     * @returns 目录展示项；没有可展示的视频时返回 `null`。
     */
    private async buildFolderItem(
        histories: WatchHistoryRecord[],
        buildItem: WatchHistoryItemBuilder,
    ): Promise<WatchHistoryVO | null> {
        for (const history of histories) {
            const item = await buildItem(history);
            if (item) {
                return { ...item, isFolder: true };
            }
        }
        return null;
    }

    /**
     * 将路径或记录 ID 解析成可读取的目录路径。
     *
     * 访问不存在的目录、非目录记录或尚未登记的目录时返回 `null`。
     *
     * @param basePath 目录路径或文件记录 ID。
     * @returns 可读取的目录路径；无效时返回 `null`。
     */
    private async resolveFolderPath(basePath: string): Promise<string | null> {
        if (ObjUtil.isHash(basePath)) {
            const record = await this.watchHistoryRepository.findById(basePath);
            if (!record || record.project_type !== WatchHistoryProjectType.FILE) {
                return null;
            }
            basePath = record.base_path;
        }

        const exists = await this.watchHistoryRepository.existsByBasePathAndProjectType(
            basePath,
            WatchHistoryProjectType.DIRECTORY,
        );
        if (!exists) {
            return null;
        }

        return basePath;
    }

    /**
     * 按顺序构建文件记录，忽略已经不存在的文件。
     *
     * @param histories 待构建的数据库记录。
     * @param buildItem 单条记录的构建方式。
     * @returns 成功构建的展示项。
     */
    private async buildItems(
        histories: WatchHistoryRecord[],
        buildItem: WatchHistoryItemBuilder,
    ): Promise<WatchHistoryVO[]> {
        const items: WatchHistoryVO[] = [];
        for (const history of histories) {
            const item = await buildItem(history);
            if (item) {
                items.push(item);
            }
        }
        return items;
    }

    /**
     * 读取包含时长和字幕匹配结果的完整观看历史列表。
     *
     * @param basePath 目录路径或目录记录 ID；空字符串表示根列表。
     * @returns 完整观看历史展示数据。
     */
    public async list(basePath: string): Promise<WatchHistoryVO[]> {
        await this.watchHistoryLibrary.sync();
        return this.listItems(
            basePath,
            (history) => this.watchHistoryViewBuilder.buildFull(history),
            true,
        );
    }

    /**
     * 读取用于页面首屏展示的轻量观看历史列表。
     *
     * @param basePath 目录路径或目录记录 ID；空字符串表示根列表。
     * @returns 不读取时长和字幕匹配结果的观看历史展示数据。
     */
    public async listBasic(basePath: string): Promise<WatchHistoryVO[]> {
        return this.listItems(
            basePath,
            (history) => this.watchHistoryViewBuilder.buildBasic(history),
            false,
        );
    }

    /**
     * 将用户选择的媒体文件或目录加入观看历史。
     *
     * @param filePaths 文件或目录路径列表。
     * @param concatLibrary 是否将路径拼接到视频库目录。
     * @returns 新建或已存在的观看记录 ID。
     */
    public async create(filePaths: string[], concatLibrary = false): Promise<string[]> {
        if (concatLibrary) {
            const lp = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.VIDEOS);
            filePaths = filePaths.map((f) => path.join(lp, f));
        }
        return this.watchHistoryLibrary.create(filePaths);
    }

    /**
     * 为视频关联字幕文件。
     *
     * @param videoPath 视频文件路径。
     * @param srtPath 字幕路径；传入 `same` 时使用同名 SRT。
     */
    public async attachSrt(videoPath: string, srtPath: string | 'same'): Promise<void> {
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(videoPath);
        if (srtPath === 'same') {
            srtPath = path.join(path.dirname(videoPath), path.basename(videoPath, path.extname(videoPath)) + '.srt');
        }
        return this.attachSrtInner(videoPath, srtPath);
    }

    /**
     * 读取单条观看历史详情，并优先使用已生成的 HTML5 变体。
     *
     * @param id 观看历史记录 ID。
     * @returns 详情展示数据；记录或源文件不存在时返回 `null`。
     */
    public async detail(id: string): Promise<WatchHistoryVO | null> {
        const record = await this.watchHistoryRepository.findById(id);
        if (!record) {
            return null;
        }

        const preferredRecord = await this.findPreferredVideoRecord(record);
        const item = await this.watchHistoryViewBuilder.buildFull(preferredRecord)
            ?? (preferredRecord.id === record.id
                ? null
                : await this.watchHistoryViewBuilder.buildFull(record));
        if (!item) {
            return null;
        }
        return {
            ...item,
            displayFileName: preferredRecord.id === record.id ? undefined : record.file_name,
            isFolder: record.project_type === WatchHistoryProjectType.DIRECTORY,
        };
    }

    /**
     * 获取实际用于播放的观看记录。
     *
     * 原始视频存在 HTML5 变体时会补建并返回变体记录；其他情况保持原记录。
     *
     * @param record 原始观看记录。
     * @returns 优先使用的可播放记录。
     */
    private async findPreferredVideoRecord(record: WatchHistoryRecord): Promise<WatchHistoryRecord> {
        if (isHtml5VariantFileName(record.file_name)) {
            return record;
        }

        const html5Path = getHtml5VariantPathFromRecord(record);
        if (!await this.fileSystemGateway.fileExists(html5Path)) {
            return record;
        }

        await this.watchHistoryLibrary.ensureRecord(html5Path, record.project_type);
        return await this.watchHistoryRepository.findOneByBasePathFileNameType(
            record.base_path,
            path.basename(html5Path),
            record.project_type,
        ) ?? record;
    }

    /**
     * 删除一条观看记录或其所在目录下的整组记录。
     *
     * @param id 观看历史记录 ID。
     */
    public async groupDelete(id: string): Promise<void> {
        const toDeleteIds: string[] = [];
        const record = await this.watchHistoryRepository.findById(id);
        if (!record) {
            return;
        }
        if (record.project_type === WatchHistoryProjectType.DIRECTORY) {
            const records = await this.watchHistoryRepository.listByBasePathAndProjectTypeOrderedByFileName(
                record.base_path,
                WatchHistoryProjectType.DIRECTORY,
            );
            toDeleteIds.push(...records.map(r => r.id));
        } else {
            toDeleteIds.push(record.id);
        }
        await Promise.all(toDeleteIds.map(id => this.deleteById(id)));
        const libraryPath = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.VIDEOS);
        await this.fileSystemGateway.removeEmptySubdirectories(libraryPath);
    }


    /**
     * 更新视频播放进度。
     *
     * @param file 视频文件路径。
     * @param currentPosition 播放位置，单位为秒。
     */
    public async updateProgress(file: string, currentPosition: number): Promise<void> {
        file = await this.watchHistoryLibrary.preferHtml5VideoPath(file);
        const base_path = path.dirname(file);
        const file_name = path.basename(file);
        await this.watchHistoryRepository.updateByBasePathFileName(base_path, file_name, {
            current_position: currentPosition,
            updated_at: TimeUtil.timeUtc(),
        });
    }

    /**
     * 将字幕文件关联到指定视频记录。
     *
     * @param videoPath 视频文件路径。
     * @param srtPath 字幕文件路径。
     */
    private async attachSrtInner(videoPath: string, srtPath: string): Promise<void> {
        videoPath = await this.watchHistoryLibrary.preferHtml5VideoPath(videoPath);
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(videoPath);
        if (!await this.fileSystemGateway.fileExists(videoPath)) {
            return;
        }

        const video = path.basename(videoPath);
        const folder = path.dirname(videoPath);

        // 如果 srtPath 只是文件名，则使用视频文件的目录作为根目录
        if (path.dirname(srtPath) === '.') {
            srtPath = path.join(folder, srtPath);
        }

        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(srtPath);
        if (!await this.fileSystemGateway.fileExists(srtPath)) {
            return;
        }

        const records: WatchHistoryRecord[] = await this.watchHistoryRepository.findByBasePathFileName(folder, video);

        const needsUpdate = records.some((record) => record.srt_file !== srtPath);
        if (needsUpdate) {
            await this.watchHistoryRepository.updateByBasePathFileName(folder, video, {
                srt_file: srtPath,
                updated_at: TimeUtil.timeUtc(),
            });
        }
    }

    /**
     * 推荐与视频文件名匹配的字幕文件。
     *
     * @param file 视频文件路径。
     * @returns 按匹配度排序的字幕路径。
     */
    public async suggestSrt(file: string): Promise<string[]> {
        file = await this.watchHistoryLibrary.preferHtml5VideoPath(file);
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(file);
        const folder = path.dirname(file);
        const files = await this.fileSystemGateway.listFileNames(folder);
        const srtInFolder = files.filter(file => MediaUtil.isSubtitle(file))
            .map(file => path.join(folder, file));
        return MatchSrt.matchAll(file, srtInFolder);
    }

    @postConstruct()
    public init(): void {
        this.watchHistoryLibrary.cleanDeletedRecords()
            .then(() => this.watchHistoryLibrary.sync())
            .then();
    }

    /**
     * 删除单条观看记录，并按规则删除视频库中的无引用文件。
     *
     * @param id 观看历史记录 ID。
     */
    private async deleteById(id: string): Promise<void> {
        const libraryPath = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.VIDEOS);
        const record = await this.watchHistoryRepository.findById(id);
        if (!record) {
            return;
        }
        // 如果是 libraryPath 或子文件夹下的文件
        // 删除文件
        const filePath = path.join(record.base_path, record.file_name);
        if (filePath.startsWith(libraryPath)) {
            await this.fileSystemGateway.removeFileIfExists(filePath);
            this.rendererGateway.fireAndForget('ui/show-toast', {
                message: '该文件位于视频库中，已为您删除原文件',
                variant: 'info',
            });
        }
        await this.watchHistoryRepository.deleteById(id);
        await this.watchHistoryExtRepository.deleteByWatchHistoryId(id);
        // 删除字幕文件
        if (record.srt_file && record.srt_file.startsWith(libraryPath)) {
            const srtExists = await this.watchHistoryRepository.findBySrtFile(record.srt_file);
            if (CollUtil.isEmpty(srtExists)) {
                await this.fileSystemGateway.removeFileIfExists(record.srt_file);
            }
        }
    }

    /**
     * 获取同一目录中的下一组视频，并优先选择 HTML5 变体。
     *
     * @param currentId 当前观看历史记录 ID。
     * @returns 下一条视频的完整展示数据；不存在时返回 `null`。
     */
    public async getNextVideo(currentId: string): Promise<WatchHistoryVO | null> {
        const currentRecord = await this.watchHistoryRepository.findById(currentId);

        if (!currentRecord) {
            return null;
        }

        const folderVideos = await this.watchHistoryRepository.listByBasePathAndProjectTypeOrderedByFileName(
            currentRecord.base_path,
            WatchHistoryProjectType.DIRECTORY,
        );

        if (CollUtil.isEmpty(folderVideos)) {
            return null;
        }

        const orderedGroupKeys: string[] = [];
        const seenKeys = new Set<string>();
        for (const record of folderVideos) {
            const key = getHtml5GroupKey(record.base_path, record.file_name);
            if (seenKeys.has(key)) {
                continue;
            }
            seenKeys.add(key);
            orderedGroupKeys.push(key);
        }
        const currentKey = getHtml5GroupKey(currentRecord.base_path, currentRecord.file_name);
        const currentIndex = orderedGroupKeys.indexOf(currentKey);

        if (currentIndex >= 0 && currentIndex < orderedGroupKeys.length - 1) {
            const nextKey = orderedGroupKeys[currentIndex + 1];
            const group = folderVideos.filter((record) => (
                getHtml5GroupKey(record.base_path, record.file_name) === nextKey
            ));
            const primary =
                group.find((record) => isHtml5VariantFileName(record.file_name)) ??
                group[0];
            if (!primary) {
                return null;
            }
            const preferredRecord = await this.findPreferredVideoRecord(primary);
            return this.watchHistoryViewBuilder.buildFull(preferredRecord)
                ?? (preferredRecord.id === primary.id
                    ? null
                    : this.watchHistoryViewBuilder.buildFull(primary));
        }

        return null;
    }

    /**
     * 保存用户手动设置的播客模式偏好。
     *
     * 用户一旦手动开关过播客模式，后续自动切换逻辑都应尊重该选择，
     * 因此这里把偏好落库（写入扩展表），保证重启后依然生效。
     *
     * @param videoId 视频观看记录 ID
     * @param podcastMode 用户手动选择的播客模式值
     */
    public async setPodcastModePreference(videoId: string, podcastMode: boolean): Promise<void> {
        await this.watchHistoryExtRepository.upsert(videoId, {
            podcast_mode_user_set: true,
            podcast_mode_manual: podcastMode,
        });
    }
}
