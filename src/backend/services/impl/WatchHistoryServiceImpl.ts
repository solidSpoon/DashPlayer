import { inject, injectable, postConstruct } from 'inversify';
import LocationService, { LocationType } from '@/backend/services/LocationService';
import TYPES from '@/backend/ioc/types';
import { watchHistory, WatchHistory, WatchHistoryType } from '@/backend/db/tables/watchHistory';
import { ObjUtil } from '@/backend/utils/ObjUtil';
import db from '@/backend/db';
import fs from 'fs';
import path from 'path';
import { and, asc, desc, eq } from 'drizzle-orm';
import MediaService from '@/backend/services/MediaService';
import TimeUtil from '@/common/utils/TimeUtil';
import CollUtil from '@/common/utils/CollUtil';
import WatchHistoryService from '@/backend/services/WatchHistoryService';
import WatchHistoryVO from '@/common/types/WatchHistoryVO';
import StrUtil from '@/common/utils/str-util';
import MatchSrt from '@/backend/utils/MatchSrt';
import MediaUtil from '@/common/utils/MediaUtil';
import SystemService from '@/backend/services/SystemService';
import FileUtil from '@/backend/utils/FileUtil';


@injectable()
export default class WatchHistoryServiceImpl implements WatchHistoryService {
    @inject(TYPES.LocationService)
    private locationService!: LocationService;
    @inject(TYPES.MediaService)
    private mediaService!: MediaService;
    @inject(TYPES.SystemService)
    private systemService!: SystemService;

    private mapId(folder: string, name: string, type: WatchHistoryType) {
        return ObjUtil.hash(`${folder}-${name}-${type}`);
    }

    public async list(bathPath: string): Promise<WatchHistoryVO[]> {
        await this.syncLibrary();
        if (StrUtil.isNotBlank(bathPath)) {
            if (ObjUtil.isHash(bathPath)) {
                const [record] = await db.select().from(watchHistory)
                    .where(eq(watchHistory.id, bathPath));
                if (!record || record.project_type !== WatchHistoryType.FILE) {
                    return [];
                }
                bathPath = record.base_path;
            }
            if (!fs.existsSync(bathPath) || !fs.statSync(bathPath).isDirectory()) {
                return [];
            }
            const exist = await db.select().from(watchHistory).where(
                and(
                    eq(watchHistory.base_path, bathPath),
                    eq(watchHistory.project_type, WatchHistoryType.DIRECTORY)
                )
            ).then(records => CollUtil.isNotEmpty(records));
            if (!exist) {
                return [];
            }
            await this.tryCreateFromFolder(bathPath);
            const records = await db.select().from(watchHistory)
                .where(
                    and(
                        eq(watchHistory.base_path, bathPath),
                        eq(watchHistory.project_type, WatchHistoryType.DIRECTORY)
                    )
                ).orderBy(asc(watchHistory.file_name));
            if (CollUtil.isEmpty(records)) {
                return [];
            }
            const result = [];
            for (const record of records) {
                const vo = await this.buildVoFromFile(record);
                if (vo) {
                    result.push(vo);
                }
            }
            return result;
        }
        const result = [];
        const files: WatchHistory[] = await db.select().from(watchHistory)
            .where(eq(watchHistory.project_type, WatchHistoryType.FILE));
        for (const file of files) {
            const vo = await this.buildVoFromFile(file);
            if (vo) {
                result.push(vo);
            }
        }
        const folders: { folder: string }[] = await db.selectDistinct({
            folder: watchHistory.base_path
        }).from(watchHistory)
            .where(eq(watchHistory.project_type, WatchHistoryType.DIRECTORY));
        for (const { folder } of folders) {
            const vo = await this.buildVoFromFolder(folder);
            if (vo) {
                result.push(vo);
            }
        }
        result.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        return result;
    }

    public async detail(id: string): Promise<WatchHistoryVO | null> {
        const [record] = await db.select().from(watchHistory)
            .where(eq(watchHistory.id, id));
        if (!record) {
            return null;
        }
        const r = await this.buildVoFromFile(record);
        if (!r) {
            return null;
        }
        return {
            ...r,
            isFolder: record.project_type === WatchHistoryType.DIRECTORY
        };
    }

    public async create(files: string[]): Promise<string[]> {
        const ids: string[] = [];
        const existFiles = files.filter(file => fs.existsSync(file));
        const folders = existFiles.filter(file => fs.statSync(file).isDirectory());
        if (CollUtil.isNotEmpty(folders)) {
            for (const folder of folders) {
                const sids = await this.tryCreateFromFolder(folder);
                ids.push(...sids);
            }
        }
        const videos = existFiles
            .filter(file => fs.statSync(file).isFile())
            .filter(file => MediaUtil.isMedia(file));
        for (const video of videos) {
            const sids = await this.tryCreate(video);
            ids.push(...sids);
        }
        for (const id of ids) {
            await db.update(watchHistory).set({
                updated_at: TimeUtil.timeUtc()
            }).where(eq(watchHistory.id, id));
        }
        return ids;
    }

    public async groupDelete(id: string): Promise<void> {
        const toDeleteIds: string[] = [];
        const [record] = await db.select().from(watchHistory)
            .where(eq(watchHistory.id, id));
        if (!record) {
            return;
        }
        if (record.project_type === WatchHistoryType.DIRECTORY) {
            const records = await db.select().from(watchHistory)
                .where(and(eq(watchHistory.base_path, record.base_path), eq(watchHistory.project_type, WatchHistoryType.DIRECTORY)));
            toDeleteIds.push(...records.map(r => r.id));
        } else {
            toDeleteIds.push(record.id);
        }
        await Promise.all(toDeleteIds.map(id => this.deleteById(id)));
        const libraryPath = this.locationService.getDetailLibraryPath(LocationType.VIDEOS);
        await FileUtil.cleanEmptyDirectories(libraryPath);
    }


    public async analyseFolder(path: string): Promise<{ supported: number, unsupported: number }> {
        const files = await FileUtil.listFiles(path);
        const videos = files.filter((f) => MediaUtil.isMedia(f));
        return {
            supported: videos.filter((v) => MediaUtil.supported(v)).length,
            unsupported: videos.filter((v) => !MediaUtil.supported(v)).length
        };
    }

    public async updateProgress(file: string, currentPosition: number): Promise<void> {
        const base_path = path.dirname(file);
        const file_name = path.basename(file);
        await db.update(watchHistory).set({
            current_position: currentPosition,
            updated_at: TimeUtil.timeUtc()
        }).where(
            and(
                eq(watchHistory.base_path, base_path),
                eq(watchHistory.file_name, file_name)
            )
        );
    }

    private async buildVoFromFolder(folder: string): Promise<WatchHistoryVO | null> {
        const folderVideos: WatchHistory[] = await db.select().from(watchHistory)
            .where(
                and(
                    eq(watchHistory.base_path, folder),
                    eq(watchHistory.project_type, WatchHistoryType.DIRECTORY)
                )
            ).orderBy(desc(watchHistory.updated_at));
        if (CollUtil.isEmpty(folderVideos)) {
            return null;
        }
        for (const video of folderVideos) {
            const vo = await this.buildVoFromFile(video);
            if (vo) {
                return {
                    ...vo,
                    isFolder: true
                };
            }
        }
        return null;
    }

    private async buildVoFromFile(history: WatchHistory): Promise<WatchHistoryVO | null> {
        const { base_path, file_name } = history;
        const filePath = path.join(base_path, file_name);
        if (!fs.existsSync(filePath)) {
            return null;
        }
        let srtFile = history.srt_file;
        if (StrUtil.isNotBlank(srtFile)) {
            const exists = await FileUtil.fileExists(srtFile);
            if (!exists) {
                srtFile = '';
            }
        }
        if (StrUtil.isBlank(srtFile)) {
            const srtFiles = await this.listSrtFiles(base_path);
            srtFile = MatchSrt.matchOne(filePath, srtFiles);
        }
        const duration = await this.mediaService.duration(filePath);
        return {
            id: history.id,
            basePath: history.base_path,
            fileName: history.file_name,
            isFolder: false,
            updatedAt: TimeUtil.isoToDate(history.updated_at),
            duration,
            current_position: history.current_position,
            srtFile: srtFile ?? '',
            playing: false
        };
    }


    private async listSrtFiles(folder: string): Promise<string[]> {
        const files = await FileUtil.listFiles(folder);
        return files.filter(file => MediaUtil.isSrt(file))
            .map(file => path.join(folder, file));
    }

    private async tryCreateFromFolder(folder: string): Promise<string[]> {
        const ids: string[] = [];
        if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
            return ids;
        }
        const files = fs.readdirSync(folder);
        const videoFiles = files.filter(file => MediaUtil.isMedia(file))
            .map(file => path.join(folder, file));
        for (const video of videoFiles) {
            const sids = await this.tryCreate(video, WatchHistoryType.DIRECTORY);
            ids.push(...sids);
        }
        return ids;
    }

    /**
     * 如果不存在就创建一个历史记录
     * @param video
     * @param type
     * @private
     */
    private async tryCreate(video: string, type: WatchHistoryType = WatchHistoryType.FILE): Promise<string[]> {
        const ids: string[] = [];
        if (!fs.existsSync(video)) {
            return ids;
        }
        const folder = path.dirname(video);
        const name = path.basename(video);
        const records: WatchHistory[] = await db.select().from(watchHistory)
            .where(
                and(
                    eq(watchHistory.base_path, folder),
                    eq(watchHistory.file_name, name),
                    eq(watchHistory.project_type, type)
                )
            );
        if (CollUtil.isEmpty(records)) {
            const [record]: WatchHistory[] = await db.insert(watchHistory).values({
                id: this.mapId(folder, name, type),
                base_path: folder,
                file_name: name,
                project_type: type,
                current_position: 0
            }).returning();
            ids.push(record.id);
        }
        records.forEach(record => ids.push(record.id));
        return ids;
    }


    /**
     * 关联字幕文件
     * @param videoPath
     * @param srtPath
     * @private
     */
    public async attachSrt(videoPath: string, srtPath: string) {
        if (!fs.existsSync(videoPath)) {
            return;
        }

        const video = path.basename(videoPath);
        const folder = path.dirname(videoPath);

        // 如果 srtPath 只是文件名，则使用视频文件的目录作为根目录
        if (path.dirname(srtPath) === '.') {
            srtPath = path.join(folder, srtPath);
        }

        if (!fs.existsSync(srtPath)) {
            return;
        }

        const records: WatchHistory[] = await db.select().from(watchHistory)
            .where(
                and(
                    eq(watchHistory.base_path, folder),
                    eq(watchHistory.file_name, video)
                )
            );

        for (const record of records) {
            if (record.srt_file === srtPath) {
                continue;
            }
            await db.update(watchHistory).set({
                srt_file: srtPath,
                updated_at: TimeUtil.timeUtc()
            }).where(
                and(
                    eq(watchHistory.base_path, folder),
                    eq(watchHistory.file_name, video)
                )
            );
        }
    }

    async suggestSrt(file: string): Promise<string[]> {
        const folder = path.dirname(file);
        const files = await FileUtil.listFiles(folder);
        const srtInFolder = files.filter(file => MediaUtil.isSrt(file))
            .map(file => path.join(folder, file));
        return MatchSrt.matchAll(file, srtInFolder);
    }


    /**
     * 同步视频库中的文件
     * @private
     */
    private async syncLibrary() {
        const libraryPath = this.locationService.getDetailLibraryPath(LocationType.VIDEOS);
        if (!fs.existsSync(libraryPath)) {
            return;
        }
        const files = await FileUtil.listFiles(libraryPath);
        const videoFiles = files.filter(file => MediaUtil.isMedia(file))
            .map(file => path.join(libraryPath, file));
        for (const video of videoFiles) {
            await this.tryCreate(video);
        }
        const folders = files.filter(file => fs.statSync(path.join(libraryPath, file)).isDirectory());
        for (const folder of folders) {
            await this.tryCreateFromFolder(path.join(libraryPath, folder));
        }
    }

    /**
     * 删除源文件不存在的记录
     * @private
     */
    private async cleanDeletedHistory() {
        const files = await db.selectDistinct({
            base_path: watchHistory.base_path,
            file_name: watchHistory.file_name
        }).from(watchHistory);

        const deletedFiles = files.filter(file => !fs.existsSync(path.join(file.base_path, file.file_name)));

        for (const { base_path, file_name } of deletedFiles) {
            await db.delete(watchHistory).where(
                and(
                    eq(watchHistory.base_path, base_path),
                    eq(watchHistory.file_name, file_name)
                )
            );
        }
    }

    @postConstruct()
    public init() {
        this.cleanDeletedHistory()
            .then(() => this.syncLibrary())
            .then();
    }

    /**
     * 根据 id 删除记录，如果是视频库中的文件，删除原文件
     * @param id 视频 id
     * @private
     */
    private async deleteById(id: string) {
        const libraryPath = this.locationService.getDetailLibraryPath(LocationType.VIDEOS);
        const [record]: WatchHistory[] = await db.select().from(watchHistory)
            .where(eq(watchHistory.id, id));
        if (!record) {
            return;
        }
        // 如果是 libraryPath 或子文件夹下的文件
        // 删除文件
        const filePath = path.join(record.base_path, record.file_name);
        if (filePath.startsWith(libraryPath)) {
            await FileUtil.deleteFile(filePath);
            this.systemService.sendInfoToRenderer('该文件位于视频库中，已为您删除原文件');
        }
        await db.delete(watchHistory)
            .where(eq(watchHistory.id, id));
        // 删除字幕文件
        if (record.srt_file && record.srt_file.startsWith(libraryPath)) {
            const srtExists = await db.select().from(watchHistory)
                .where(eq(watchHistory.srt_file, record.srt_file));
            if (CollUtil.isEmpty(srtExists)) {
                await FileUtil.deleteFile(record.srt_file);
            }
        }
    }

    public async getNextVideo(currentId: string): Promise<WatchHistoryVO | null> {
        const [currentRecord] = await db.select().from(watchHistory)
            .where(eq(watchHistory.id, currentId));

        if (!currentRecord) {
            return null;
        }

        const folderVideos = await db.select().from(watchHistory)
            .where(
                and(
                    eq(watchHistory.base_path, currentRecord.base_path),
                    eq(watchHistory.project_type, WatchHistoryType.DIRECTORY)
                )
            ).orderBy(asc(watchHistory.file_name));

        if (CollUtil.isEmpty(folderVideos)) {
            return null;
        }

        const currentIndex = folderVideos.findIndex(video => video.id === currentId);

        if (currentIndex >= 0 && currentIndex < folderVideos.length - 1) {
            const nextVideo = folderVideos[currentIndex + 1];
            return await this.buildVoFromFile(nextVideo);
        }

        return null;
    }
}
