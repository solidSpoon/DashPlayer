import { inject, injectable, postConstruct } from 'inversify';
import LocationService, { LocationType } from '@/backend/application/services/LocationService';
import TYPES from '@/backend/ioc/types';
import { WatchHistory, WatchHistoryType } from '@/backend/infrastructure/db/tables/watchHistory';
import { ObjUtil } from '@/backend/utils/ObjUtil';
import fs from 'fs';
import path from 'path';
import MediaService from '@/backend/application/services/MediaService';
import TimeUtil from '@/common/utils/TimeUtil';
import CollUtil from '@/common/utils/CollUtil';
import WatchHistoryService from '@/backend/application/services/WatchHistoryService';
import WatchHistoryVO from '@/common/types/WatchHistoryVO';
import StrUtil from '@/common/utils/str-util';
import MatchSrt from '@/backend/utils/MatchSrt';
import MediaUtil from '@/common/utils/MediaUtil';
import FileUtil from '@/backend/utils/FileUtil';
import WatchHistoryRepository from '@/backend/application/ports/repositories/WatchHistoryRepository';
import RendererGateway from '@/backend/application/ports/gateways/renderer/RendererGateway';


@injectable()
export default class WatchHistoryServiceImpl implements WatchHistoryService {
    @inject(TYPES.LocationService)
    private locationService!: LocationService;
    @inject(TYPES.MediaService)
    private mediaService!: MediaService;
    @inject(TYPES.RendererGateway)
    private rendererGateway!: RendererGateway;
    @inject(TYPES.WatchHistoryRepository)
    private watchHistoryRepository!: WatchHistoryRepository;

    private mapId(folder: string, name: string, type: WatchHistoryType) {
        return ObjUtil.hash(`${folder}-${name}-${type}`);
    }

    private preferHtml5VideoPath(filePath: string): string {
        const parsed = path.parse(filePath);
        if (parsed.base.toLowerCase().endsWith('.html5.mp4')) {
            return filePath;
        }
        const baseName = parsed.name.toLowerCase().endsWith('.html5') ? parsed.name.slice(0, -'.html5'.length) : parsed.name;
        const html5Path = path.join(parsed.dir, `${baseName}.html5.mp4`);
        return fs.existsSync(html5Path) ? html5Path : filePath;
    }

    private html5VariantPathFromRecord(record: WatchHistory): string {
        const parsed = path.parse(record.file_name);
        if (record.file_name.toLowerCase().endsWith('.html5.mp4')) {
            return path.join(record.base_path, record.file_name);
        }
        const baseName = parsed.name.toLowerCase().endsWith('.html5') ? parsed.name.slice(0, -'.html5'.length) : parsed.name;
        return path.join(record.base_path, `${baseName}.html5.mp4`);
    }

    private isHtml5VariantFileName(fileName: string): boolean {
        return fileName.toLowerCase().endsWith('.html5.mp4');
    }

    private normalizeHtml5GroupKey(basePath: string, fileName: string): string {
        const ext = path.extname(fileName);
        let base = path.basename(fileName, ext);
        if (base.toLowerCase().endsWith('.html5')) {
            base = base.slice(0, -'.html5'.length);
        }
        return `${basePath}::${base.toLowerCase()}`;
    }

    private pickDisplayFileName(group: WatchHistoryVO[], primary: WatchHistoryVO): string {
        if (!this.isHtml5VariantFileName(primary.fileName)) {
            return primary.fileName;
        }
        const mkv = group.find((g) => g.fileName.toLowerCase().endsWith('.mkv'));
        if (mkv) {
            return mkv.fileName;
        }
        const nonHtml5 = group.find((g) => !this.isHtml5VariantFileName(g.fileName));
        return nonHtml5?.fileName ?? primary.fileName;
    }

    private mergeHtml5Variants(items: WatchHistoryVO[]): WatchHistoryVO[] {
        const groups = new Map<string, WatchHistoryVO[]>();
        for (const item of items) {
            if (item.isFolder) {
                groups.set(`${item.id}::folder`, [item]);
                continue;
            }
            const key = this.normalizeHtml5GroupKey(item.basePath, item.fileName);
            const list = groups.get(key) ?? [];
            list.push(item);
            groups.set(key, list);
        }
        const merged: WatchHistoryVO[] = [];
        for (const group of groups.values()) {
            if (group.length === 1) {
                merged.push(group[0]);
                continue;
            }
            const primary =
                group.find((g) => this.isHtml5VariantFileName(g.fileName)) ??
                group[0];
            merged.push({
                ...primary,
                displayFileName: this.pickDisplayFileName(group, primary)
            });
        }
        return merged;
    }

    public async list(bathPath: string): Promise<WatchHistoryVO[]> {
        await this.syncLibrary();
        if (StrUtil.isNotBlank(bathPath)) {
            if (ObjUtil.isHash(bathPath)) {
                const record = await this.watchHistoryRepository.findById(bathPath);
                if (!record || record.project_type !== WatchHistoryType.FILE) {
                    return [];
                }
                bathPath = record.base_path;
            }
            if (!fs.existsSync(bathPath) || !fs.statSync(bathPath).isDirectory()) {
                return [];
            }
            const exist = await this.watchHistoryRepository.existsByBasePathAndProjectType(bathPath, WatchHistoryType.DIRECTORY);
            if (!exist) {
                return [];
            }
            await this.tryCreateFromFolder(bathPath);
            const records = await this.watchHistoryRepository.listByBasePathAndProjectTypeOrderedByFileName(
                bathPath,
                WatchHistoryType.DIRECTORY,
            );
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
            const merged = this.mergeHtml5Variants(result);
            merged.sort((a, b) => (a.displayFileName ?? a.fileName).localeCompare(b.displayFileName ?? b.fileName));
            return merged;
        }
        const result = [];
        const files: WatchHistory[] = await this.watchHistoryRepository.listByProjectType(WatchHistoryType.FILE);
        for (const file of files) {
            const vo = await this.buildVoFromFile(file);
            if (vo) {
                result.push(vo);
            }
        }
        const folders = await this.watchHistoryRepository.listDistinctFoldersByProjectType(WatchHistoryType.DIRECTORY);
        for (const folder of folders) {
            const vo = await this.buildVoFromFolder(folder);
            if (vo) {
                result.push(vo);
            }
        }
        const merged = this.mergeHtml5Variants(result);
        merged.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        return merged;
    }

    public async create(filePaths: string[], concatLibrary = false): Promise<string[]> {
        if (concatLibrary) {
            const lp = this.locationService.getDetailLibraryPath(LocationType.VIDEOS);
            filePaths = filePaths.map((f) => path.join(lp, f));
        }
        return this.createInner(filePaths);
    }

    public async attachSrt(videoPath: string, srtPath: string | 'same'): Promise<void> {
        if (srtPath === 'same') {
            srtPath = path.join(path.dirname(videoPath), path.basename(videoPath, path.extname(videoPath)) + '.srt');
        }
        return this.attachSrtInner(videoPath, srtPath);
    }

    public async detail(id: string): Promise<WatchHistoryVO | null> {
        const record = await this.watchHistoryRepository.findById(id);
        if (!record) {
            return null;
        }

        const html5CandidatePath = this.html5VariantPathFromRecord(record);
        if (!this.isHtml5VariantFileName(record.file_name) && fs.existsSync(html5CandidatePath)) {
            await this.tryCreate(html5CandidatePath, record.project_type);
            const html5Record = await this.watchHistoryRepository.findOneByBasePathFileNameType(
                record.base_path,
                path.basename(html5CandidatePath),
                record.project_type,
            );
            if (html5Record) {
                const html5Vo = await this.buildVoFromFile(html5Record);
                if (html5Vo) {
                    return {
                        ...html5Vo,
                        displayFileName: record.file_name,
                        isFolder: record.project_type === WatchHistoryType.DIRECTORY
                    };
                }
            }
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

    private async createInner(files: string[]): Promise<string[]> {
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
            const preferredVideo = (() => {
                const parsed = path.parse(video);
                if (parsed.base.toLowerCase().endsWith('.html5.mp4')) {
                    return video;
                }
                const baseName = parsed.name.toLowerCase().endsWith('.html5')
                    ? parsed.name.slice(0, -'.html5'.length)
                    : parsed.name;
                const html5Path = path.join(parsed.dir, `${baseName}.html5.mp4`);
                return fs.existsSync(html5Path) ? html5Path : video;
            })();
            const sids = await this.tryCreate(preferredVideo);
            ids.push(...sids);
        }
        for (const id of ids) {
            await this.watchHistoryRepository.updateById(id, { updated_at: TimeUtil.timeUtc() });
        }
        return ids;
    }

    public async groupDelete(id: string): Promise<void> {
        const toDeleteIds: string[] = [];
        const record = await this.watchHistoryRepository.findById(id);
        if (!record) {
            return;
        }
        if (record.project_type === WatchHistoryType.DIRECTORY) {
            const records = await this.watchHistoryRepository.listByBasePathAndProjectTypeOrderedByFileName(
                record.base_path,
                WatchHistoryType.DIRECTORY,
            );
            toDeleteIds.push(...records.map(r => r.id));
        } else {
            toDeleteIds.push(record.id);
        }
        await Promise.all(toDeleteIds.map(id => this.deleteById(id)));
        const libraryPath = this.locationService.getDetailLibraryPath(LocationType.VIDEOS);
        await FileUtil.cleanEmptyDirectories(libraryPath);
    }


    public async updateProgress(file: string, currentPosition: number): Promise<void> {
        file = this.preferHtml5VideoPath(file);
        const base_path = path.dirname(file);
        const file_name = path.basename(file);
        await this.watchHistoryRepository.updateByBasePathFileName(base_path, file_name, {
            current_position: currentPosition,
            updated_at: TimeUtil.timeUtc(),
        });
    }

    private async buildVoFromFolder(folder: string): Promise<WatchHistoryVO | null> {
        const folderVideos: WatchHistory[] = await this.watchHistoryRepository.listByBasePathAndProjectTypeOrderedByUpdatedAtDesc(
            folder,
            WatchHistoryType.DIRECTORY,
        );
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
        const fullPaths = files
            .filter(file => MediaUtil.isSubtitle(file))
            .map(file => path.join(folder, file));
        const srt: string[] = [];
        const vtt: string[] = [];
        for (const p of fullPaths) {
            if (MediaUtil.isSrt(p)) {
                srt.push(p);
            } else {
                vtt.push(p);
            }
        }
        return [...srt, ...vtt];
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
        const records: WatchHistory[] = await this.watchHistoryRepository.findByBasePathFileNameType(folder, name, type);
        if (CollUtil.isEmpty(records)) {
            const record = await this.watchHistoryRepository.insert({
                id: this.mapId(folder, name, type),
                base_path: folder,
                file_name: name,
                project_type: type,
                current_position: 0
            });
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
    private async attachSrtInner(videoPath: string, srtPath: string) {
        videoPath = this.preferHtml5VideoPath(videoPath);
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

        const records: WatchHistory[] = await this.watchHistoryRepository.findByBasePathFileName(folder, video);

        const needsUpdate = records.some((record) => record.srt_file !== srtPath);
        if (needsUpdate) {
            await this.watchHistoryRepository.updateByBasePathFileName(folder, video, {
                srt_file: srtPath,
                updated_at: TimeUtil.timeUtc(),
            });
        }
    }

    async suggestSrt(file: string): Promise<string[]> {
        file = this.preferHtml5VideoPath(file);
        const folder = path.dirname(file);
        const files = await FileUtil.listFiles(folder);
        const srtInFolder = files.filter(file => MediaUtil.isSubtitle(file))
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
        const files = await this.watchHistoryRepository.listDistinctBasePathFileName();

        const deletedFiles = files.filter(file => !fs.existsSync(path.join(file.base_path, file.file_name)));

        for (const { base_path, file_name } of deletedFiles) {
            await this.watchHistoryRepository.deleteByBasePathFileName(base_path, file_name);
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
        const record = await this.watchHistoryRepository.findById(id);
        if (!record) {
            return;
        }
        // 如果是 libraryPath 或子文件夹下的文件
        // 删除文件
        const filePath = path.join(record.base_path, record.file_name);
        if (filePath.startsWith(libraryPath)) {
            await FileUtil.deleteFile(filePath);
            this.rendererGateway.fireAndForget('ui/show-toast', {
                message: '该文件位于视频库中，已为您删除原文件',
                variant: 'info',
            });
        }
        await this.watchHistoryRepository.deleteById(id);
        // 删除字幕文件
        if (record.srt_file && record.srt_file.startsWith(libraryPath)) {
            const srtExists = await this.watchHistoryRepository.findBySrtFile(record.srt_file);
            if (CollUtil.isEmpty(srtExists)) {
                await FileUtil.deleteFile(record.srt_file);
            }
        }
    }

    public async getNextVideo(currentId: string): Promise<WatchHistoryVO | null> {
        const currentRecord = await this.watchHistoryRepository.findById(currentId);

        if (!currentRecord) {
            return null;
        }

        const folderVideos = await this.watchHistoryRepository.listByBasePathAndProjectTypeOrderedByFileName(
            currentRecord.base_path,
            WatchHistoryType.DIRECTORY,
        );

        if (CollUtil.isEmpty(folderVideos)) {
            return null;
        }

        const orderedGroupKeys: string[] = [];
        const seenKeys = new Set<string>();
        for (const record of folderVideos) {
            const key = this.normalizeHtml5GroupKey(record.base_path, record.file_name);
            if (seenKeys.has(key)) {
                continue;
            }
            seenKeys.add(key);
            orderedGroupKeys.push(key);
        }
        const currentKey = this.normalizeHtml5GroupKey(currentRecord.base_path, currentRecord.file_name);
        const currentIndex = orderedGroupKeys.indexOf(currentKey);

        if (currentIndex >= 0 && currentIndex < orderedGroupKeys.length - 1) {
            const nextKey = orderedGroupKeys[currentIndex + 1];
            const group = folderVideos.filter((r) => this.normalizeHtml5GroupKey(r.base_path, r.file_name) === nextKey);
            const primary =
                group.find((r) => this.isHtml5VariantFileName(r.file_name)) ??
                group[0];
            if (!primary) {
                return null;
            }
            if (!this.isHtml5VariantFileName(primary.file_name)) {
                const html5Path = this.html5VariantPathFromRecord(primary);
                if (fs.existsSync(html5Path)) {
                    await this.tryCreate(html5Path, WatchHistoryType.DIRECTORY);
                    const html5Record = await this.watchHistoryRepository.findOneByBasePathFileNameType(
                        primary.base_path,
                        path.basename(html5Path),
                        WatchHistoryType.DIRECTORY,
                    );
                    if (html5Record) {
                        return await this.buildVoFromFile(html5Record);
                    }
                }
            }
            return await this.buildVoFromFile(primary);
        }

        return null;
    }
}
