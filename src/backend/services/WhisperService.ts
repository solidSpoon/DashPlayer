import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';


import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';

import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import * as os from 'os';
import hash from '@/common/utils/hash';
import DpTaskService from '@/backend/services/DpTaskService';
import { DpTaskState } from '@/backend/db/tables/dpTask';

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
    let srt = '';
    for (let i = 0; i < whisperResponses.length; i++) {
        const { offset, duration, text } = whisperResponses[i];
        const startTime = new Date(offset * 1000).toISOString().substr(11, 12);
        const endTime = new Date((offset + duration) * 1000).toISOString().substr(11, 12);
        srt += `${i + 1}\n${startTime} --> ${endTime}\n${text}\n\n`;
    }
    return srt;
}

class WhisperService {

    public static async transcript(taskId: number, filePath: string) {
        // await this.whisper();
        await DpTaskService.update({
            id: taskId,
            status: DpTaskState.IN_PROGRESS,
            progress: '正在转换音频',
        })
        try {
            const files = await this.convertAndSplit(filePath);
            await DpTaskService.update({
                id: taskId,
                status: DpTaskState.IN_PROGRESS,
                progress: '正在转录',
            });
            const whisperResponses = await Promise.all(files.map(async (file) => {
                return  await this.whisper(file);
            }));
            const srtName = filePath.replace(path.extname(filePath), '.srt');
            console.log('srtName', srtName);
            fs.writeFileSync(srtName, toSrt(whisperResponses));
            await DpTaskService.update({
                id: taskId,
                status: DpTaskState.DONE,
                progress: '转录完成',
            });
        } catch (error) {
            await DpTaskService.update({
                id: taskId,
                status: DpTaskState.FAILED,
                progress: error.message,
            });
        }

    }

    private static async whisper(chunk: SplitChunk) :Promise<WhisperResponse>{
        const data = new FormData();
        data.append('file', fs.createReadStream(chunk.filePath) as any);
        data.append('model', 'whisper-1');
        data.append('language', 'en');
        data.append('response_format', 'verbose_json');

        const config = {
            method: 'post',
            url: 'https://oneapi.gptnb.me/v1/audio/transcriptions',
            headers: {
                'Accept': 'application/json',
                'Authorization': 'Bearer sk-oxTSqN28uqFTRfJy515b24Dd06Be45Ca9c3071757862882d',
                'Content-Type': 'multipart/form-data',
                ...data.getHeaders()
            },
            data: data
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

    static async split() {
        ffmpeg.setFfmpegPath(ffmpegPath);
    }

    static async convertAndSplit(filePath: string): Promise<SplitChunk[]>{
        const folderName = hash(filePath);
        const tempDir = path.join(os.tmpdir(), 'dp/whisper/', folderName);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        // 文件名为路径 hash
        console.log('tempDir', tempDir);
        const outputPath = path.join(tempDir, 'output.mp3');
        const maxFileSize = 25 * 1024 * 1024; // 25MB

        ffmpeg.setFfmpegPath(ffmpegPath);

        // Convert to mp3 with low quality
        await new Promise((resolve, reject) => {
            ffmpeg(filePath)
                .format('mp3')
                .audioQuality(128)
                .output(outputPath)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });
        console.log('outputPath', outputPath);

        // Check file size
        const stats = fs.statSync(outputPath);
        const fileSizeInBytes = stats.size;

        // If file size is larger than 25MB, split it
        if (fileSizeInBytes < maxFileSize) {
            return [{ offset: 0, filePath: outputPath }];
        }
        const duration = await new Promise<number>((resolve, reject) => {
            ffmpeg.ffprobe(outputPath, (err, metadata) => {
                if (err) reject(err);
                else resolve(metadata.format.duration);
            });
        });

        const parts = Math.ceil(fileSizeInBytes / maxFileSize);
        const partDuration = duration / parts;

        const outputPartPaths: SplitChunk[] = [];
        for (let i = 0; i < parts; i++) {
            const start = i * partDuration;
            const outputPartPath = path.join(tempDir, `output_part_${i}.mp3`);

            await new Promise((resolve, reject) => {
                ffmpeg(outputPath)
                    .setStartTime(start)
                    .setDuration(partDuration)
                    .output(outputPartPath)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });
            console.log('outputPartPath', outputPartPath);
            outputPartPaths.push({ offset: start, filePath: outputPartPath });
        }
        return outputPartPaths;
    }
}


export default WhisperService;
