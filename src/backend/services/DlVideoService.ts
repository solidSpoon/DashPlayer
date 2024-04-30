import LocationService from "@/backend/services/LocationService";
import SystemService from "@/backend/services/SystemService";
import {exec} from 'child_process';
import path from "path";

export default class DlVideoService {
    public static async dlVideo(url: string, savePath: string) {
        if (SystemService.isWindows()) {
            const batPath = path.join(LocationService.scriptPath(), 'download_video.bat');
            const batString = `start cmd /k ${batPath} ${LocationService.libPath()} "${url}"`;
            console.log('Running command:', batString);
            exec(batString, (error, stdout, stderr) => {
                if (error) {
                    console.error('Failed to run command:', error);
                } else {
                    console.log('Command output:', stdout);
                }
            });

        } else {
            const shPath = path.join(LocationService.scriptPath(), 'download_video.sh');
            const shCommand = `osascript -e 'tell application "Terminal" to do script "bash ${shPath} ${LocationService.libPath()} ${url}"'`;
            console.log('Running command:', shCommand);
            exec(shCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error('Failed to run command:', error);
                } else {
                    console.log('Command output:', stdout);
                }
            });
        }
    }


}
