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

const selectFiles = async (): Promise<WatchProjectVO | undefined | string> => {
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

function doSelectDirectory(filePath: string) {
    const projectKey = tryInitProject(filePath);
    const filesList = fs.readdirSync(filePath);
    const res: WatchProjectVO = {
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
    return res;
}

const selectDirectory = async (): Promise<WatchProjectVO | undefined> => {
    const files = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    if (files.filePaths.length === 0) {
        return undefined;
    }
    const filePath = files.filePaths[0];
    const res = doSelectDirectory(filePath);
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
    console.log('currentPlaying', currentPlaying);
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
        console.log('listRecent');
        let watchProjects = await knexDb<WatchProject>(
            WATCH_PROJECT_TABLE_NAME
        )
            .select('*')
            .orderBy('last_watch_time', 'desc')
            .limit(50);
        watchProjects = watchProjects.filter((wp) => fs.existsSync(wp.project_path ?? ''));

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

    private static async detail(key: string): Promise<WatchProjectVO | undefined> {
        const watchProject = await knexDb<WatchProject>(
            WATCH_PROJECT_TABLE_NAME
        )
            .select('*')
            .where('project_key', key)
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
        // Upsert the project
        const [upsertedProject] = await knexDb<WatchProject>(WATCH_PROJECT_TABLE_NAME)
            .insert({
                project_name: project.project_name,
                type: project.type,
                project_key: project.project_key,
                project_path: project.project_path
            })
            .onConflict('project_key')
            .merge()
            .returning('*');

        // Upsert the videos
        const videoPaths = project.videos.map(video => video.video_path);
        for (const video of project.videos) {
            await knexDb<WatchProjectVideo>(WATCH_PROJECT_VIDEO_TABLE_NAME)
                .insert({
                    ...video,
                    subtitle_path: video.subtitle_path ?? '',
                    id: undefined,
                    project_id: upsertedProject.id
                })
                .onConflict(['project_id', 'video_path'])
                .merge();
        }

        // Delete videos that are not in the new list
        await knexDb<WatchProjectVideo>(WATCH_PROJECT_VIDEO_TABLE_NAME)
            .where('project_id', upsertedProject.id)
            .andWhere('video_path', 'not in', videoPaths)
            .del();

        // Fetch the updated project with videos
        const updatedProject = await this.detail(upsertedProject?.project_key ?? '');

        if (!updatedProject) {
            throw new Error('Failed to fetch the updated project');
        }

        return updatedProject;
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
                current_playing: 0
            })
            .where('project_id', video.project_id);

        await knexDb<WatchProjectVideo>(WATCH_PROJECT_VIDEO_TABLE_NAME)
            .update({
                current_time: video.current_time,
                duration: video.duration,
                subtitle_path: video.subtitle_path,
                current_playing: 1
            })
            .where('id', video.id);
        // 更新主表更新时间
        await knexDb<WatchProject>(WATCH_PROJECT_TABLE_NAME)
            .update({
                last_watch_time: Date.now()
            })
            .where('id', video.project_id);
    };
    public static reloadRecentFromDisk = async (): Promise<WatchProjectVO[]> => {
        const recent = await this.listRecent();
        for (const item of recent) {
            // 如果项目路径存在，就刷新一下
            if (item.type === WatchProjectType.DIRECTORY && fs.existsSync(item?.project_path ?? '')) {
                const newProject = doSelectDirectory(item.project_path ?? '');
                if (newProject) {
                    let finalProject = mergeProject(item, newProject);
                    console.log('finalProject', finalProject);
                    await this.tryReplace(finalProject);
                }
            }
        }
        return await this.listRecent();
    };
}
