// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { IWithPagination } from 'knex-paginate';
import TransApi from '../ServerLib/TransApi';
import { WordLevel } from '../../db/entity/WordLevel';
import WordLevelService, { Pagination } from '../../db/service/WordLevelService';
import { p } from '../../utils/Util';

export async function markWordLevel(
    word: string,
    level: number
): Promise<void> {
    console.log('markWordLevel', word, level);
    await WordLevelService.recordWordLevel(p(word), level);
}

/**
 * 单词翻译
 */
export async function wordsTranslate(
    words: string[]
): Promise<Map<string, WordLevel>> {
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
        return tempWordMapping;
    }

    const transRes: Map<string, string> = (
        await TransApi.batchTrans2(Array.from(needTrans))
    ).getMapping();
    transRes.forEach(async (v, k) => {
        await WordLevelService.recordWordTranslate(k, v);
    });

    return WordLevelService.queryWords(words);
}

export async function listWordsLevel(
    perPage: number,
    currentPage: number
): Promise<Pagination<WordLevel>> {
    return WordLevelService.list(perPage, currentPage);
}

export async function updateWordsLevel(words: WordLevel[]): Promise<void> {
    await WordLevelService.batchUpdate(words);
}
