import { YdRes } from '@/common/types/YdRes';
import { p } from '@/common/utils/Util';
import TransHolder from '@/common/utils/TransHolder';
import dpLog from '@/backend/ioc/logger';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import ClientProviderService from '@/backend/services/ClientProviderService';
import TranslateService from '@/backend/services/AiTransServiceImpl';
import { InsertWordTranslate, WordTranslate, wordTranslates } from '@/backend/db/tables/wordTranslates';
import db from '@/backend/db';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import StrUtil from '@/common/utils/str-util';
import TimeUtil from '@/common/utils/TimeUtil';
import YouDaoClient from '@/backend/objs/YouDaoClient';
import TencentClient from '@/backend/objs/TencentClient';
import { SentenceTranslate, sentenceTranslates } from '@/backend/db/tables/sentenceTranslates';


@injectable()
export default class TranslateServiceImpl implements TranslateService {
    @inject(TYPES.YouDaoClientProvider)
    private youDaoProvider!: ClientProviderService<YouDaoClient>;
    @inject(TYPES.TencentClientProvider)
    private tencentProvider!: ClientProviderService<TencentClient>;

    public async transWord(str: string): Promise<YdRes | null> {
        const cacheRes = await this.wordLoad(str);
        if (cacheRes) {
            dpLog.log('cacheRes', cacheRes);
            return cacheRes;
        }
        const client = this.youDaoProvider.getClient();
        if (!client) {
            return null;
        }
        const onlineRes = await client.translate(str);
        if (!onlineRes) {
            return null;
        }
        const or = JSON.parse(onlineRes) as YdRes;
        await this.wordRecord(str, or);
        return or;
    }


    public async transSentences(
        sentences: string[]
    ): Promise<Map<string, string>> {
        // eslint-disable-next-line no-param-reassign
        sentences = sentences.map((s) => p(s));
        const cache: TransHolder<string> =
            await this.sentenceLoadBatch(sentences);
        dpLog.log('cache', cache.getMapping());
        const retries = sentences.filter((e) => !cache.get(e));
        dpLog.log('retries', retries);
        if (retries.length === 0) {
            return cache.getMapping();
        }
        try {
            const tencentClient = this.tencentProvider.getClient();
            if (!tencentClient) {
                return cache.getMapping();
            }
            const transResult: TransHolder<string> = await tencentClient.batchTrans(
                retries
            );
            await this.sentenceRecordBatch(transResult);
            return cache.merge(transResult).getMapping();
        } catch (e) {
            dpLog.error(e);
            return cache.getMapping();
        }
    }

    private async wordLoad(
        word: string
    ): Promise<YdRes | undefined> {
        const value: WordTranslate[] = await db
            .select()
            .from(wordTranslates)
            .where(eq(wordTranslates.word, p(word)))
            .limit(1);

        if (value.length === 0) {
            return undefined;
        }

        const trans = value[0].translate;
        if (StrUtil.isBlank(trans)) {
            return undefined;
        }
        return JSON.parse(trans ?? '') as YdRes;
    }

    private async wordRecord(word: string, translate: YdRes) {
        const value = JSON.stringify(translate);
        const wt: InsertWordTranslate = {
            word: p(word),
            translate: value
        };
        await db
            .insert(wordTranslates)
            .values(wt)
            .onConflictDoUpdate({
                target: wordTranslates.word,
                set: {
                    translate: wt.translate,
                    updated_at: TimeUtil.timeUtc()
                }
            });
    }

    private async sentenceLoadBatch(
        sentences: string[]
    ): Promise<TransHolder<string>> {
        sentences = [...sentences, '-1'];
        const result = new TransHolder<string>();
        const values: SentenceTranslate[] = await db
            .select()
            .from(sentenceTranslates)
            .where(
                and(inArray(
                    sentenceTranslates.sentence,
                    sentences.map((w) => p(w))
                ), isNotNull(sentenceTranslates.translate))
            );
        values
            .filter((e) => !StrUtil.isBlank(e.translate))
            .forEach((e) => {
                result.add(e.sentence ?? '', e.translate ?? '');
            });

        return result;
    }

    async sentenceRecordBatch(validTrans: TransHolder<string>) {
        validTrans.getMapping().forEach((value, key) => {
            (async function(sentence: string, translate: string) {
                await db
                    .insert(sentenceTranslates)
                    .values({
                        sentence: p(sentence),
                        translate
                    })
                    .onConflictDoUpdate({
                        target: sentenceTranslates.sentence,
                        set: {
                            translate
                        }
                    });
            })(p(key), value);
        });
    }
}
