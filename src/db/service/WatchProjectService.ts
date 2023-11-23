import { dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { knexDb } from './BaseService';
import { WATCH_PROJECT_TABLE_NAME, WatchProject, WatchProjectType } from '../entity/WatchProject';
import { WATCH_PROJECT_VIDEO_TABLE_NAME, WatchProjectVideo } from '../entity/WatchProjectVideo';
import { ACCEPTED_FILE_TYPES, isSubtitle, isVideo } from '../../utils/MediaTypeUitl';

export interface WatchProjectVO extends WatchProject {
    videos: WatchProjectVideo[];
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

const selectFiles = async (): Promise<WatchProjectVO | undefined> => {
    // 多选
    const files = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
            {
                name: 'Movies',
                extensions: ACCEPTED_FILE_TYPES.split(',').map((item) =>
                    item.substring(1)
                )
            }
        ]
    });
    const videoFilesList = files.filePaths.filter((fileName) =>
        isVideo(fileName)
    );
    if (videoFilesList.length === 0) {
        return undefined;
    }
    const subtitleFilesList = files.filePaths.filter((fileName) =>
        isSubtitle(fileName)
    );
    const videoFile = videoFilesList[0];
    console.log('selectFiles', subtitleFilesList, videoFile);
    const res: WatchProjectVO = {
        project_name: path
            .basename(videoFile)
            .substring(0, videoFile.lastIndexOf('.')),
        type: WatchProjectType.FILE,
        project_key: videoFile,
        project_path: path.dirname(videoFile),
        videos: []
    };
    const subtitleFile = findSubtitle(videoFile, subtitleFilesList);
    const videoName = path.basename(videoFile);
    res.videos.push({
        video_name: videoName.substring(0, videoName.lastIndexOf('.')),
        video_path: videoFile,
        subtitle_path: subtitleFile || undefined,
        current_time: 0,
        duration: 0
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
        fs.writeFileSync(configFilePath, JSON.stringify({ project_key: randomStr }));
    }
    const config = JSON.parse(fs.readFileSync(configFilePath).toString());
    return config.project_key;
}

const selectDirectory = async (): Promise<WatchProjectVO | undefined> => {
    const files = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    let res: WatchProjectVO | undefined;
    if (files.filePaths.length === 0) {
        return res;
    }
    const filePath = files.filePaths[0];
    const projectKey = tryInitProject(filePath);
    const filesList = fs.readdirSync(filePath);
    res = {
        project_name: path.basename(filePath),
        type: WatchProjectType.DIRECTORY,
        project_key: projectKey,
        project_path: filePath,
        videos: []
    };

    const videoFilesList = filesList.filter((fileName) => isVideo(fileName));
    const subtitleFilesList = filesList.filter((fileName) =>
        isSubtitle(fileName)
    );
    console.log('selectDirectory', videoFilesList, subtitleFilesList);
    videoFilesList.forEach((fileName) => {
        const subtitleFile = findSubtitle(fileName, subtitleFilesList);
        res?.videos.push({
            video_name: fileName.substring(0, fileName.lastIndexOf('.')),
            video_path: path.join(filePath, fileName),
            subtitle_path: subtitleFile
                ? path.join(filePath, subtitleFile)
                : undefined,
            current_time: 0,
            duration: 0
        });
    });
    console.log('selectDirectory', res);
    return res;
};

function mergeProject(base: WatchProjectVO | undefined, newProject: WatchProjectVO) {
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
                subtitle_path: item.subtitle_path ?? oldVideo.subtitle_path
            };
        }
        return item;
    });
    const currentPlaying = newVideos.filter((item) => item.current_playing);
    if (currentPlaying.length === 0) {
        newVideos[0].current_playing = 1;
    }
    return {
        ...base,
        project_path: newProject.project_path,
        videos: newVideos
    };

}

export default class WatchProjectService {
    public static selectFiles = async (
        isDirectory: boolean
    ): Promise<WatchProjectVO | undefined> => {
        const select = isDirectory
            ? await selectDirectory()
            : await selectFiles();
        if (!select) {
            return undefined;
        }
        console.log('selectFiles', select);
        const watchProject = await this.detail(select.id ?? 0);
        const finalProject = mergeProject(watchProject, select);
        return this.tryReplace(finalProject);
    };

    /**
     * list
     */
    public static async listRecent(): Promise<WatchProjectVO[]> {
        console.log('listRecent');
        const watchProjects = await knexDb<WatchProject>(
            WATCH_PROJECT_TABLE_NAME
        )
            .select('*')
            .orderBy('updated_at', 'desc')
            .limit(50);
        const watchProjectIds = watchProjects.map((wp) => wp.id);
        const watchProjectVideos = await knexDb<WatchProjectVideo>(
            WATCH_PROJECT_VIDEO_TABLE_NAME
        )
            .select('*')
            .whereIn('project_id', watchProjectIds);
        const watchProjectVideoMap = new Map<number, WatchProjectVideo[]>();
        watchProjectVideos.forEach((wpv) => {
            const wpvList = watchProjectVideoMap.get(wpv.project_id ?? 0);
            if (wpvList) {
                wpvList.push(wpv);
            } else {
                watchProjectVideoMap.set(wpv.project_id ?? 0, [wpv]);
            }
        });
        return watchProjects.map((wp) => {
            const wpvList = watchProjectVideoMap.get(wp.id ?? 0);
            return {
                ...wp,
                videos: wpvList ?? []
            };
        });
    }

    private static async detail(id: number): Promise<WatchProjectVO | undefined> {
        const watchProject = await knexDb<WatchProject>(
            WATCH_PROJECT_TABLE_NAME
        )
            .select('*')
            .where('id', id)
            .first();
        if (watchProject) {
            const watchProjectVideos = await knexDb<WatchProjectVideo>(
                WATCH_PROJECT_VIDEO_TABLE_NAME
            )
                .select('*')
                .where('project_id', watchProject.id);
            return {
                ...watchProject,
                videos: watchProjectVideos
            };
        }
        return undefined;
    }

    private static async tryReplace(
        project: WatchProjectVO
    ): Promise<WatchProjectVO> {
        const oldWatchProject = await knexDb<WatchProject>(
            WATCH_PROJECT_TABLE_NAME
        )
            .select('*')
            .where('project_key', project.project_key)
            .first();
        if (oldWatchProject) {
            await knexDb<WatchProjectVideo>(WATCH_PROJECT_VIDEO_TABLE_NAME)
                .delete()
                .where('project_id', oldWatchProject.id);
            await knexDb<WatchProject>(WATCH_PROJECT_TABLE_NAME)
                .delete()
                .where('id', oldWatchProject.id);
        }
        //create new
        const insertWatchProject = await knexDb<WatchProject>(
            WATCH_PROJECT_TABLE_NAME
        )
            .insert({
                project_name: project.project_name,
                type: project.type,
                project_key: project.project_key,
                project_path: project.project_path,
                id: undefined
            })
            .returning('*');
        const watchProjectVideos = await knexDb<WatchProjectVideo>(
            WATCH_PROJECT_VIDEO_TABLE_NAME
        )
            .insert(
                project.videos.map((item) => {
                    return {
                        ...item,
                        id: undefined,
                        project_id: insertWatchProject[0].id
                    };
                })
            )
            .returning('*');
        return {
            ...insertWatchProject[0],
            videos: watchProjectVideos
        };
    }

    static queryVideoProgress = async (id: number): Promise<WatchProjectVideo> => {
        let result = knexDb<WatchProjectVideo>(WATCH_PROJECT_VIDEO_TABLE_NAME)
            .select('*')
            .where('id', id)
            .first();
        if (result === undefined) {
            throw new Error('not found');
        }
        return result as WatchProjectVideo;
    };

    static updateVideoProgress = async (video: WatchProjectVideo) => {
        // current_playing = false
        await knexDb<WatchProjectVideo>(WATCH_PROJECT_VIDEO_TABLE_NAME)
            .update({
                current_playing: 0,
            })
            .where('project_id', video.project_id);

        await knexDb<WatchProjectVideo>(WATCH_PROJECT_VIDEO_TABLE_NAME)
            .update({
                current_time: video.current_time,
                duration: video.duration,
                current_playing: 1,
            })
            .where('id', video.id);
        // 更新主表更新时间
        await knexDb<WatchProject>(WATCH_PROJECT_TABLE_NAME)
            .update({
                updated_at: new Date().toISOString()
            })
            .where('id', video.project_id);
    };
}
