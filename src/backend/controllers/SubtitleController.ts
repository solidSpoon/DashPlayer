import { SentenceStruct } from '@/common/types/SentenceStruct';
import Controller from '@/backend/interfaces/controller';
import registerRoute from '@/common/api/register';
import SubtitleService from '@/backend/services/SubtitleService';
import {Sentence, SrtSentence} from "@/common/types/SentenceC";


export default class SubtitleController implements Controller {


    public async processSentences(sentences: string[]): Promise<SentenceStruct[]> {
        return SubtitleService.processSentences(sentences);
    }

    public async parseSrt(path: string): Promise<SrtSentence|null> {
        return SubtitleService.parseSrt(path);
    }

    registerRoutes(): void {
        registerRoute('subtitle/sentences/process', this.processSentences);
        registerRoute('subtitle/srt/parse-to-sentences', this.parseSrt);
    }


}

