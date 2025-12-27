import registerRoute from '@/backend/adapters/ipc/registerRoute';
import { SrtSentence } from '@/common/types/SentenceC';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import Controller from '@/backend/adapters/controllers/Controller';
import SubtitleService from '@/backend/application/services/SubtitleService';


@injectable()
export default class SubtitleController implements Controller {

    @inject(TYPES.SubtitleService)
    private subtitleService!: SubtitleService;

    public async parseSrt(path: string): Promise<SrtSentence | null> {
        return this.subtitleService.parseSrt(path);
    }

    registerRoutes(): void {
        registerRoute('subtitle/srt/parse-to-sentences', (p) => this.parseSrt(p));
    }
}
