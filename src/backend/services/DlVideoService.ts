import {spawn} from 'child_process';
import DpTaskService from '@/backend/services/DpTaskService';
import {DpTaskState} from '@/backend/db/tables/dpTask';
import LocationService from '@/backend/services/LocationService';
import {DlProgress} from "@/common/types/dl-progress";


export default class DlVideoService {
    public static async dlVideo(taskId: number, url: string, savePath: string) {
        const result: {
            ref: DlProgress
            so: string[]
        } = {
            ref: {
                name: '',
                progress: 0,
                stdOut: ''
            },
            so: []
        }
        result.so.push(`System: downloading video from ${url}`);
        result.ref.stdOut = result.so.join('\n');
        DpTaskService.update({
            id: taskId,
            status: DpTaskState.IN_PROGRESS,
            progress: '正在下载',
            result: JSON.stringify(result.ref)
        });
        try {
            await DlVideoService.doDlVideoFileName(taskId, result, url)
                .then((name) => {
                    result.ref.name = name;
                    return name;
                });
            await DlVideoService.doDlVideo(taskId, result, url, savePath);
        } catch (e) {
            DpTaskService.update({
                id: taskId,
                status: DpTaskState.FAILED,
                progress: '下载失败',
                result: JSON.stringify(result.ref)
            });
            return;
        }
        DpTaskService.update({
            id: taskId,
            status: DpTaskState.DONE,
            progress: '下载完成',
            result: JSON.stringify(result.ref)
        });
    }

    public static async doDlVideo(taskId: number, result: {
        ref: DlProgress,
        so: string[]
    }, url: string, savePath: string) {
        result.so.push('System: downloading video');
        result.ref.stdOut = result.so.join('\n');
        DpTaskService.update({
            id: taskId,
            status: DpTaskState.IN_PROGRESS,
            progress: '正在下载',
            result: JSON.stringify(result.ref)
        });
        return new Promise<void>((resolve, reject) => {
            //yt-dlp -f "bestvideo[height<=1080][height>=?720]" --merge-output-format mp4 https://www.youtube.com/watch?v=EVEIl0V-5QE
            const task = spawn(LocationService.ytDlPath(), [
                '--ffmpeg-location', LocationService.libPath(),
                '-f', 'bestvideo[height<=1080][height>=?720]',
                // '--simulate',
                '-P', savePath,
                url,
            ]);
            let progress = 0;
            task.stdout.on('data', (data) => {
                const output = data.toString();
                console.log(output); // 打印 yt-dlp 的输出

                // 正则表达式匹配下载进度
                const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
                if (progressMatch) {
                    // console.log(`Download progress: ${progressMatch[1]}%`);
                    progress = parseFloat(progressMatch[1]);
                }
                result.so.push(data.toString().trim());
                result.ref.stdOut = result.so.join('\n');
                result.ref.progress = progress;
                DpTaskService.update({
                    id: taskId,
                    status: DpTaskState.IN_PROGRESS,
                    progress: `正在下载 ${progress}%`,
                    result: JSON.stringify(result.ref)
                });
            });

            task.stderr.on('data', (data) => {
                console.error(`stderr: ${data}`);
                result.so.push(data.toString().trim());
                result.ref.stdOut = result.so.join('\n');
                DpTaskService.update({
                    id: taskId,
                    status: DpTaskState.IN_PROGRESS,
                    progress: '下载失败',
                    result: JSON.stringify(result.ref)
                });
            });

            task.on('close', (code) => {
                console.log(`child process exited with code ${code}`);
                if (code === 0) {
                    resolve();
                } else {
                    DpTaskService.update({
                        id: taskId,
                        status: DpTaskState.FAILED,
                        progress: '下载失败',
                        result: JSON.stringify(result.ref)
                    });
                    reject(`child process exited with code ${code}`);
                }
            });
        });
    }

    /**
     * yt-dlp -f "bestvideo[height<=1080][height>=?720]" --get-filename --merge-output-format mp4 https://www.youtube.com/watch?v=EVEIl0V-5QE
     * @param taskId
     * @param result
     * @param url
     */
    public static async doDlVideoFileName(taskId: number, result: {
        ref: DlProgress,
        so: string[]
    }, url: string): Promise<string> {
        // 获取yt-dlp的路径和ffmpeg的路径
        const ytDlpPath = LocationService.ytDlPath();
        const ffmpegPath = LocationService.libPath();

        result.so.push('System: fetching video file name');
        result.ref.stdOut = result.so.join('\n');
        DpTaskService.update({
            id: taskId,
            status: DpTaskState.IN_PROGRESS,
            progress: '正在获取文件名',
            result: JSON.stringify(result.ref)
        });
        return new Promise<string>((resolve, reject) => {
            const process = spawn(ytDlpPath, [
                '--ffmpeg-location', ffmpegPath,
                '-f', 'bestvideo[height<=1080][height>=?720]',
                '--get-filename',
                '--merge-output-format', 'mp4',
                url
            ]);

            let output = '';
            process.stdout.on('data', (data: Buffer) => {
                output += data.toString();
                // 如果.mp4结尾，说明是视频文件
                if (output.trim().endsWith('.mp4')) {
                    resolve(output.trim());
                }
                result.so.push(data.toString().trim());
                result.ref.stdOut = result.so.join('\n');
                DpTaskService.update({
                    id: taskId,
                    status: DpTaskState.IN_PROGRESS,
                    progress: '正在获取文件名',
                    result: JSON.stringify(result.ref)
                });
            });

            process.stderr.on('data', (data: Buffer) => {
                console.error('Error:', data.toString());
                result.so.push(data.toString().trim());
                result.ref.stdOut = result.so.join('\n');
                DpTaskService.update({
                    id: taskId,
                    status: DpTaskState.IN_PROGRESS,
                    progress: '正在获取文件名',
                    result: JSON.stringify(result.ref)
                });
            });

            process.on('close', (code: number) => {
                if (code === 0 && output.trim().endsWith('.mp4')) {
                    resolve(output.trim());
                } else {
                    reject(`yt-dlp process exited with code ${code}`);
                }
            });
        });
    }
}
