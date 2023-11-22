import { dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { knexDb } from './BaseService';
import {
    WATCH_PROJECT_TABLE_NAME,
    WatchProject,
    WatchProjectType,
} from '../entity/WatchProject';
import {
    WATCH_PROJECT_VIDEO_TABLE_NAME,
    WatchProjectVideo,
} from '../entity/WatchProjectVideo';
import {
    ACCEPTED_FILE_TYPES,
    isSubtitle,
    isVideo,
} from '../../utils/MediaTypeUitl';

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
                ),
            },
        ],
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
        current_video_id: 0,
        videos: [],
    };
    const subtitleFile = findSubtitle(videoFile, subtitleFilesList);
    const videoName = path.basename(videoFile);
    res.videos.push({
        video_name: videoName.substring(0, videoName.lastIndexOf('.')),
        video_path: videoFile,
        subtitle_path: subtitleFile || undefined,
        current_time: 0,
        duration: 0,
    });
    console.log('selectFiles', res);
    return res;
};
const selectDirectory = async (): Promise<WatchProjectVO | undefined> => {
    const files = await dialog.showOpenDialog({
        properties: ['openDirectory'],
    });
    let res: WatchProjectVO | undefined;
    if (files.filePaths.length === 0) {
        return res;
    }
    const filePath = files.filePaths[0];
    const filesList = fs.readdirSync(filePath);
    res = {
        project_name: path.basename(filePath),
        type: WatchProjectType.DIRECTORY,
        project_key: filePath,
        project_path: filePath,
        current_video_id: 0,
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
            video_name: fileName.substring(0, fileName.lastIndexOf('.')),
            video_path: path.join(filePath, fileName),
            subtitle_path: subtitleFile
                ? path.join(filePath, subtitleFile)
                : undefined,
            current_time: 0,
            duration: 0,
        });
    });
    console.log('selectDirectory', res);
    return res;
};

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
        const watchProject = await WatchProjectService.tryCreate(select);
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
                videos: wpvList ?? [],
            };
        });
    }

    private static async tryCreate(
        select: WatchProjectVO
    ): Promise<WatchProjectVO> {
        const watchProject = await knexDb<WatchProject>(
            WATCH_PROJECT_TABLE_NAME
        )
            .select('*')
            .where('project_key', select.project_key)
            .first();
        if (watchProject) {
            const watchProjectVideos = await knexDb<WatchProjectVideo>(
                WATCH_PROJECT_VIDEO_TABLE_NAME
            )
                .select('*')
                .where('project_id', watchProject.id);
            return {
                ...watchProject,
                videos: watchProjectVideos,
            };
        }
        const insertWatchProject = await knexDb<WatchProject>(
            WATCH_PROJECT_TABLE_NAME
        )
            .insert({
                project_name: select.project_name,
                type: select.type,
                project_key: select.project_key,
                project_path: select.project_path,
                current_video_id: select.current_video_id,
            })
            .returning('*');
        const watchProjectVideos = await knexDb<WatchProjectVideo>(
            WATCH_PROJECT_VIDEO_TABLE_NAME
        )
            .insert(
                select.videos.map((item) => {
                    return {
                        project_id: insertWatchProject[0].id,
                        video_name: item.video_name,
                        video_path: item.video_path,
                        subtitle_path: item.subtitle_path,
                        current_time: item.current_time,
                        duration: item.duration,
                    };
                })
            )
            .returning('*');
        await knexDb<WatchProject>(WATCH_PROJECT_TABLE_NAME)
            .update({
                current_video_id: watchProjectVideos[0].id,
            })
            .where('id', insertWatchProject[0].id);
        return {
            ...insertWatchProject[0],
            videos: watchProjectVideos,
        };
    }
}
