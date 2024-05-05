import nlp from 'compromise';
import {SentenceBlockBySpace, SentenceBlockPart, SentenceStruct} from '@/common/types/SentenceStruct';
import {strBlank} from '@/common/utils/Util';
import fs from "fs";
import SrtUtil, {SrtLine} from "@/common/utils/SrtUtil";
import {Sentence, SrtSentence} from "@/common/types/SentenceC";
import hash from 'object-hash';
import {SubtitleTimestampAdjustment} from "@/backend/db/tables/subtitleTimestampAdjustment";
import SubtitleTimestampAdjustmentService from "@/backend/services/SubtitleTimestampAdjustmentService";

async function adjustTime(subtitles: Sentence[], hashCode: string) {
    const adjs = await SubtitleTimestampAdjustmentService.getByHash(hashCode)
    const mapping: Map<string, SubtitleTimestampAdjustment> = new Map();
    adjs.forEach((item) => {
        mapping.set(item.key, item);
    });
    subtitles.forEach((item) => {
        const key = item.key;
        const adj = mapping.get(key);
        if (adj) {
            if (
                Math.abs((adj.start_at ?? 0) - (item.currentBegin ?? 0)) > 0.05
            ) {
                item.originalBegin = item.currentBegin;
                item.currentBegin = adj.start_at ?? undefined;
            }

            if (Math.abs((adj.end_at ?? 0) - (item.currentEnd ?? 0)) > 0.05) {
                item.originalEnd = item.currentEnd;
                item.currentEnd = adj.end_at ?? undefined;
            }
        }
    });
}

function groupSentence(
    subtitle: Sentence[],
    batch: number,
    fieldConsumer: (s: Sentence, index: number) => void
) {
    const groups: Sentence[][] = [];
    let group: Sentence[] = [];
    subtitle.forEach((item) => {
        group.push(item);
        if (group.length >= batch) {
            groups.push(group);
            group = [];
        }
    });
    if (group.length > 0) {
        groups.push(group);
    }
    groups.forEach((item, index) => {
        item.forEach((s) => {
            fieldConsumer(s, index);
        });
    });
}

export default class SubtitleService {
    public static processSentences(sentences: string[]): SentenceStruct[] {
        return sentences.map(processSentence);
    }
    private static cache: { fileHash: string, value: SrtSentence } = {
        fileHash: '',
        value: null
    };

    static async parseSrt(path: string): Promise<SrtSentence> {
        if (!fs.existsSync(path)) {
            return null;
        }
        const content = fs.readFileSync(path, 'utf-8');
        console.log(content)
        const h = hash(content);
        if (this.cache.fileHash === h) {
            return this.cache.value;
        }
        const lines: SrtLine[] = SrtUtil.parseSrt(content);
        const subtitles = lines.map<Sentence>((line, index) => ({
            fileHash: h,
            index: index,
            indexInFile: line.index,
            currentBegin: line.start,
            currentEnd: line.end,
            text: line.contentEn,
            textZH: line.contentZh,
            msTranslate: null,
            originalBegin: null,
            originalEnd: null,
            nextBegin: null,
            key: `${h}-${index}`,
            transGroup: 0,
            struct: processSentence(line.contentEn)
        }));
        for (let i = 1; i < subtitles.length; i += 1) {
            subtitles[i - 1].nextBegin = subtitles[i].currentBegin;
            subtitles[i].nextBegin = subtitles[i].currentEnd;
        }
        await adjustTime(subtitles, h);
        groupSentence(subtitles, 20, (s, index) => {
            s.transGroup = index;
        });
        const res = {
            fileHash: h,
            filePath: path,
            sentences: subtitles,
        };
        this.cache.fileHash = h;
        this.cache.value = res;
        return res;
    }
}

interface TokenRes {
    word: string;
    implicit: string;
    pos: {
        start: number;
        length: number;
    };
}

function tokenizeAndProcess(text: string): TokenRes[] {
    const doc = nlp(text);
    const offset = doc.out('offset') as {
        terms: {
            text: string;
            implicit: string | undefined;
            offset: {
                start: number;
                length: number;
            }
        }[],
    }[];
    const temp: TokenRes[] = offset.map(e => e.terms ?? [])
        .flat()
        .map((e) => {
            return {
                word: e.text,
                implicit: e.implicit ?? e.text,
                pos: e.offset
            };
        });
    const res: TokenRes[] = [];
    console.log(JSON.stringify(temp, null, 2));
    for (const item of temp) {
        if (item.pos.length > 0) {
            res.push(item);
            continue;
        }
        const last = res.pop();
        // eg: i'm
        // 把last 按照 ' 分割, 第一个分给last, 第二个分给item
        if (!last) {
            continue;
        }
        const strings = last.word.split('\'');
        if (strings.length === 1) {
            continue;
        }
        last.word = strings[0];
        last.pos.length = last.word.length;
        item.word = strings[1] + item.word;
        item.pos.start -= strings[1].length;
        item.pos.length += strings[1].length;
        res.push(last);
        res.push(item);
    }
    return res;
}

function isWord(token: string) {
    const noWordRegex = /[^A-Za-z0-9-]/;
    return !noWordRegex.test(token);
}

class SentenceHolder {
    sentence: string;
    index: number;

    constructor(sentence: string) {
        this.sentence = sentence;
        this.index = 0;
    }

    /**
     * sentence 从start开始截取length长度的字符串, 并返回. 同时更新index
     *
     * @param start
     * @param length
     */
    sub(start: number, length: number) {
        const res = this.sentence.substring(start, start + length);
        this.index = start + length;
        return res;
    }

    subTo(index: number) {
        const res = this.sentence.substring(this.index, index);
        this.index = index;
        return res;
    }
}

const processSentence = (sentence: string): SentenceStruct => {
    const tokens = tokenizeAndProcess(sentence);
    const holder = new SentenceHolder(sentence);
    const blocks: SentenceBlockBySpace[] = [];
    let blockParts: SentenceBlockPart[] = [];
    for (const token of tokens) {
        console.log(token.pos);
        const pw = holder.subTo(token.pos.start);
        if (pw.length > 0) {
            if (strBlank(pw)) {
                if (blockParts.length > 0) {
                    blocks.push({blockParts});
                    blockParts = [];
                }
            } else {
                blockParts.push({
                    content: pw,
                    implicit: token.implicit,
                    isWord: false
                });
            }
        }

        const w = holder.sub(token.pos.start, token.pos.length);
        if (!strBlank(w)) {
            blockParts.push({
                content: w,
                implicit: token.implicit,
                isWord: isWord(w)
            });
        }
    }
    if (blockParts.length > 0) {
        blocks.push({blockParts});
    }
    return {
        original: sentence,
        blocks: blocks
    };
};
