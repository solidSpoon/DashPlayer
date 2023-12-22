import { dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { eq, desc, inArray, and, not } from 'drizzle-orm';
import {
    InsertWatchProject,
    WatchProject,
    watchProjects,
    WatchProjectType,
} from '../tables/watchProjects';
import {
    InsertWatchProjectVideo,
    WatchProjectVideo,
    watchProjectVideos,
} from '../tables/watchProjectVideos';
import {
    ACCEPTED_FILE_TYPES,
    isSubtitle,
    isVideo,
} from '../../common/utils/MediaTypeUitl';
import db from '../../db/db';

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

const selectFiles = async (): Promise<
    InsertWatchProjectVO | undefined | string
> => {
    // 多选
    const files = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
            {
                name: 'Movies',
                extensions: ACCEPTED_FILE_TYPES.split(',').map((item) =>
                    item.substring(1)
                ),
            },
        ],
    });
    const videoFilesList = files.filePaths.filter((fileName) =>
        isVideo(fileName)
    );
    const subtitleFilesList = files.filePaths.filter((fileName) =>
        isSubtitle(fileName)
    );
    if (videoFilesList.length === 0) {
        if (subtitleFilesList.length > 0) {
            return subtitleFilesList[0];
        }
        return undefined;
    }
    const videoFile = videoFilesList[0];
    console.log('selectFiles', subtitleFilesList, videoFile);
    const res: InsertWatchProjectVO = {
        project_name: path
            .basename(videoFile)
            .substring(0, videoFile.lastIndexOf('.')),
        type: WatchProjectType.FILE,
        project_key: videoFile,
        project_path: path.dirname(videoFile),
        videos: [],
    };
    const subtitleFile = findSubtitle(videoFile, subtitleFilesList);
    const videoName = path.basename(videoFile);
    res.videos.push({
        project_id: -1,
        video_name: videoName.substring(0, videoName.lastIndexOf('.')),
        video_path: videoFile,
        subtitle_path: subtitleFile ?? null,
        current_time: 0,
        current_playing: true,
        duration: 0,
    });
    console.log('selectFiles', res);
    return res;
};

function tryInitProject(filePath: string) {
    // 配置文件放到 ./.dp 目录下
    // { project_key: randomStr}
    const configPath = path.join(filePath, '.dp');
    if (!fs.existsSync(configPath)) {
        fs.mkdirSync(configPath);
    }
    const configFilePath = path.join(configPath, './config.json');
    if (!fs.existsSync(configFilePath)) {
        const randomStr = Math.random().toString(36).substring(2);
        fs.writeFileSync(
            configFilePath,
            JSON.stringify({ project_key: randomStr })
        );
    }
    const config = JSON.parse(fs.readFileSync(configFilePath).toString());
    return config.project_key;
}

function doSelectDirectory(filePath: string) {
    const projectKey = tryInitProject(filePath);
    const filesList = fs.readdirSync(filePath);
    const res: InsertWatchProjectVO = {
        project_name: path.basename(filePath),
        type: WatchProjectType.DIRECTORY,
        project_key: projectKey,
        project_path: filePath,
        videos: [],
    };

    const videoFilesList = filesList.filter((fileName) => isVideo(fileName));
    const subtitleFilesList = filesList.filter((fileName) =>
        isSubtitle(fileName)
    );
    console.log('selectDirectory', videoFilesList, subtitleFilesList);
    videoFilesList.forEach((fileName) => {
        const subtitleFile = findSubtitle(fileName, subtitleFilesList);
        res?.videos.push({
            project_id: -1,
            video_name: fileName.substring(0, fileName.lastIndexOf('.')),
            video_path: path.join(filePath, fileName),
            subtitle_path: subtitleFile
                ? path.join(filePath, subtitleFile)
                : undefined,
            current_time: 0,
            duration: 0,
        });
    });
    return res;
}

const selectDirectory = async (): Promise<InsertWatchProjectVO | undefined> => {
    const files = await dialog.showOpenDialog({
        properties: ['openDirectory'],
    });
    if (files.filePaths.length === 0) {
        return undefined;
    }
    const filePath = files.filePaths[0];
    const res = doSelectDirectory(filePath);
    console.log('selectDirectory', res);
    return res;
};

function mergeProject(
    base: WatchProjectVO | undefined,
    newProject: InsertWatchProjectVO
) {
    if (!base) {
        return newProject;
    }

    const oldVideoMapping = new Map<string, WatchProjectVideo>();
    base.videos.forEach((item) => {
        oldVideoMapping.set(item.video_name ?? '', item);
    });

    const newVideos = newProject.videos.map((item) => {
        const oldVideo = oldVideoMapping.get(item.video_name ?? '');
        if (oldVideo) {
            return {
                ...oldVideo,
                video_path: item.video_path ?? oldVideo.video_path,
                subtitle_path: item.subtitle_path ?? oldVideo.subtitle_path,
            };
        }
        return item;
    });
    const currentPlaying = newVideos.filter((item) => item.current_playing);
    console.log('currentPlaying', currentPlaying);
    if (currentPlaying.length === 0) {
        newVideos[0].current_playing = true;
    }
    return {
        ...base,
        project_path: newProject.project_path,
        videos: newVideos,
    };
}

export default class WatchProjectService {
    public static selectFiles = async (
        isDirectory: boolean
    ): Promise<WatchProjectVO | undefined | string> => {
        const select = isDirectory
            ? await selectDirectory()
            : await selectFiles();
        if (!select || typeof select === 'string') {
            console.log('selectFiles', select);
            return select;
        }
        console.log('selectFiles', select);
        const watchProject = await this.detail(select.project_key ?? '');
        const finalProject = mergeProject(watchProject, select);
        console.log('finalProject', finalProject);
        return this.tryReplace(finalProject);
    };

    /**
     * list
     */
    public static async listRecent(): Promise<WatchProjectVO[]> {
        let wps: WatchProject[] = await db
            .select()
            .from(watchProjects)
            .orderBy(desc(watchProjects.last_watch_time));
        wps = wps.filter((wp) => fs.existsSync(wp.project_path ?? ''));
        const wpIds = wps.map((wp) => wp.id);
        wpIds.push(-1);
        let wpvs: WatchProjectVideo[] = await db
            .select()
            .from(watchProjectVideos)
            .where(inArray(watchProjectVideos.project_id, wpIds));
        wpvs = wpvs.filter((wpv) => fs.existsSync(wpv.video_path ?? ''));
        const wpvMap = new Map<number, WatchProjectVideo[]>();
        wpvs.forEach((wpv) => {
            const wpvList = wpvMap.get(wpv.project_id ?? 0);
            if (wpvList) {
                wpvList.push(wpv);
            } else {
                wpvMap.set(wpv.project_id ?? 0, [wpv]);
            }
        });
        return wps
            .map((wp) => {
                const wpvList = wpvMap.get(wp.id ?? 0);
                return {
                    ...wp,
                    videos: wpvList ?? [],
                };
            })
            .filter((wp) => wp.videos.length > 0);
    }

    private static async detail(
        key: string
    ): Promise<WatchProjectVO | undefined> {
        const wps: WatchProject[] = await db
            .select()
            .from(watchProjects)
            .where(eq(watchProjects.project_key, key));
        if (wps.length === 0) {
            return undefined;
        }
        const wp = wps[0];
        const wpvs: WatchProjectVideo[] = await db
            .select()
            .from(watchProjectVideos)
            .where(eq(watchProjectVideos.project_id, wp.id));
        return {
            ...wp,
            videos: wpvs,
        };
    }

    private static async tryReplace(
        project: InsertWatchProjectVO
    ): Promise<WatchProjectVO> {
        const [upsertedProject] = await db
            .insert(watchProjects)
            .values(project)
            .onConflictDoUpdate({
                target: watchProjects.project_key,
                set: {
                    project_name: project.project_name,
                    type: project.type,
                    project_path: project.project_path,
                    updated_at: new Date().toISOString(),
                },
            })
            .returning();
        const videoPaths = project.videos.map((video) => video.video_path);
        videoPaths.push('-1');

        // eslint-disable-next-line no-restricted-syntax
        for (const video of project.videos) {
            // eslint-disable-next-line no-await-in-loop
            await db
                .insert(watchProjectVideos)
                .values({
                    ...video,
                    subtitle_path: video.subtitle_path ?? '',
                    id: undefined,
                    project_id: upsertedProject.id,
                })
                .onConflictDoUpdate({
                    target: [
                        watchProjectVideos.project_id,
                        watchProjectVideos.video_path,
                    ],
                    set: {
                        ...video,
                        subtitle_path: video.subtitle_path ?? '',
                        project_id: upsertedProject.id,
                    },
                });
        }
        await db
            .delete(watchProjectVideos)
            .where(
                and(
                    eq(watchProjectVideos.project_id, upsertedProject.id),
                    not(inArray(watchProjectVideos.video_path, videoPaths))
                )
            );
        const updatedProject = await this.detail(
            upsertedProject?.project_key ?? ''
        );
        if (!updatedProject) {
            throw new Error('Failed to fetch the updated project');
        }
        return updatedProject;
    }

    static queryVideoProgress = async (
        id: number
    ): Promise<WatchProjectVideo> => {
        const res: WatchProjectVideo[] = await db
            .select()
            .from(watchProjectVideos)
            .where(eq(watchProjectVideos.id, id));
        if (res.length === 0) {
            throw new Error('not found');
        }
        return res[0];
    };

    static updateVideoProgress = async (video: WatchProjectVideo) => {
        await db
            .update(watchProjectVideos)
            .set({
                current_playing: false,
                updated_at: new Date().toISOString(),
            })
            .where(eq(watchProjectVideos.project_id, video.project_id));
        await db
            .update(watchProjectVideos)
            .set({
                current_time: video.current_time,
                duration: video.duration,
                subtitle_path: video.subtitle_path,
                current_playing: true,
                updated_at: new Date().toISOString(),
            })
            .where(eq(watchProjectVideos.id, video.id));

        await db
            .update(watchProjects)
            .set({
                last_watch_time: new Date().toISOString(),
            })
            .where(eq(watchProjects.id, video.project_id));
    };

    public static reloadRecentFromDisk = async (): Promise<
        WatchProjectVO[]
    > => {
        const recent = await this.listRecent();
        // eslint-disable-next-line no-restricted-syntax
        for (const item of recent) {
            // 如果项目路径存在，就刷新一下
            if (
                item.type === WatchProjectType.DIRECTORY &&
                fs.existsSync(item?.project_path ?? '')
            ) {
                const newProject = doSelectDirectory(item.project_path ?? '');
                if (newProject) {
                    const finalProject = mergeProject(item, newProject);
                    console.log('finalProject', finalProject);
                    // eslint-disable-next-line no-await-in-loop
                    await this.tryReplace(finalProject);
                }
            }
        }
        return this.listRecent();
    };

    static async getVideo(
        videoId: number
    ): Promise<WatchProjectVideo | undefined> {
        const res: WatchProjectVideo[] = await db
            .select()
            .from(watchProjectVideos)
            .where(eq(watchProjectVideos.id, videoId));
        if (res.length === 0) {
            return undefined;
        }
        return res[0];
    }
}
