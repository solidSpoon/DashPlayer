// import registerRoute from '@/common/api/register';
// import WatchProjectService from '@/backend/services/WatchProjectService';
// import { WatchProjectVideo } from '@/backend/db/tables/watchProjectVideos';
// import path from 'path';
// import { inject, injectable } from 'inversify';
// import TYPES from '@/backend/ioc/types';
// import Controller from '@/backend/interfaces/controller';
// import { WatchProjectListVO, WatchProjectVO } from '@/common/types/watch-project';
// import WatchHistoryService from '@/backend/services/WatchHistoryService';
//
// @injectable()
// export default class WatchHistoryController implements Controller {
//     @inject(TYPES.WatchHistoryService) private watchHistoryService!: WatchHistoryService;
//
//     public async updateProgress({ file, duration }: {
//         file: string, duration: number
//     }): Promise<void> {
//         return this.watchHistoryService.updateProgress(file, duration);
//     }
//
//     public async videoDetail(videoId: number): Promise<WatchProjectVideo | undefined> {
//         return this.watchHistoryService.videoDetail(videoId);
//     }
//
//     public async videoDetailByPid(projId: number): Promise<WatchProjectVideo> {
//         return await this.watchProjectService.videoDetailByPid(projId);
//     }
//
//     public async createFromFolder(path: string): Promise<number> {
//         return this.watchHistoryService.addMedia(path);
//     }
//
//     public async create(files: string[]): Promise<number> {
//         return this.watchHistoryService.addMedia(files);
//     }
//
//     public async analyseFolder(path: string): Promise<{ supported: number, unsupported: number }> {
//         return this.watchProjectService.analyseFolder(path);
//     }
//
//     public async attachSrt({ videoPath, srtPath }: { videoPath: string, srtPath: string | 'same' }): Promise<void> {
//         if (srtPath === 'same') {
//             srtPath = path.join(path.dirname(videoPath), path.basename(videoPath, path.extname(videoPath)) + '.srt');
//         }
//         await this.watchProjectService.attachSrt(videoPath, srtPath);
//     }
//
//     public async delete(filePath:string): Promise<void> {
//         // return this.watchProjectService.delete(id);
//     }
//
//     public async detail(id: number): Promise<WatchProjectVO> {
//         return this.watchProjectService.detail(id);
//     }
//
//     public async list(): Promise<WatchProjectListVO[]> {
//         return this.watchProjectService.list();
//     }
//
//     registerRoutes(): void {
//         registerRoute('watch-project/progress/update', (p) => this.updateProgress(p));
//         registerRoute('watch-project/video/play', (p) => this.play(p));
//         registerRoute('watch-project/video/detail', (p) => this.videoDetail(p));
//         registerRoute('watch-project/video/detail/by-pid', (p) => this.videoDetailByPid(p));
//         registerRoute('watch-project/create/from-folder', (p) => this.createFromFolder(p));
//         registerRoute('watch-project/create/from-files', (p) => this.createFromFiles(p));
//         registerRoute('watch-project/analyse-folder', (p) => this.analyseFolder(p));
//         registerRoute('watch-project/create/from-download', (p) => this.tryCreateFromDownload(p));
//         registerRoute('watch-project/delete', (p) => this.delete(p));
//         registerRoute('watch-project/detail', (p) => this.detail(p));
//         registerRoute('watch-project/detail/by-vid', (p) => this.detailByVid(p));
//         registerRoute('watch-project/list', (p) => this.list());
//         registerRoute('watch-project/attach-srt', (p) => this.attachSrt(p));
//     }
// }
