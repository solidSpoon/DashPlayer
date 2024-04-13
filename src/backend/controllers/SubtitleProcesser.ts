import { SentenceStruct } from '@/common/types/SentenceStruct';
import Controller from '@/backend/interfaces/controller';
import registerRoute from '@/common/api/register';
import SubtitleService from '@/backend/services/SubtitleService';


export default class SubtitleController implements Controller {


    public async processSentences(sentences: string[]): Promise<SentenceStruct[]> {
        return SubtitleService.processSentences(sentences);
    }

    registerRoutes(): void {
        registerRoute('subtitle/sentences/process', this.processSentences);
    }


}

