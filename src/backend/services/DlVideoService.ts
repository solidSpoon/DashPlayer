import { spawn } from 'child_process';
import DpTaskService from '@/backend/services/DpTaskService';
import { DpTaskState } from '@/backend/db/tables/dpTask';
import LocationService from '@/backend/services/LocationService';


export default class DlVideoService {
    public static async dlVideo(taskId: number, url: string, savePath: string) {
        const task = spawn(LocationService.ytDlPath(), [
            '--ffmpeg-location', LocationService.libPath(),
            '-S', 'res:1080,ext',
            '-P', savePath,
            url,
        ]);
        const so: string[] = [];
        task.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
            so.push(data.toString().trim());
            DpTaskService.update({
                id: taskId,
                status: DpTaskState.IN_PROGRESS,
                progress: '正在下载',
                result: so.join('\n')
            });
        });

        task.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
            so.push(data.toString().trim());
            DpTaskService.update({
                id: taskId,
                status: DpTaskState.IN_PROGRESS,
                progress: '正在下载',
                result: so.join('\n')
            });
        });

        task.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
            DpTaskService.update({
                id: taskId,
                status: DpTaskState.DONE,
                progress: '下载完成',
                result: so.join('\n')
            });
        });
    }
}
