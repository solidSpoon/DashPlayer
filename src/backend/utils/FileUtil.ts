import fs from 'fs';
import jschardet from 'jschardet';
import iconv from 'iconv-lite';
import { dialog } from 'electron';

export default class FileUtil {
    public static async read(path: string): Promise<string | null> {
        try {
            if (!fs.existsSync(path)) {
                return null;
            }
            const buffer = fs.readFileSync(path);
            const encoding = jschardet.detect(buffer).encoding;
            return iconv.decode(buffer, encoding).toString();
        } catch (e) {
            // show open dialog
            await dialog.showMessageBox({
                type: 'error',
                message: `无权限读取文件，请选择文件 ${path} 来授权`
            });

            const files = await dialog.showOpenDialog({
                properties: ['openFile']
            });
            if (files.canceled || files.filePaths.length === 0) {
                return null;
            }
            const buffer = fs.readFileSync(files.filePaths[0]);
            const encoding = jschardet.detect(buffer).encoding;
            return iconv.decode(buffer, encoding).toString();
        }
    }


    /**
     * 获取文件夹下的所有文件
     */
    public static async listFiles(path: string): Promise<string[]> {
        try {
            if (!fs.existsSync(path)) {
                return [];
            }
            return fs.readdirSync(path);
        } catch (e) {
            // show open dialog
            await dialog.showMessageBox({
                type: 'error',
                message: `无权限访问文件夹，请选择文件夹 ${path} 来授权`
            });

            const files = await dialog.showOpenDialog({
                properties: ['openDirectory']
            });
            if (files.canceled) {
                return [];
            }
            return fs.readdirSync(path);
        }
    }
}
