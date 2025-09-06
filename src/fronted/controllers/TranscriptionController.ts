/**
 * Transcription Controller - 处理转录相关的后端回调
 */

import { BaseRendererController } from './BaseRendererController';
import useTranscript from '../hooks/useTranscript';

export class TranscriptionController extends BaseRendererController {
    readonly name = 'TranscriptionController';

    protected setupApis(): void {
        this.batchRegisterApis({
            // 批量转录结果回调
            'transcript/batch-result': async (params) => {
                this.logger.debug('Batch transcription result', { params });
                
                const { updates } = params;
                useTranscript.getState().updateTranscriptTasks(updates);
            }
        });
    }
}