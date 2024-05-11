import {spawn} from 'child_process';
import DpTaskService from '@/backend/services/DpTaskService';
import {DpTaskState} from '@/backend/db/tables/dpTask';
import LocationService from '@/backend/services/LocationService';
import {DlProgress} from "@/common/types/dl-progress";
import Util from "@/common/utils/Util";


export default class DlVideoService {
    public static async dlVideo(taskId: number, url: string, savePath: string) {
        //yt-dlp -f "bestvideo[height<=1080][height>=?720]" --merge-output-format mp4 https://www.youtube.com/watch?v=EVEIl0V-5QE
        const task = spawn(LocationService.ytDlPath(), [
            '--ffmpeg-location', LocationService.libPath(),
            '-f', 'bestvideo[height<=1080][height>=?720]',
            '-P', savePath,
            url,
        ]);
        const so: string[] = [];
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
            so.push(data.toString().trim());
            const pResp: DlProgress = {
                progress: progress,
                stdOut: so.join('\n')
            }

            console.log(`stdout: ${data}`);
            so.push(data.toString().trim());
            DpTaskService.update({
                id: taskId,
                status: DpTaskState.IN_PROGRESS,
                progress: '正在下载',
                result: JSON.stringify(pResp)
            });
        });

        task.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
            so.push(data.toString().trim());
            const pResp: DlProgress = {
                progress: progress,
                stdOut: so.join('\n')
            }
            DpTaskService.update({
                id: taskId,
                status: DpTaskState.IN_PROGRESS,
                progress: '正在下载',
                result: JSON.stringify(pResp)
            });
        });

        task.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
            const pResp: DlProgress = {
                progress: progress,
                stdOut: so.join('\n')
            }
            DpTaskService.update({
                id: taskId,
                status: DpTaskState.DONE,
                progress: '下载完成',
                result: JSON.stringify(pResp)
            });
        });
    }


    public static async dlVideoFileName2( url: string): Promise<string> {
        // 获取yt-dlp的路径和ffmpeg的路径
        const ytDlpPath = LocationService.ytDlPath();
        const ffmpegPath = LocationService.libPath();

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
            });

            process.stderr.on('data', (data: Buffer) => {
                console.error('Error:', data.toString());
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



    /**
     * yt-dlp -f "bestvideo[height<=1080][height>=?720]" --get-filename --merge-output-format mp4 https://www.youtube.com/watch?v=EVEIl0V-5QE
     * @param taskId
     * @param url
     */
    public static async dlVideoFileName(taskId: number, url: string): Promise<string> {
        // 获取yt-dlp的路径和ffmpeg的路径
        const ytDlpPath = LocationService.ytDlPath();
        const ffmpegPath = LocationService.libPath();

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
                    DpTaskService.update({
                        id: taskId,
                        status: DpTaskState.IN_PROGRESS,
                        progress: '正在获取文件名',
                        result: output
                    });
                }
            });

            process.stderr.on('data', (data: Buffer) => {
                console.error('Error:', data.toString());
                // DpTaskService.update({
                //     id: taskId,
                //     status: DpTaskState.IN_PROGRESS,
                //     progress: '正在获取文件名',
                //     result: output + '\n' + data.toString(),
                // });
            });

            process.on('close', (code: number) => {
                if (code === 0) {
                    if (output.trim().endsWith('.mp4')) {
                        DpTaskService.update({
                            id: taskId,
                            status: DpTaskState.DONE,
                            progress: '获取文件名完成',
                            result: output
                        });
                    }
                    resolve(output.trim());
                } else {
                    reject(`yt-dlp process exited with code ${code}`);
                }
            });
        });
    }
}
