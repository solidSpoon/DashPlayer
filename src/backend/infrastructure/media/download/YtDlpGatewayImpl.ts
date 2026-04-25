import { injectable } from 'inversify';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import DownloadGateway, { DownloadMetadata, DownloadOptions } from '@/backend/application/ports/gateways/media/DownloadGateway';
import { getRuntimeResourcePath } from '@/backend/utils/runtimeEnv';
import { getMainLogger } from '@/backend/infrastructure/logger';

@injectable()
export default class YtDlpGatewayImpl implements DownloadGateway {
    private logger = getMainLogger('YtDlpGatewayImpl');

    private getBinaryPath(): string {
        const ext = process.platform === 'win32' ? '.exe' : '';
        return getRuntimeResourcePath('lib', `yt-dlp${ext}`);
    }

    public async getMetadata(url: string): Promise<DownloadMetadata> {
        const binary = this.getBinaryPath();
        if (!fs.existsSync(binary)) {
            throw new Error(`yt-dlp binary not found at ${binary}`);
        }

        return new Promise((resolve, reject) => {
            const child = spawn(binary, ['-J', url]);
            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                if (code === 0) {
                    try {
                        const json = JSON.parse(stdout);
                        resolve({
                            title: json.title || 'Unknown Title',
                            thumbnail: json.thumbnail,
                            url: url,
                            duration: json.duration,
                        });
                    } catch (e) {
                        reject(new Error(`Failed to parse yt-dlp output: ${e}`));
                    }
                } else {
                    reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
                }
            });
        });
    }

    public async download(options: DownloadOptions): Promise<void> {
        const binary = this.getBinaryPath();
        if (!fs.existsSync(binary)) {
            throw new Error(`yt-dlp binary not found at ${binary}`);
        }

        const args = [
            '--newline',
            '--progress',
            '--format', 'bestvideo+bestaudio/best',
            '--merge-output-format', 'mp4',
            '-o', options.savePath,
            options.url,
        ];

        return new Promise((resolve, reject) => {
            const child = spawn(binary, args);

            options.onCancelable?.(() => {
                try {
                    child.kill('SIGKILL');
                } catch (e) {
                    this.logger.warn(`Failed to kill yt-dlp process: ${e}`);
                }
                reject(new Error('Cancelled by user'));
            });

            child.stdout.on('data', (data) => {
                const line = data.toString().trim();
                // [download]  10.0% of 100.00MiB at 10.00MiB/s ETA 00:01
                const progressMatch = line.match(/\[download\]\s+([\d.]+)% of\s+[\d.]+(?:MiB|GiB|kiB|B)\s+at\s+([\w\d./]+)\s+ETA\s+([\d:]+)/);
                if (progressMatch) {
                    const percent = parseFloat(progressMatch[1]);
                    const speed = progressMatch[2];
                    const eta = progressMatch[3];
                    options.onProgress?.(percent, speed, eta);
                }
            });

            child.stderr.on('data', (data) => {
                this.logger.warn(`yt-dlp stderr: ${data.toString()}`);
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else if (code === null || code === 9) { // SIGKILL returns null code or 9
                    // Ignore, handled by onCancelable reject
                } else {
                    reject(new Error(`yt-dlp download failed with code ${code}`));
                }
            });
        });
    }
}
