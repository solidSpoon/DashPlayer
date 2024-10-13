import { inject, injectable, postConstruct } from 'inversify';
import LocationService, { LocationType } from '@/backend/services/LocationService';
import TYPES from '@/backend/ioc/types';
import { watchHistory, WatchHistory, WatchHistoryType } from '@/backend/db/tables/playHistory';
import { ObjUtil } from '@/backend/utils/ObjUtil';
import db from '@/backend/db';
import fs from 'fs';
import path from 'path';
import { and, desc, eq } from 'drizzle-orm';
import MediaService from '@/backend/services/MediaService';
import TimeUtil from '@/common/utils/TimeUtil';
import CollUtil from '@/common/utils/CollUtil';
import WatchHistoryService from '@/backend/services/WatchHistoryService';
import WatchHistoryVO from '@/common/types/WatchHistoryVO';
import StrUtil from '@/common/utils/str-util';
import MatchSrt from '@/backend/utils/MatchSrt';


@injectable()
export default class WatchHistoryServiceImpl implements WatchHistoryService {
    @inject(TYPES.LocationService)
    private locationService!: LocationService;
    @inject(TYPES.MediaService)
    private mediaService!: MediaService;

    private mapId(folder: string, name: string, type: WatchHistoryType) {
        return ObjUtil.hash(`${folder}-${name}-${type}`);
    }

    public async list(): Promise<WatchHistoryVO[]> {
        await this.syncLibrary();
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

    public async detail(folder: string): Promise<WatchHistoryVO[]> {
        if (!fs.existsSync(folder)) {
            return [];
        }
        await this.tryAddMedia(folder);
        const records = await db.select().from(watchHistory)
            .where(
                and(
                    eq(watchHistory.base_path, folder),
                    eq(watchHistory.project_type, WatchHistoryType.DIRECTORY)
                )
            ).orderBy(desc(watchHistory.updated_at));
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

    public async create(files: string[]) {
        const existFiles = files.filter(file => fs.existsSync);

    };

    private async addMedia(fp: string) {
        if (!fs.existsSync(fp)) {
            return;
        }
        // 判断是否是文件夹
        const stat = fs.statSync(fp);
        if (stat.isFile()) {
            await this.addDoUpdate(path.dirname(fp), path.basename(fp), WatchHistoryType.FILE);
        }
        if (stat.isDirectory()) {
            const files = fs.readdirSync(fp);
            for (const file of files) {
                await this.addDoUpdate(fp, file, WatchHistoryType.DIRECTORY);
            }
        }
    }

    private async tryAddMedia(fp: string) {
        if (!fs.existsSync(fp)) {
            return;
        }
        // 判断是否是文件夹
        const stat = fs.statSync(fp);
        if (stat.isFile()) {
            await this.addDoNothing(path.dirname(fp), path.basename(fp), WatchHistoryType.FILE);
        }
        if (stat.isDirectory()) {
            const files = fs.readdirSync(fp);
            for (const file of files) {
                await this.addDoNothing(fp, file, WatchHistoryType.DIRECTORY);
            }
        }
    }

    async updateProgress(file: string, duration: number): Promise<void> {
        const base_path = path.dirname(file);
        const file_name = path.basename(file);
        await db.update(watchHistory).set({
            current_position: duration,
            updated_at: TimeUtil.timeUtc()
        }).where(
            and(
                eq(watchHistory.base_path, base_path),
                eq(watchHistory.file_name, file_name)
            )
        );
    }


    private async addDoNothing(basePath: string, fileName: string, type: WatchHistoryType) {
        const id = this.mapId(basePath, fileName, type);
        await db.insert(watchHistory).values({
            id,
            base_path: basePath,
            file_name: fileName,
            project_type: WatchHistoryType.DIRECTORY,
            current_position: 0
        }).onConflictDoNothing({
            target: [watchHistory.id]
        });
    }


    private async addDoUpdate(basePath: string, fileName: string, type: WatchHistoryType) {
        const id = this.mapId(basePath, fileName, type);
        await db.insert(watchHistory).values({
            id,
            base_path: basePath,
            file_name: fileName,
            project_type: WatchHistoryType.DIRECTORY,
            current_position: 0
        }).onConflictDoUpdate({
            target: [watchHistory.id],
            set: {
                updated_at: TimeUtil.timeUtc()
            }
        });
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
        if (StrUtil.isBlank(srtFile)) {
            const srtFiles = await this.listSrtFiles(base_path);
            srtFile = MatchSrt.matchOne(filePath, srtFiles);
        }
        const duration = await this.mediaService.duration(filePath);
        return {
            basePath: history.base_path,
            fileName: history.file_name,
            isFolder: false,
            updatedAt: TimeUtil.isoToDate(history.updated_at),
            duration,
            current_position: history.current_position,
            srtFile: srtFile ?? ''
        };
    }

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

    private async syncLibrary() {
        const libraryPath = this.locationService.getDetailLibraryPath(LocationType.VIDEOS);
        if (!fs.existsSync(libraryPath)) {
            return;
        }
        const files = fs.readdirSync(libraryPath);
        for (const file of files) {
            const filePath = path.join(libraryPath, file);
            await this.tryAddMedia(filePath);
        }
    }

    private async listSrtFiles(folder: string): Promise<string[]> {
        const files = fs.readdirSync(folder);
        return files.filter(file => file.endsWith('.srt'))
            .map(file => path.join(folder, file));
    }

    @postConstruct()
    private async init() {
        await this.cleanDeletedHistory();
    }

}
