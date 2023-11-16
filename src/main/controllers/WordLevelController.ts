// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import TransApi from '../ServerLib/TransApi';
import { WordLevel } from '../../db/entity/WordLevel';
import WordLevelService, {
    Pagination,
} from '../../db/service/WordLevelService';
import { p } from '../../utils/Util';
import StemLevelService from '../../db/service/StemLevelService';

export async function markWordLevel(
    word: string,
    familiar: boolean
): Promise<void> {
    console.log('markWordLevel', word, familiar);
    await StemLevelService.recordStem(word, familiar);
}

export interface WordLevelRes {
    word: string;
    familiar: boolean;
    translate: string;
}

async function fillStem(
    words: string[],
    tempWordMapping: Map<string, WordLevel>
) {
    const stemFamiliarMapping = await StemLevelService.queryStems(words);
    console.log('fillStem', stemFamiliarMapping);
    const res = new Map<string, WordLevelRes>();
    words.forEach((item) => {
        res.set(item, {
            word: item,
            familiar: stemFamiliarMapping.get(p(item)) ?? false,
            translate: tempWordMapping.get(p(item))?.translate ?? '',
        });
    });
    return res;
}

/**
 * 单词翻译
 */
export async function wordsTranslate(
    words: string[]
): Promise<Map<string, WordLevelRes>> {
    // eslint-disable-next-line no-param-reassign
    words = words.map((w) => p(w));
    const tempWordMapping = await WordLevelService.queryWords(words);
    const needTrans = new Set<string>();
    words.forEach((item) => {
        if (!tempWordMapping.has(item)) {
            needTrans.add(item);
        }
    });
    tempWordMapping.forEach((v) => {
        if (!v.translate || v.translate === '') {
            if (v.word) {
                needTrans.add(v.word);
            }
        }
    });

    if (needTrans.size === 0) {
        console.log('fillStem', words, tempWordMapping);
        return fillStem(words, tempWordMapping);
    }

    const transRes: Map<string, string> = (
        await TransApi.batchTrans2(Array.from(needTrans))
    ).getMapping();
    transRes.forEach(async (v, k) => {
        console.log('recordWordTranslate sss', k, v);
        await WordLevelService.recordWordTranslate(k, v);
        await StemLevelService.tryAddStem(k);
    });
    await StemLevelService.queryStems(words);
    return fillStem(words, tempWordMapping);
}

export async function listWordsLevel(
    whereSql: string,
    orderBySql: string,
    perPage: number,
    currentPage: number
): Promise<Pagination<WordLevel>> {
    return WordLevelService.list(whereSql, orderBySql, perPage, currentPage);
}

export async function updateWordsLevel(words: WordLevel[]): Promise<void> {
    await WordLevelService.batchUpdate(words);
}
