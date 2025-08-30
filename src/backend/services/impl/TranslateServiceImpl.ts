// src/backend/services/AiTransServiceImpl.ts

import { inject, injectable } from 'inversify';
import {and, eq, inArray, isNotNull} from 'drizzle-orm';
import { z } from 'zod';
import { streamObject } from 'ai';

import TYPES from '@/backend/ioc/types';
import db from '@/backend/db';
import { SentenceTranslate, sentenceTranslates } from '@/backend/db/tables/sentenceTranslates';
import { WordTranslate, wordTranslates, InsertWordTranslate } from '@/backend/db/tables/wordTranslates';

import TimeUtil from '@/common/utils/TimeUtil';
import StrUtil from '@/common/utils/str-util';
import TransHolder from '@/common/utils/TransHolder';
import { p } from '@/common/utils/Util';
import { YdRes } from '@/common/types/YdRes';
import SubtitleService from '@/backend/services/SubtitleService';
import SystemService from '@/backend/services/SystemService';
import AiProviderService from '@/backend/services/AiProviderService';
import ClientProviderService from '@/backend/services/ClientProviderService';
import YouDaoClient from '@/backend/objs/YouDaoClient';
import TencentClient from '@/backend/objs/TencentClient';
import dpLog from '@/backend/ioc/logger';
import TranslateService from "@/backend/services/AiTransServiceImpl";
import {Sentence} from "@/common/types/SentenceC";
import CacheService from "@/backend/services/CacheService";

@injectable()
export default class TranslateServiceImpl implements TranslateService {
    @inject(TYPES.YouDaoClientProvider)
    private youDaoProvider!: ClientProviderService<YouDaoClient>;
    @inject(TYPES.TencentClientProvider)
    private tencentProvider!: ClientProviderService<TencentClient>;
    @inject(TYPES.SubtitleService)
    private subtitleService!: SubtitleService;
    @inject(TYPES.SystemService)
    private systemService!: SystemService;
    @inject(TYPES.AiProviderService)
    private aiProviderService!: AiProviderService;
    @inject(TYPES.CacheService)
    private cacheService!: CacheService;

    // --- 新版核心翻译逻辑 ---

    public async groupTranslate(params: {
        engine: 'tencent' | 'openai';
        fileHash: string;
        indices: number[];
        useCache?: boolean;
    }): Promise<void> {
        const { engine, fileHash, indices, useCache = true } = params;
        if (!indices || indices.length === 0) {
            return;
        }

        const srtData = this.cacheService.get('cache:srt', fileHash);
        if (!srtData || !srtData.sentences) {
            dpLog.error(`未找到 Hash 为 ${fileHash} 的字幕缓存`);
            return;
        }

        const allSentences = srtData.sentences;
        let sentencesToTranslate = indices.map(index => allSentences[index]).filter(s => s && s.text.trim() !== '');

        if (useCache) {
            const keysToLookup = sentencesToTranslate.map(s => s.translationKey);
            const cachedResults = await this.getTranslationsByKeys(keysToLookup);
            if (cachedResults.size > 0) {
                const cachedTranslations = Array.from(cachedResults.entries()).map(([key, translation]) => ({
                    key,
                    translation,
                    isComplete: true
                }));

                this.systemService.callRendererApi('translation/batch-result', {
                    translations: cachedTranslations
                });
                dpLog.log(`命中缓存并将 ${cachedTranslations.length} 条结果回传前端`);

                sentencesToTranslate = sentencesToTranslate.filter(s => !cachedResults.has(s.translationKey));
            }
        }

        if (sentencesToTranslate.length === 0) {
            dpLog.log('所有请求的句子均已处理（或命中缓存），任务完成。');
            return;
        }

        dpLog.log(`准备使用 ${engine} 翻译 ${sentencesToTranslate.length} 条句子`);
        if (engine === 'tencent') {
            await this.processTencentBatch(sentencesToTranslate);
        } else if (engine === 'openai') {
            await this.processOpenAIBatch(sentencesToTranslate, allSentences);
        }
    }

    private async processTencentBatch(tasks: Sentence[]): Promise<void> {
        const tencentClient = this.tencentProvider.getClient();
        if (!tencentClient) {
            dpLog.error('Tencent 翻译客户端未初始化');
            return;
        }

        const sentencesText = tasks.map(t => t.text);
        try {
            const translationMap = await tencentClient.batchTrans(sentencesText);
            const resultsToSave: Map<string, string> = new Map();
            const resultsToRender: Array<{ key: string, translation: string, isComplete: boolean }> = [];

            tasks.forEach(task => {
                const translation = translationMap.get(task.text) || '';
                // 仅当翻译结果非空时才处理
                if (translation) {
                    resultsToSave.set(task.translationKey, translation);
                    resultsToRender.push({ key: task.translationKey, translation, isComplete: true });
                }
            });

            if (resultsToRender.length > 0) {
                await this.saveTranslationsByKeys(resultsToSave);
                this.systemService.callRendererApi('translation/batch-result', {
                    translations: resultsToRender
                });
                dpLog.log(`腾讯翻译完成，成功回传并保存 ${resultsToRender.length} 条结果`);
            }
        } catch (error) {
            dpLog.error('腾讯批量翻译失败:', error);
        }
    }

    private async processOpenAIBatch(tasks: Sentence[], allSentences: Sentence[]): Promise<void> {
        const model = this.aiProviderService.getModel();
        if (!model) {
            dpLog.error('OpenAI 模型未配置');
            return;
        }

        const schema = z.object({
            translation: z.string().describe('The translated sentence in Simplified Chinese.')
        });

        const translationPromises = tasks.map(async (task) => {
            try {
                const currentIndex = task.index;
                const prevSentence = allSentences[currentIndex - 1]?.text || '';
                const nextSentence = allSentences[currentIndex + 1]?.text || '';
                const prompt = this.buildOpenAIPrompt(task.text, prevSentence, nextSentence);

                const { partialObjectStream } = streamObject({ model, schema, prompt });

                let finalTranslation = '';
                for await (const partialObject of partialObjectStream) {
                    if (partialObject.translation) {
                        finalTranslation = partialObject.translation;
                        this.systemService.callRendererApi('translation/batch-result', {
                            translations: [{ key: task.translationKey, translation: finalTranslation, isComplete: false }]
                        });
                    }
                }

                if (finalTranslation) {
                    this.systemService.callRendererApi('translation/batch-result', {
                        translations: [{ key: task.translationKey, translation: finalTranslation, isComplete: true }]
                    });
                    return { key: task.translationKey, translation: finalTranslation };
                }
            } catch (error) {
                dpLog.error(`OpenAI 翻译句子失败 (key: ${task.translationKey}):`, error);
            }
            return null;
        });

        const settledResults = await Promise.all(translationPromises);
        const resultsToSave = new Map<string, string>();
        settledResults.forEach(res => {
            if (res) {
                resultsToSave.set(res.key, res.translation);
            }
        });

        if (resultsToSave.size > 0) {
            await this.saveTranslationsByKeys(resultsToSave);
            dpLog.log(`OpenAI 翻译流程结束，已保存 ${resultsToSave.size} 条结果。`);
        }
    }

    private buildOpenAIPrompt(current: string, prev: string, next: string): string {
        return `You are a professional translator specializing in subtitles. Your task is to translate an English subtitle sentence into natural and fluent Simplified Chinese.
        Pay close attention to the surrounding context to ensure the translation is accurate and context-aware.

        Previous sentence: "${prev || '(None)'}"
        Next sentence: "${next || '(None)'}"

        Translate ONLY the following sentence:
        "${current}"`;
    }

    // --- 数据库与缓存操作 ---

    public async getTranslationsByKeys(keys: string[]): Promise<Map<string, string>> {
        const result = new Map<string, string>();
        if (!keys || keys.length === 0) return result;

        try {
            const values: SentenceTranslate[] = await db
                .select()
                .from(sentenceTranslates)
                .where(inArray(sentenceTranslates.sentence, keys.map(k => p(k))));

            values.forEach(v => {
                if (v.sentence && !StrUtil.isBlank(v.translate)) {
                    result.set(v.sentence, v.translate!);
                }
            });
        } catch (error) {
            dpLog.error('批量获取翻译缓存失败:', error);
        }
        return result;
    }

    public async saveTranslationsByKeys(translations: Map<string, string>): Promise<void> {
        if (!translations || translations.size === 0) return;

        const promises = Array.from(translations.entries()).map(([key, translation]) =>
            db.insert(sentenceTranslates)
                .values({ sentence: p(key), translate: translation })
                .onConflictDoUpdate({
                    target: sentenceTranslates.sentence,
                    set: {
                        translate: translation,
                        updated_at: TimeUtil.timeUtc()
                    }
                })
        );

        try {
            await Promise.all(promises);
        } catch (error) {
            dpLog.error('批量保存翻译结果失败:', error);
        }
    }


    // --- 保留的旧方法 (兼容旧版或特定功能) ---

    public async transWord(str: string): Promise<YdRes | null> {
        const cacheRes = await this.wordLoad(str);
        if (cacheRes) {
            dpLog.log('命中单词缓存:', cacheRes);
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

    /**
     * @deprecated 请使用 groupTranslate 替代。此方法基于句子原文，而非哈希key。
     */
    public async transSentences(sentences: string[]): Promise<Map<string, string>> {
        const processedSentences = sentences.map((s) => p(s));
        const cache: TransHolder<string> = await this.sentenceLoadBatch(processedSentences);
        dpLog.log('旧版句子翻译-缓存命中:', cache.getMapping());

        const retries = processedSentences.filter((e) => !cache.get(e));
        dpLog.log('旧版句子翻译-需要在线翻译:', retries);

        if (retries.length === 0) {
            return cache.getMapping();
        }

        try {
            const tencentClient = this.tencentProvider.getClient();
            if (!tencentClient) {
                return cache.getMapping();
            }
            const transResult: TransHolder<string> = await tencentClient.batchTrans(retries);
            await this.sentenceRecordBatch(transResult);
            return cache.merge(transResult).getMapping();
        } catch (e) {
            dpLog.error('旧版 transSentences 失败:', e);
            return cache.getMapping();
        }
    }

    private async wordLoad(word: string): Promise<YdRes | undefined> {
        const value: WordTranslate[] = await db
            .select()
            .from(wordTranslates)
            .where(eq(wordTranslates.word, p(word)))
            .limit(1);

        if (value.length === 0) return undefined;

        const trans = value[0].translate;
        return StrUtil.isBlank(trans) ? undefined : JSON.parse(trans ?? '');
    }

    private async wordRecord(word: string, translate: YdRes): Promise<void> {
        const value = JSON.stringify(translate);
        const wt: InsertWordTranslate = { word: p(word), translate: value };
        await db
            .insert(wordTranslates)
            .values(wt)
            .onConflictDoUpdate({
                target: wordTranslates.word,
                set: { translate: wt.translate, updated_at: TimeUtil.timeUtc() }
            });
    }

    private async sentenceLoadBatch(sentences: string[]): Promise<TransHolder<string>> {
        const result = new TransHolder<string>();
        if (sentences.length === 0) return result;

        const values: SentenceTranslate[] = await db
            .select()
            .from(sentenceTranslates)
            .where(
                and(
                    inArray(sentenceTranslates.sentence, sentences.map(w => p(w))),
                    isNotNull(sentenceTranslates.translate)
                )
            );

        values
            .filter((e) => e.sentence && !StrUtil.isBlank(e.translate))
            .forEach((e) => {
                result.add(e.sentence!, e.translate!);
            });

        return result;
    }

    private async sentenceRecordBatch(validTrans: TransHolder<string>): Promise<void> {
        const promises = [];
        for (const [key, value] of validTrans.getMapping().entries()) {
            const promise = db
                .insert(sentenceTranslates)
                .values({ sentence: p(key), translate: value })
                .onConflictDoUpdate({
                    target: sentenceTranslates.sentence,
                    set: { translate: value }
                });
            promises.push(promise);
        }
        await Promise.all(promises);
    }

    public async testTencentTranslation(): Promise<void> {
        dpLog.log('🧪 开始测试腾讯翻译API...');
        try {
            const testSentences = ['Hello world', 'How are you?', 'This is a test.'];
            dpLog.log(`📝 测试句子: ${JSON.stringify(testSentences)}`);
            const result = await this.transSentences(testSentences);
            dpLog.log(`🌐 腾讯翻译结果:`, result);
            if(result.size === testSentences.length) {
                dpLog.log('✅ 腾讯翻译测试通过！');
            } else {
                dpLog.warn('⚠️ 腾讯翻译测试部分失败或未返回所有结果。');
            }
        } catch (error) {
            dpLog.error('❌ 腾讯翻译测试失败:', error);
        }
    }

    public getTencentClient(): TencentClient | null {
        return this.tencentProvider.getClient();
    }
}
