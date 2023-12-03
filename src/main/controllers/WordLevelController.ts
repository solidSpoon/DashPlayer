// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import TransApi from '../ServerLib/TransApi';

import { p } from '../../utils/Util';
import StemLevelService from "../../db/services/StemLevelService";
import WordLevelService from "../../db/services/WordLevelService";


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

function toRes(
    tempWordMapping: Map<string, WordView>
): Map<string, WordLevelRes> {
    return new Map([...tempWordMapping.entries()].map(([k, v]) => [k, {
        word: k,
        familiar: Boolean(v.familiar),
        translate: v.translate || '',
    }]));
}

/**
 * 单词翻译
 */
export async function wordsTranslate(words: string[]): Promise<Map<string, WordLevelRes>> {
    words = words.map((w) => p(w));
    const tempWordMapping = toRes(await WordViewService.queryWords(words));
    const needTrans = new Set<string>();

    for (const word of words) {
        const wordView = tempWordMapping.get(word);
        if (!wordView || !wordView.translate) {
            needTrans.add(word);
        }
    }

    if (needTrans.size > 0) {
        const transRes = (await TransApi.batchTrans2(Array.from(needTrans))).getMapping();
        for (const [k, v] of transRes) {
            await WordLevelService.recordWordTranslate(k, v);
            await StemLevelService.tryAddStem(k);
        }
    }
    return toRes(await WordViewService.queryWords(words));
}

export async function listWordsView(
    whereSql: string,
    orderBySql: string,
    perPage: number,
    currentPage: number
): Promise<Pagination<WordView>> {
    return WordViewService.list(whereSql, orderBySql, perPage, currentPage);
}

export async function updateWordsView(words: WordView[]): Promise<void> {
    await WordViewService.batchUpdate(words);
}
