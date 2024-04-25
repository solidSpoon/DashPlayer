import { and, desc, eq } from 'drizzle-orm';
import { InsertWatchProject, WatchProject, watchProjects, WatchProjectType } from '@/backend/db/tables/watchProjects';
import { InsertWatchProjectVideo, WatchProjectVideo, watchProjectVideos } from '@/backend/db/tables/watchProjectVideos';
import db from '@/backend/db/db';
import fs from 'fs';
import { isSrt, isMedia } from '@/common/utils/MediaTypeUtil';
import path from 'path';

export interface WatchProjectVO extends WatchProject {
    videos: WatchProjectVideo[];
}

export interface InsertWatchProjectVO extends InsertWatchProject {
    videos: InsertWatchProjectVideo[];
}

const findSubtitle = (
    videoName: string,
    subtitleFilesList: string[]
): string | undefined => {
    const subtitleFile = subtitleFilesList.find((subtitleFileName) =>
        subtitleFileName.startsWith(videoName)
    );
    if (subtitleFile) {
        return subtitleFile;
    }
    const videoNameWithoutExt = videoName.substring(
        0,
        videoName.lastIndexOf('.')
    );
    return subtitleFilesList.find((subtitleFileName) =>
        subtitleFileName.startsWith(videoNameWithoutExt)
    );
};

export default class WatchProjectNewService {
    public static async list(): Promise<WatchProject[]> {
        const res: WatchProject[] = await db.select()
            .from(watchProjects)
            .orderBy(desc(watchProjects.updated_at));
        res.forEach((p) => {
            if (!fs.existsSync(p.project_path)) {
                this.delete(p.id);
            }
        });
        return db.select()
            .from(watchProjects)
            .orderBy(desc(watchProjects.updated_at));

    }

    public static async detail(id: number): Promise<WatchProjectVO> {
        const [project]: WatchProject[] = await db.select()
            .from(watchProjects)
            .where(eq(watchProjects.id, id));
        if (!project) {
            throw new Error('Project not found');
        }
        let videos: WatchProjectVideo[] = await db.select()
            .from(watchProjectVideos)
            .where(eq(watchProjectVideos.project_id, id))
            .orderBy(desc(watchProjectVideos.updated_at));
        await Promise.all(videos.map(async (v) => {
            if (!fs.existsSync(v.video_path)) {
                await db.delete(watchProjectVideos)
                    .where(eq(watchProjectVideos.id, v.id));
            }
        }));
        videos = await db.select()
            .from(watchProjectVideos)
            .where(eq(watchProjectVideos.project_id, id))
            .orderBy(desc(watchProjectVideos.updated_at));
        return { ...project, videos };
    }

    public static async delete(id: number): Promise<void> {
        await db.delete(watchProjects)
            .where(eq(watchProjects.id, id));
        await db.delete(watchProjectVideos)
            .where(eq(watchProjectVideos.project_id, id));
    }

    public static async createFromFiles(filePath: string[]): Promise<number> {
        const [videoPath] = filePath.filter((p) => isMedia(p));
        if (!videoPath) {
            throw new Error('Invalid file type');
        }
        const vp: InsertWatchProject = {
            project_name: path
                .basename(videoPath)
                .substring(0, videoPath.lastIndexOf('.')),
            project_type: WatchProjectType.FILE,
            project_path: videoPath
        };

        const [vpr]: WatchProject[] = await db.insert(watchProjects)
            .values([vp])
            .onConflictDoUpdate({
                target: watchProjects.project_path,
                set: {
                    project_name: vp.project_name,
                    project_type: vp.project_type,
                    updated_at: new Date().toISOString()
                }
            })
            .returning();

        const [srt] = filePath.filter((p) => isSrt(p));

        const v: InsertWatchProjectVideo = {
            project_id: vpr.id,
            video_name: path.basename(videoPath),
            video_path: videoPath,
            subtitle_path: srt,
            current_playing: false,
            current_time: 0,
            duration: 0
        };
        await db.insert(watchProjectVideos)
            .values([v])
            .onConflictDoUpdate({
                target: [watchProjectVideos.project_id, watchProjectVideos.video_path],
                set: {
                    ...v,
                    id: undefined,
                    project_id: vpr.id,
                    updated_at: new Date().toISOString()
                }
            })
            .returning();

        return vpr.id;
    }

    public static async createFromDirectory(dirPath: string): Promise<number> {
        const vp: InsertWatchProject = {
            project_name: path.basename(dirPath),
            project_type: WatchProjectType.DIRECTORY,
            project_path: dirPath
        };
        const [vpr]: WatchProject[] = await db.insert(watchProjects)
            .values([vp])
            .onConflictDoUpdate({
                target: watchProjects.project_path,
                set: {
                    project_name: vp.project_name,
                    project_type: vp.project_type,
                    updated_at: new Date().toISOString()
                }
            })
            .returning();

        const files = fs.readdirSync(dirPath);
        const videos = files.filter((f) => isMedia(f));
        const srts = files.filter((f) => isSrt(f));
        const videoPaths = videos.map((v) => path.join(dirPath, v));
        const srtPaths = srts.map((s) => path.join(dirPath, s));
        const videoInserts: InsertWatchProjectVideo[] = videoPaths.map((vp, idx) => {
            return {
                project_id: vpr.id,
                video_name: path.basename(vp),
                video_path: vp,
                subtitle_path: findSubtitle(vp, srtPaths),
                current_playing: false,
                current_time: 0,
                duration: 0
            };
        });
        await Promise.all(videoInserts.map(async (v) => {
            await db.insert(watchProjectVideos)
                .values([v])
                .onConflictDoUpdate({
                    target: [watchProjectVideos.project_id, watchProjectVideos.video_path],
                    set: {
                        ...v,
                        id: undefined,
                        project_id: vpr.id,
                        updated_at: new Date().toISOString()
                    }
                });
        }));
        return vpr.id;
    }

    public static async attachSrt(videoPath: string, srtPath: string) {
        await db.update(watchProjectVideos)
            .set({ subtitle_path: srtPath, updated_at: new Date().toISOString() })
            .where(eq(watchProjectVideos.video_path, videoPath));
    }

    static async updateProgress(videoId: number, currentTime: number, duration: number) {
        const [video]: WatchProjectVideo[] = await db.update(watchProjectVideos)
            .set({
                current_time: currentTime,
                duration: duration,
                current_playing: true,
                updated_at: new Date().toISOString()
            })
            .where(eq(watchProjectVideos.id, videoId))
            .returning();
        await db.update(watchProjects)
            .set({ updated_at: new Date().toISOString() })
            .where(eq(watchProjects.id, video.project_id));
    }

    public static async play(videoId: number): Promise<void> {
        const [video]: WatchProjectVideo[] = await db.select()
            .from(watchProjectVideos)
            .where(eq(watchProjectVideos.id, videoId));
        await db.update(watchProjectVideos)
            .set({ current_playing: false })
            .where(eq(watchProjectVideos.current_playing, true));
        await db.update(watchProjectVideos)
            .set({ current_playing: true })
            .where(eq(watchProjectVideos.id, videoId));
        await db.update(watchProjects)
            .set({
                current_playing: false
            });
        await db.update(watchProjects)
            .set({
                current_playing: true
            })
            .where(eq(watchProjects.id, video.project_id));

    }

    static async videoDetail(videoId: number): Promise<WatchProjectVideo | undefined> {
        return (await db.select()
            .from(watchProjectVideos)
            .where(eq(watchProjectVideos.id, videoId)))[0];
    }

    static async videoDetailByPid(projId: number) {
        const v = (await db.select()
            .from(watchProjectVideos)
            .where(and(eq(watchProjectVideos.project_id, projId), eq(watchProjectVideos.current_playing, true))))[0];
        if (!v) {
            return (await db.select()
                .from(watchProjectVideos)
                .where(eq(watchProjectVideos.project_id, projId)))[0];
        }
        return v;
    }

    static async detailByVid(vid: number) {
        const [video]: WatchProjectVideo[] = await db.select()
            .from(watchProjectVideos)
            .where(eq(watchProjectVideos.id, vid));
        return this.detail(video.project_id);
    }
}
