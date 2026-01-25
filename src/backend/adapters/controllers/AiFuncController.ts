import registerRoute from '@/backend/adapters/ipc/registerRoute';
import { inject, injectable } from 'inversify';
import Controller from '@/backend/adapters/controllers/Controller';
import TYPES from '@/backend/ioc/types';
import AiFuncService from '@/backend/application/services/impl/AiFuncService';

@injectable()
export default class AiFuncController implements Controller {

    @inject(TYPES.AiFuncService)
    private aiFuncService!: AiFuncService;


    registerRoutes(): void {
        registerRoute('ai-func/format-split', (p) => this.aiFuncService.formatSplit(p));
        registerRoute('ai-func/tts', (p) => this.aiFuncService.tts(p));
        registerRoute('ai-func/transcript', (p) => this.aiFuncService.transcript(p));
        registerRoute('ai-func/cancel-transcription', (p) => this.aiFuncService.cancelTranscription(p));
    }
}
