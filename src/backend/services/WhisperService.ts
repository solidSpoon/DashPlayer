import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import path from 'path';
import * as os from 'os';
import DpTaskService from '@/backend/services/DpTaskService';
import {DpTaskState} from '@/backend/db/tables/dpTask';
import {strBlank} from '@/common/utils/Util';
import {storeGet} from '@/backend/store';
import FfmpegService from "@/backend/services/FfmpegService";
import RateLimiter from "@/common/utils/RateLimiter";
import SrtUtil, {SrtLine} from "@/common/utils/SrtUtil";
import hash from "object-hash";

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
    let counter = 1;
    const lines: SrtLine[] = [];
    for (const wr of whisperResponses) {
        for (const segment of wr.segments) {
            lines.push({
                index: counter,
                start: segment.start + wr.offset,
                end: segment.end + wr.offset,
                contentEn: segment.text,
                contentZh: ''
            });
            counter++;
        }
    }
    return SrtUtil.toSrt(lines);
}

class WhisperService {
    public static async transcript(taskId: number, filePath: string) {
        if (strBlank(storeGet('apiKeys.openAi.key')) || strBlank(storeGet('apiKeys.openAi.endpoint'))) {
            DpTaskService.update({
                id: taskId,
                status: DpTaskState.FAILED,
                progress: '未设置 OpenAI 密钥'
            });
            return;
        }
        // await this.whisper();
        DpTaskService.checkCancel(taskId);
        DpTaskService.update({
            id: taskId,
            status: DpTaskState.IN_PROGRESS,
            progress: '正在转换音频'
        });
        try {
            const files = await this.convertAndSplit(filePath);
            DpTaskService.checkCancel(taskId);
            DpTaskService.update({
                id: taskId,
                status: DpTaskState.IN_PROGRESS,
                progress: '正在转录'
            });
            const whisperResponses = await Promise.all(files.map(async (file) => {
                return await this.whisperThreeTimes(taskId, file);
            }));
            const srtName = filePath.replace(path.extname(filePath), '.srt');
            console.log('srtName', srtName);
            fs.writeFileSync(srtName, toSrt(whisperResponses));
            DpTaskService.update({
                id: taskId,
                status: DpTaskState.DONE,
                progress: '转录完成'
            });
        } catch (error) {
            DpTaskService.update({
                id: taskId,
                status: DpTaskState.FAILED,
                progress: error.message
            });
        }

    }

    private static joinUrl(base: string, path: string): string {
        return base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
    }

    private static async whisperThreeTimes(taskId: number, chunk: SplitChunk): Promise<WhisperResponse> {
        let error: any = null;
        for (let i = 0; i < 3; i++) {
            try {
                return await this.whisper(chunk);
            } catch (e) {
                error = e;
            }
            DpTaskService.checkCancel(taskId);
        }
        throw error;
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

        const response = await axios(config);
        return {
            ...response.data,
            offset: chunk.offset
        };
    }

    static async convertAndSplit(filePath: string): Promise<SplitChunk[]> {
        const folderName = hash(filePath);
        const tempDir = path.join(os.tmpdir(), 'dp/whisper/', folderName);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, {recursive: true});
        }
        // 删除该目录下的所有文件
        fs.readdirSync(tempDir).forEach((file) => {
            fs.unlinkSync(path.join(tempDir, file));
        });
        const files = await FfmpegService.splitToAudio({
            inputFile: filePath,
            outputFolder: tempDir,
            segmentTime: 60 * 5
        });
        const chunks: SplitChunk[] = [];
        let offset = 0;
        for (const file of files) {
            const duration = await FfmpegService.duration(file);
            chunks.push({
                offset,
                filePath: file
            });
            offset += duration;
        }
        return chunks;
    }
}


export default WhisperService;
