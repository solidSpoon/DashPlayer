import nlp from 'compromise/one';
import { SentenceBlockBySpace, SentenceBlockPart, SentenceStruct } from '@/common/types/SentenceStruct';
import StrUtil from '@/common/utils/str-util';
import fs from 'fs';
import SrtUtil, { SrtLine } from '@/common/utils/SrtUtil';
import { Sentence, SrtSentence } from '@/common/types/SentenceC';
import { inject, injectable } from 'inversify';
import SubtitleService from '@/backend/services/SubtitleService';
import TYPES from '@/backend/ioc/types';
import SrtTimeAdjustService from '@/backend/services/SrtTimeAdjustService';
import FileUtil from '@/backend/utils/FileUtil';
import CacheService from '@/backend/services/CacheService';
import { SubtitleTimestampAdjustment } from '@/backend/db/tables/subtitleTimestampAdjustment';
import { TypeGuards } from '@/backend/utils/TypeGuards';
import { ObjUtil } from '@/backend/utils/ObjUtil';


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

@injectable()
export class SubtitleServiceImpl implements SubtitleService {

    @inject(TYPES.SrtTimeAdjustService)
    private srtTimeAdjustService!: SrtTimeAdjustService;
    @inject(TYPES.CacheService)
    private cacheService!: CacheService;

    public async parseSrt(path: string): Promise<SrtSentence> {
        if (!fs.existsSync(path)) {
            throw new Error('file not exists');
        }
        const content = await FileUtil.read(path);
        TypeGuards.assertNotNull(content, 'read file error');
        console.log(content);
        const hashKey = ObjUtil.hash(content);
        const cache = this.cacheService.get('cache:srt', hashKey);
        if (cache) {
            const adjustedSentence = await this.adjustTime(cache.sentences, hashKey);
            return {
                fileHash: hashKey,
                filePath: path,
                sentences: adjustedSentence
            };
        }
        const lines: SrtLine[] = SrtUtil.parseSrt(content);
        const subtitles = lines.map<Sentence>((line, index) => ({
            fileHash: hashKey,
            index: index,
            start: line.start,
            end: line.end,
            adjustedStart: null,
            adjustedEnd: null,
            text: line.contentEn,
            textZH: line.contentZh,
            msTranslate: null,
            key: `${hashKey}-${index}`,
            transGroup: 0,
            struct: processSentence(line.contentEn)
        }));
        groupSentence(subtitles, 20, (s, index) => {
            s.transGroup = index;
        });
        const res = {
            fileHash: hashKey,
            filePath: path,
            sentences: subtitles
        };
        this.cacheService.set('cache:srt', hashKey, res);
        const adjustedSentence = await this.adjustTime(subtitles, hashKey);
        return {
            ...res,
            sentences: adjustedSentence
        };
    }


    private async adjustTime(subtitles: Sentence[], hashCode: string): Promise<Sentence[]> {
        const adjs = await this.srtTimeAdjustService.getByHash(hashCode);
        const mapping: Map<string, SubtitleTimestampAdjustment> = new Map();
        adjs.forEach((item) => {
            mapping.set(item.key, item);
        });
        return subtitles.map((item) => {
            const adj = mapping.get(item.key);
            if (!adj) {
                return item;
            }
            return {
                ...item,
                adjustedStart: adj.start_at,
                adjustedEnd: adj.end_at
            };
        });
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
        if (item.word.length === 0) {
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
    const regExp = /[A-Za-z]/;
    return regExp.test(token);
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
            if (StrUtil.isBlank(pw)) {
                if (blockParts.length > 0) {
                    blocks.push({ blockParts });
                    blockParts = [];
                }
            } else if (pw.includes(' ')) {
                if (blockParts.length > 0) {
                    blocks.push({ blockParts });
                    blockParts = [];
                }
                blockParts.push({
                    content: pw.trim(),
                    implicit: '',
                    isWord: false
                });
                blocks.push({ blockParts });
                blockParts = [];
            } else {
                blockParts.push({
                    content: pw,
                    implicit: token.implicit,
                    isWord: false
                });
            }
        }

        const w = holder.sub(token.pos.start, token.pos.length);
        if (!StrUtil.isBlank(w)) {
            blockParts.push({
                content: w,
                implicit: token.implicit,
                isWord: isWord(w)
            });
        }
    }
    if (blockParts.length > 0) {
        blocks.push({ blockParts });
    }
    return {
        original: sentence,
        blocks: blocks
    };
};
