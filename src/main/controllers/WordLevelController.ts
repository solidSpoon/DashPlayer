// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import TransApi from '../ServerLib/TransApi';

import { p } from '../../utils/Util';
import StemLevelService from '../../db/services/StemLevelService';
import WordLevelService from '../../db/services/WordLevelService';
import { WordView } from '../../db/tables/wordView';
import WordViewService, { Pagination } from '../../db/services/WordViewService';
import { IServerSideGetRowsRequest } from 'ag-grid-community';
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
    return new Map(
        [...tempWordMapping.entries()].map(([k, v]) => [
            k,
            {
                word: k,
                familiar: Boolean(v.familiar),
                translate: v.translate || '',
            },
        ])
    );
}

/**
 * 单词翻译
 */
export async function wordsTranslate(
    words: string[]
): Promise<Map<string, WordLevelRes>> {
    // eslint-disable-next-line no-param-reassign
    words = words.map((w) => p(w));
    const tempWordMapping = toRes(await WordViewService.queryWords(words));
    const needTrans = new Set<string>();

    // eslint-disable-next-line no-restricted-syntax
    for (const word of words) {
        const wordView = tempWordMapping.get(word);
        if (!wordView || !wordView.translate) {
            needTrans.add(word);
        }
    }

    if (needTrans.size > 0) {
        const transRes = (
            await TransApi.batchTrans2(Array.from(needTrans))
        ).getMapping();
        // eslint-disable-next-line no-restricted-syntax
        for (const [k, v] of transRes) {
            // eslint-disable-next-line no-await-in-loop
            await WordLevelService.recordWordTranslate(k, v);
            // eslint-disable-next-line no-await-in-loop
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

export class WordLevelController  {

     static async getRows(request: IServerSideGetRowsRequest): Promise<WordView[]> {
         return await WordViewService.getRows(request);
    }
}
