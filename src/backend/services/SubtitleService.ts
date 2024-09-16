import { SrtSentence } from '@/common/types/SentenceC';

export default interface SubtitleService {
    parseSrt(path: string): Promise<SrtSentence>;
}
