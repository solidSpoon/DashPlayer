import fs from 'fs';
import path from 'path';
import { DpTaskState } from '@/backend/db/tables/dpTask';
import { storeGet } from '@/backend/store';
import RateLimiter from '@/common/utils/RateLimiter';
import SrtUtil, { SrtLine } from '@/common/utils/SrtUtil';
import hash from 'object-hash';
import StrUtil from '@/common/utils/str-util';
import { isErrorCancel } from '@/common/constants/error-constants';
import { inject, injectable } from 'inversify';
import DpTaskService from '../DpTaskService';
import TYPES from '@/backend/ioc/types';
import FfmpegService from '@/backend/services/FfmpegService';
import WhisperService from '@/backend/services/WhisperService';
import { TypeGuards } from '@/backend/utils/TypeGuards';
import { WhisperResponse } from '@/backend/objs/OpenAiWhisperRequest';
import LocationService, { LocationType } from '@/backend/services/LocationService';
import XfyunASRRequest from '@/backend/objs/XfyunASRRequest';


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
    return SrtUtil.toNewSrt(lines);
}



/**
 * 科大讯飞语音转录接口实现
 */
@injectable()
class XfyunWhisperServiceImpl implements WhisperService {
    @inject(TYPES.DpTaskService)
    private dpTaskService!: DpTaskService;

    @inject(TYPES.FfmpegService)
    private ffmpegService!: FfmpegService;
    @inject(TYPES.LocationService)
    private locationService!: LocationService;

    public async transcript(taskId: number, filePath: string) {
        if (StrUtil.isBlank(storeGet('apiKeys.xfyun.appId')) || StrUtil.isBlank(storeGet('apiKeys.xfyun.secretKey'))) {
            this.dpTaskService.fail(taskId, {
                progress: '未设置 讯飞云 密钥'
            });
            return;
        }
        this.dpTaskService.process(taskId, {
            progress: '正在转换音频'
        });
        try {
            const files = await this.convertAndSplit(taskId, filePath);
            this.dpTaskService.checkCancel(taskId);
            this.dpTaskService.process(taskId, {
                progress: '正在转录'
            });
            const whisperResponses = await Promise.all(files.map(async (file) => {
                return await this.whisperThreeTimes(taskId, file);
            }));
            const srtName = filePath.replace(path.extname(filePath), '.srt');
            console.log('srtName', srtName);
            fs.writeFileSync(srtName, toSrt(whisperResponses));
            this.dpTaskService.finish(taskId, {
                progress: '转录完成'
            });
        } catch (error) {
            if (!(error instanceof Error)) {
                throw error;
            }
            const cancel = isErrorCancel(error);
            this.dpTaskService.update({
                id: taskId,
                status: cancel ? DpTaskState.CANCELLED : DpTaskState.FAILED,
                progress: cancel ? '任务取消' : error?.message
            });
        }

    }


    private async whisperThreeTimes(taskId: number, chunk: SplitChunk): Promise<WhisperResponse> {
        let error: any = null;
        for (let i = 0; i < 3; i++) {
            try {
                return await this.whisper(taskId, chunk);
            } catch (e) {
                error = e;
            }
            this.dpTaskService.checkCancel(taskId);
        }
        throw error;
    }

    private async whisper(taskId: number, chunk: SplitChunk): Promise<WhisperResponse> {
        await RateLimiter.wait('whisper');

        const req = XfyunASRRequest.build(chunk.filePath);
        if (TypeGuards.isNull(req)) {
            this.dpTaskService.fail(taskId, {
                progress: '未设置 讯飞云 密钥'
            });
            throw new Error('未设置 讯飞云 密钥');
        }
        this.dpTaskService.registerTask(taskId, req);
        const response = await req.invoke();

        return {
            ...response,
            offset: chunk.offset
        };
    }

    async convertAndSplit(taskId: number, filePath: string): Promise<SplitChunk[]> {
        const folderName = hash(filePath);
        const tempDir = path.join(this.locationService.getDetailLibraryPath(LocationType.TEMP), '/whisper/', folderName);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        // 删除该目录下的所有文件
        fs.readdirSync(tempDir).forEach((file) => {
            fs.unlinkSync(path.join(tempDir, file));
        });
        const files = await this.ffmpegService.splitToAudio({
            taskId,
            inputFile: filePath,
            outputFolder: tempDir,
            segmentTime: 60 * 5
        });
        const chunks: SplitChunk[] = [];
        let offset = 0;
        for (const file of files) {
            const duration = await this.ffmpegService.duration(file);
            chunks.push({
                offset,
                filePath: file
            });
            offset += duration;
        }
        return chunks;
    }
}


export default XfyunWhisperServiceImpl;
