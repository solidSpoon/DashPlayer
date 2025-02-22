import fs from 'fs';
import path from 'path';
import { DpTaskState } from '@/backend/db/tables/dpTask';
import SrtUtil, { SrtLine } from '@/common/utils/SrtUtil';
import hash from 'object-hash';
import { isErrorCancel } from '@/common/constants/error-constants';
import { inject, injectable } from 'inversify';
import DpTaskService from '../DpTaskService';
import TYPES from '@/backend/ioc/types';
import FfmpegService from '@/backend/services/FfmpegService';
import WhisperService from '@/backend/services/WhisperService';
import { TypeGuards } from '@/backend/utils/TypeGuards';
import OpenAiWhisperRequest, { WhisperResponse } from '@/backend/objs/OpenAiWhisperRequest';
import LocationService, { LocationType } from '@/backend/services/LocationService';
import dpLog from '@/backend/ioc/logger';
import { OpenAiService } from '@/backend/services/OpenAiService';
import { WaitLock } from '@/common/utils/Lock';
import { SplitChunk, WhisperContext, WhisperContextSchema } from '@/common/types/video-info';
import { ConfigTender } from '@/backend/objs/config-tender';
import FileUtil from '@/backend/utils/FileUtil';


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


@injectable()
class WhisperServiceImpl implements WhisperService {
    @inject(TYPES.DpTaskService)
    private dpTaskService!: DpTaskService;

    @inject(TYPES.FfmpegService)
    private ffmpegService!: FfmpegService;
    @inject(TYPES.LocationService)
    private locationService!: LocationService;
    @inject(TYPES.OpenAiService)
    private openAiService!: OpenAiService;

    private static readonly INFO_FILE = 'info.json';


    public async transcript(taskId: number, filePath: string) {
        this.dpTaskService.process(taskId, {
            progress: '正在转换音频'
        });
        try {
            const folder = this.allocateFolder(filePath);
            const defaultValue: WhisperContext = {
                filePath,
                folder,
                state: 'init',
                videoInfo: await this.ffmpegService.getVideoInfo(filePath),
                chunks: [],
                updatedTime: Date.now()
            };
            const configTender = new ConfigTender<WhisperContext, typeof WhisperContextSchema>(
                path.join(folder, WhisperServiceImpl.INFO_FILE),
                WhisperContextSchema,
                defaultValue
            );

            const context: WhisperContext = configTender.get();
            const videoChanged = !FileUtil.compareVideoInfo(context.videoInfo, await this.ffmpegService.getVideoInfo(filePath));
            const expired = Date.now() - context.updatedTime > 3 * 60 * 60 * 1000;
            // 过期时间 3 小时
            if (context.state !== 'processed'
                || expired
                || videoChanged) {
                // 重新转换
                await this.convertAndSplit(taskId, context);
                configTender.save(context);
                configTender.setKey('state', 'processed');

            }
            this.dpTaskService.checkCancel(taskId);
            const unFinishedChunk = context.chunks.filter((chunk) => !chunk.response);
            if (unFinishedChunk.length === 0) {
                this.dpTaskService.finish(taskId, {
                    progress: '转录完成'
                });
                return;
            }
            this.dpTaskService.process(taskId, {
                // 百分比
                progress: `正在转录 ${Math.floor((context.chunks.length - unFinishedChunk.length) / context.chunks.length * 100)}%`
            });
            await Promise.all(context.chunks.map(async (file) => {
                await this.whisperThreeTimes(taskId, file);
                const ufc = context.chunks.filter((chunk) => !chunk.response);
                this.dpTaskService.update({
                    id: taskId,
                    progress: `正在转录 ${Math.floor((context.chunks.length - ufc.length) / context.chunks.length * 100)}%`
                });
            }));
            const srtName = filePath.replace(path.extname(filePath), '.srt');
            console.log('srtName', srtName);
            const whisperResponses = context.chunks.map((chunk) => chunk.response as WhisperResponse);
            fs.writeFileSync(srtName, toSrt(whisperResponses));
            this.dpTaskService.finish(taskId, {
                progress: '转录完成'
            });
            context.state = 'processed';
            configTender.save(context);
        } catch (error) {
            dpLog.error(error);
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


    private async whisperThreeTimes(taskId: number, chunk: SplitChunk) {
        let error: any = null;
        for (let i = 0; i < 3; i++) {
            try {
                dpLog.info(`${this.logPrefix(taskId)} Attempt ${i + 1} to invoke Whisper API for chunk offset ${chunk.offset}`);
                chunk.response = await this.whisper(taskId, chunk);
                return;
            } catch (e) {
                error = e;
            }
            this.dpTaskService.checkCancel(taskId);
        }
        throw error;
    }

    private logPrefix = (taskId: number) => {
        return `[WhisperService] Task ID: ${taskId} -`;
    };

    @WaitLock('whisper')
    private async whisper(taskId: number, chunk: SplitChunk): Promise<WhisperResponse> {
        const openAi = this.openAiService.getOpenAi();
        const req = OpenAiWhisperRequest.build(openAi, chunk.filePath);
        if (TypeGuards.isNull(req)) {
            this.dpTaskService.fail(taskId, {
                progress: '未设置 OpenAI 密钥'
            });
            throw new Error('未设置 OpenAI 密钥');
        }
        this.dpTaskService.registerTask(taskId, req);
        const response = await req.invoke();

        return {
            ...response,
            offset: chunk.offset
        };
    }

    async convertAndSplit(taskId: number, context: WhisperContext): Promise<void> {
        // 删除该目录下的所有文件
        fs.readdirSync(context.folder).forEach((file) => {
            fs.unlinkSync(path.join(context.folder, file));
        });
        const files = await this.ffmpegService.splitToAudio({
            taskId,
            inputFile: context.filePath,
            outputFolder: context.folder,
            segmentTime: 60
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
        context.chunks = chunks;
    }


    private allocateFolder(filePath: string) {
        const folderName = hash(filePath);
        const tempDir = path.join(this.locationService.getDetailLibraryPath(LocationType.TEMP), '/whisper/', folderName);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        return tempDir;
    }
}


export default WhisperServiceImpl;
