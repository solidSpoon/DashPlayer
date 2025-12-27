import registerRoute from '@/backend/adapters/ipc/registerRoute';
import Controller from '@/backend/adapters/controllers/Controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { WhisperModelSize, WhisperModelStatusVO, WhisperVadModel } from '@/common/types/vo/whisper-model-vo';
import { WhisperModelService } from '@/backend/application/services/impl/WhisperModelService';

@injectable()
export class WhisperModelController implements Controller {
    @inject(TYPES.WhisperModelService) private whisperModelService!: WhisperModelService;

    public async getStatus(): Promise<WhisperModelStatusVO> {
        return this.whisperModelService.getStatus();
    }

    public async downloadWhisperModel(params: { modelSize: WhisperModelSize }): Promise<{ success: boolean; message: string }> {
        return this.whisperModelService.downloadWhisperModel(params);
    }

    public async downloadVadModel(params: { vadModel: WhisperVadModel }): Promise<{ success: boolean; message: string }> {
        return this.whisperModelService.downloadVadModel(params);
    }

    registerRoutes(): void {
        registerRoute('whisper/models/status', () => this.getStatus());
        registerRoute('whisper/models/download', (p: { modelSize: WhisperModelSize }) => this.downloadWhisperModel(p));
        registerRoute('whisper/models/download-vad', (p: { vadModel: WhisperVadModel }) => this.downloadVadModel(p));
    }
}
