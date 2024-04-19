import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';


// import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';

import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import * as os from 'os';
import hash from '@/common/utils/hash';
import DpTaskService from '@/backend/services/DpTaskService';
import { DpTaskState } from '@/backend/db/tables/dpTask';
import { p, strBlank } from '@/common/utils/Util';
import { storeGet } from '@/backend/store';
import FfmpegService from "@/backend/services/FfmpegService";
import RateLimiter from "@/common/utils/RateLimiter";

interface WhisperResponse {
    language: string;
    duration: number;
    text: string;
    offset: number;
    segments: {
        seek: number;
        start: number;
        end: number;
        text: string;
    }[];
}

interface SplitChunk {
    offset: number;
    filePath: string;
}

function toSrt(whisperResponses: WhisperResponse[]): string {
    whisperResponses.sort((a, b) => a.offset - b.offset);
    const srtLines: string[] = [];
    let counter = 1;

    function toSrtTimestamp(seconds: number): string {
        const date = new Date(0);
        date.setSeconds(seconds);
        const timeString = date.toISOString().substr(11, 12);
        return timeString.replace('.', ',');
    }

    for (const wr of whisperResponses) {
        for (const segment of wr.segments) {
            const startTime = toSrtTimestamp(segment.start + wr.offset);
            const endTime = toSrtTimestamp(segment.end + wr.offset);
            const text = segment.text;
            const srtLine = `${counter}\n${startTime} --> ${endTime}\n${p(text)}\n\n`;
            srtLines.push(srtLine);
            counter++;
        }
    }

    return srtLines.join('');
}

class WhisperService {
    public static async transcript(taskId: number, filePath: string) {
        if (strBlank(storeGet('apiKeys.openAi.key')) || strBlank(storeGet('apiKeys.openAi.endpoint'))) {
            await DpTaskService.update({
                id: taskId,
                status: DpTaskState.FAILED,
                progress: '未设置 OpenAI 密钥'
            });
            return;
        }
        // await this.whisper();
        await DpTaskService.update({
            id: taskId,
            status: DpTaskState.IN_PROGRESS,
            progress: '正在转换音频'
        });
        try {
            const files = await this.convertAndSplit(filePath);
            await DpTaskService.update({
                id: taskId,
                status: DpTaskState.IN_PROGRESS,
                progress: '正在转录'
            });
            const whisperResponses = await Promise.all(files.map(async (file) => {
                return await this.whisper(file);
            }));
            const srtName = filePath.replace(path.extname(filePath), '.srt');
            console.log('srtName', srtName);
            fs.writeFileSync(srtName, toSrt(whisperResponses));
            await DpTaskService.update({
                id: taskId,
                status: DpTaskState.DONE,
                progress: '转录完成'
            });
        } catch (error) {
            await DpTaskService.update({
                id: taskId,
                status: DpTaskState.FAILED,
                progress: error.message
            });
        }

    }

    private static joinUrl(base: string, path: string): string {
        return base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
    }

    private static async whisper(chunk: SplitChunk): Promise<WhisperResponse> {
        await RateLimiter.wait('whisper');
        const data = new FormData();
        data.append('file', fs.createReadStream(chunk.filePath) as any);
        data.append('model', 'whisper-1');
        data.append('language', 'en');
        data.append('response_format', 'verbose_json');

        const config = {
            method: 'post',
            url: this.joinUrl(storeGet('apiKeys.openAi.endpoint'), '/v1/audio/transcriptions'),
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${storeGet('apiKeys.openAi.key')}`,
                'Content-Type': 'multipart/form-data',
                ...data.getHeaders()
            },
            data: data,
            timeout: 1000 * 60 * 10
        };

        try {
            const response = await axios(config);
            return {
                ...response.data,
                offset: chunk.offset
            } as WhisperResponse;
        } catch (error) {
            console.log(error);
        }
    }

    static async convertAndSplit(filePath: string): Promise<SplitChunk[]> {
        const folderName = hash(filePath);
        const tempDir = path.join(os.tmpdir(), 'dp/whisper/', folderName);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        // 文件名为路径 hash
        const baseFileName = hash(filePath);
        const duration = await FfmpegService.duration(filePath);
        const chunkSize = 60 * 10;
        const chunks: SplitChunk[] = [];
        let pos = 0;
        while (pos < duration) {
            const start = pos;
            let end = Math.min(pos + chunkSize, duration);
            let currentChunkSize = chunkSize;
            if (end + 60 * 4 > duration) {
                end = duration;
                currentChunkSize = end - start;
            }
            const chunkFileName = path.join(tempDir, `${baseFileName}-${start}-${end}.mp3`);
            await FfmpegService.splitVideo({
                inputFile: filePath,
                startSecond: start,
                endSecond: end,
                outputFile: chunkFileName
            });
            chunks.push({
                offset: start,
                filePath: chunkFileName
            });
            pos += currentChunkSize;
        }
        return chunks;
    }
}


export default WhisperService;
