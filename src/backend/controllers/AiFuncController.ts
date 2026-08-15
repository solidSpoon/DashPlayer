import registerRoute from '@/backend/controllers/ipc/registerRoute';
import { inject, injectable } from 'inversify';
import Controller from '@/backend/controllers/Controller';
import TYPES from '@/backend/ioc/types';
import AiFuncService from '@/backend/services/AiFuncService';

@injectable()
export default class AiFuncController implements Controller {

    @inject(TYPES.AiFuncService)
    private aiFuncService!: AiFuncService;


    registerRoutes(): void {
        registerRoute('ai-func/format-split', (p) => this.aiFuncService.formatSplit(p));
        registerRoute('ai-func/tts', (p) => this.aiFuncService.tts(p));
        registerRoute('transcript/list', () => this.aiFuncService.listTranscriptionTasks());
        registerRoute('transcript/enqueue', (p) => this.aiFuncService.enqueueTranscription(p));
        registerRoute('transcript/remove', (p) => this.aiFuncService.removeTranscription(p));
        registerRoute('transcript/start', (p) => this.aiFuncService.transcript(p));
        registerRoute('transcript/cancel', (p) => this.aiFuncService.cancelTranscription(p));
    }
}
