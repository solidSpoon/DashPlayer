import {spawn, ChildProcess} from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {injectable} from 'inversify';
import {getMainLogger} from '@/backend/infrastructure/logger';
import { getRuntimeResourcePath } from '@/backend/utils/runtimeEnv';

export type WhisperCppCliProgressEvent = {
    percent: number;
    heartbeat: boolean;
};

@injectable()
export class WhisperCppCli {
    private logger = getMainLogger('WhisperCppCli');

    private helpCache: string | null = null;
    private activeProcess: ChildProcess | null = null;

    public killActive(signal: NodeJS.Signals | number = 'SIGKILL'): void {
        try {
            this.activeProcess?.kill(signal);
        } catch {
            //
        }
    }

    public resolveExecutablePath(): string {
        const basePath = getRuntimeResourcePath('lib', 'whisper.cpp');

        const platform = process.platform;
        const platformDir = platform === 'darwin' ? 'darwin' : platform === 'win32' ? 'win32' : 'linux';
        const archDir = process.arch === 'arm64' ? 'arm64' : 'x64';

        const candidates: string[] = [];
        if (platform === 'win32') {
            candidates.push(
                path.join(basePath, archDir, platformDir, 'whisper-cli.exe'),
                path.join(basePath, archDir, platformDir, 'main.exe'),
            );
        } else {
            candidates.push(
                path.join(basePath, archDir, platformDir, 'whisper-cli'),
                path.join(basePath, archDir, platformDir, 'main'),
            );
        }

        for (const p of candidates) {
            if (fs.existsSync(p)) return p;
        }

        throw new Error(`whisper.cpp executable not found: ${candidates.join(', ')}`);
    }

    public async getHelpText(executablePath: string): Promise<string> {
        if (this.helpCache) return this.helpCache;

        const helpText = await new Promise<string>((resolve) => {
            const child = spawn(executablePath, ['-h'], {stdio: ['ignore', 'pipe', 'pipe']});
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (d) => (stdout += String(d)));
            child.stderr.on('data', (d) => (stderr += String(d)));
            child.on('close', () => resolve((stdout || stderr || '').toString()));
        });

        this.helpCache = helpText;
        return helpText;
    }

    public async run(params: {
        executablePath: string;
        args: string[];
        isCancelled?: () => boolean;
        onProgressEvent?: (evt: WhisperCppCliProgressEvent) => void;
    }): Promise<void> {
        const {executablePath, args, isCancelled, onProgressEvent} = params;

        if (isCancelled?.()) throw new Error('Transcription cancelled by user');

        let lastReportedPercent = 0;
        let lastProgressUpdateAt = 0;
        let hasSeenWhisperPercent = false;
        const maybeReportPercent = (percent: number, heartbeat: boolean) => {
            const now = Date.now();
            if (!Number.isFinite(percent)) return;
            const boundedPercent = Math.max(0, Math.min(100, Math.floor(percent)));

            const shouldUpdate =
                boundedPercent > lastReportedPercent ||
                (heartbeat && now - lastProgressUpdateAt > 1500 && boundedPercent >= lastReportedPercent);
            if (!shouldUpdate) return;

            if (!heartbeat) hasSeenWhisperPercent = true;
            lastReportedPercent = boundedPercent;
            lastProgressUpdateAt = now;
            onProgressEvent?.({percent: boundedPercent, heartbeat});
        };

        try {
            await new Promise<void>((resolve, reject) => {
                const child = spawn(executablePath, args, {stdio: ['pipe', 'pipe', 'pipe']});
                this.activeProcess = child;

                let stderr = '';
                // eslint-disable-next-line no-control-regex
                const ansiRegex = new RegExp('\\x1b\\[[0-9;]*m', 'g');
                const stripAnsi = (s: string) => s.replace(ansiRegex, '');
                const percentRegexGlobal = /(\d{1,3})%/g;
                const floatProgressRegexGlobal = /\bprogress\s*=\s*(\d*\.\d+)\b/gi;

                const scanForPercent = (text: string) => {
                    const clean = stripAnsi(text);
                    let m: RegExpExecArray | null;
                    while ((m = percentRegexGlobal.exec(clean)) !== null) {
                        maybeReportPercent(Number(m[1]), false);
                    }
                    while ((m = floatProgressRegexGlobal.exec(clean)) !== null) {
                        const v = Number(m[1]);
                        if (!Number.isFinite(v)) continue;
                        if (v >= 0 && v <= 1.01) {
                            maybeReportPercent(v * 100, false);
                        }
                    }
                };

                child.stdout.on('data', (d) => {
                    scanForPercent(String(d));
                });
                child.stderr.on('data', (d) => {
                    const chunk = String(d);
                    stderr += chunk;
                    scanForPercent(chunk);
                });

                const heartbeat = setInterval(() => {
                    if (isCancelled?.()) return;
                    if (hasSeenWhisperPercent) return;
                    const now = Date.now();
                    if (now - lastProgressUpdateAt < 8000) return;
                    this.logger.debug('whisper.cpp progress heartbeat');
                    maybeReportPercent(lastReportedPercent, true);
                }, 4000);

                child.on('error', reject);
                child.on('close', (code) => {
                    clearInterval(heartbeat);
                    if (code === 0) resolve();
                    else reject(new Error(`whisper.cpp exit code ${code}: ${stderr.slice(-2000)}`));
                });
            });
        } finally {
            this.activeProcess = null;
        }

        if (isCancelled?.()) throw new Error('Transcription cancelled by user');
    }
}
