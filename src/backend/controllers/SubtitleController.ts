import registerRoute from '@/common/api/register';
import { SrtSentence } from '@/common/types/SentenceC';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import Controller from '@/backend/interfaces/controller';
import SubtitleService from '@/backend/services/SubtitleService';


@injectable()
export default class SubtitleController implements Controller {

    @inject(TYPES.SubtitleService)
    private subtitleService!: SubtitleService;

    public async parseSrt(path: string): Promise<SrtSentence | null> {
        return this.subtitleService.parseSrt(path);
    }

    public async extractWords(path: string): Promise<Record<string, { index: number; text: string }[]>> {
        const srtData = await this.subtitleService.parseSrt(path);
        if (!srtData || !srtData.sentences) {
            return {};
        }

        const wordMap: Record<string, { index: number; text: string }[]> = {};

        const stopWords = new Set([
            'a', 'an', 'the', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'he', 'him', 'his',
            'she', 'her', 'hers', 'it', 'its', 'they', 'them', 'their', 'what', 'which', 'who', 'whom', 'this', 'that', 'these',
            'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did',
            'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for',
            'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to',
            'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here',
            'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
            'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just',
            'don', 'should', 'now', 'd', 'll', 'm', 'o', 're', 've', 'y'
        ]);

        for (const sentence of srtData.sentences) {
            if (!sentence.struct || !sentence.text) continue;

            const sentenceSnippet = { index: sentence.index, text: sentence.text };

            for (const block of sentence.struct.blocks) {
                for (const part of block.blockParts) {
                    if (part.isWord) {
                        const word = part.content.toLowerCase();
                        if (word && !stopWords.has(word)) {
                            if (!wordMap[word]) {
                                wordMap[word] = [];
                            }
                            // Avoid adding duplicate sentence for the same word
                            if (!wordMap[word].some(s => s.index === sentence.index)) {
                                wordMap[word].push(sentenceSnippet);
                            }
                        }
                    }
                }
            }
        }
        return wordMap;
    }

    registerRoutes(): void {
        registerRoute('subtitle/srt/parse-to-sentences', (p) => this.parseSrt(p));
        registerRoute('subtitle/extract-words', (p) => this.extractWords(p));
    }
}

