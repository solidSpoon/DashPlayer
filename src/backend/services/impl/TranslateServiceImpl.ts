// src/backend/services/AiTransServiceImpl.ts

import { inject, injectable } from 'inversify';
import { z } from 'zod';
import { streamObject } from 'ai';

import TYPES from '@/backend/ioc/types';
import { SentenceTranslate } from '@/backend/infrastructure/db/tables/sentenceTranslates';
import { WordTranslate, InsertWordTranslate } from '@/backend/infrastructure/db/tables/wordTranslates';
import SentenceTranslatesRepository from '@/backend/infrastructure/db/repositories/SentenceTranslatesRepository';
import WordTranslatesRepository from '@/backend/infrastructure/db/repositories/WordTranslatesRepository';

import TimeUtil from '@/common/utils/TimeUtil';
import StrUtil from '@/common/utils/str-util';
import TransHolder from '@/common/utils/TransHolder';
import { p } from '@/common/utils/Util';
import { YdRes, OpenAIDictionaryResult, OpenAIDictionaryDefinition, OpenAIDictionaryExample } from '@/common/types/YdRes';
import RendererGateway from '@/backend/services/RendererGateway';
import AiProviderService from '@/backend/services/AiProviderService';
import ClientProviderService from '@/backend/services/ClientProviderService';
import SettingService from '@/backend/services/SettingService';
import YouDaoClient from '@/backend/objs/YouDaoClient';
import TencentClient from '@/backend/objs/TencentClient';
import dpLog from '@/backend/ioc/logger';
import TranslateService from "@/backend/services/AiTransServiceImpl";
import {Sentence} from "@/common/types/SentenceC";
import CacheService from "@/backend/services/CacheService";
import {
    fillSubtitlePrompt,
    getSubtitlePromptTemplate,
    resolveSubtitleStyleWithSignature
} from '@/common/constants/openaiSubtitlePrompts';
import { RendererTranslationItem, TranslationMode } from '@/common/types/TranslationResult';

const openAIDictionaryExampleSchema = z.object({
    sentence: z.string().describe('Example sentence in English'),
    translation: z.string().optional().describe('Translation of the example sentence in Simplified Chinese'),
    explanation: z.string().optional().describe('Usage notes or explanation in Simplified Chinese')
});

const openAIDictionaryDefinitionSchema = z.object({
    partOfSpeech: z.string().optional().describe('Part of speech, e.g. noun, verb, adjective'),
    meaning: z.string().optional().describe('Meaning or translation in Simplified Chinese'),
    explanation: z.string().optional().describe('Additional clarification in Simplified Chinese'),
    translationNote: z.string().optional().describe('Extra translation notes or nuances in Simplified Chinese'),
    synonyms: z.array(z.string()).optional().describe('Synonyms in English'),
    antonyms: z.array(z.string()).optional().describe('Antonyms in English'),
    relatedPhrases: z.array(z.string()).optional().describe('Common related phrases or collocations'),
    examples: z.array(openAIDictionaryExampleSchema).optional().describe('Examples illustrating this specific meaning')
});

const openAIDictionaryResultSchema = z.object({
    word: z.string().describe('The input word'),
    phonetic: z.string().optional().describe('International phonetic alphabet pronunciation'),
    ukPhonetic: z.string().optional().describe('UK pronunciation in IPA'),
    usPhonetic: z.string().optional().describe('US pronunciation in IPA'),
    definitions: z.array(openAIDictionaryDefinitionSchema).optional().describe('Array of structured definitions'),
    examples: z.array(openAIDictionaryExampleSchema).optional().describe('General example sentences with translations'),
    pronunciation: z.string().optional().describe('Pronunciation audio URL if available')
});

type SubtitleTranslationStorageMode = 'tencent' | `openai_${string}`;

type SubtitlePromptConfig = {
    template: string;
    style: string;
    styleSignature: string;
};

const mapOpenAiModeToStorage = (mode: TranslationMode, signature: string): SubtitleTranslationStorageMode => {
    const hashedSuffix = signature && signature.trim().length > 0 ? `#${signature}` : '';
    switch (mode) {
        case 'simple_en':
            return `openai_simple_en${hashedSuffix}`;
        case 'custom':
            return `openai_custom${hashedSuffix}`;
        case 'zh':
        default:
            return `openai_zh${hashedSuffix}`;
    }
};

const mapStorageModeToRendererFields = (
    storageMode: SubtitleTranslationStorageMode
): { provider: 'tencent' | 'openai'; mode: TranslationMode } => {
    if (storageMode === 'tencent') {
        return { provider: 'tencent', mode: 'zh' };
    }

    const [baseMode] = storageMode.split('#');
    switch (baseMode) {
        case 'openai_custom':
            return { provider: 'openai', mode: 'custom' };
        case 'openai_simple_en':
            return { provider: 'openai', mode: 'simple_en' };
        case 'openai_zh':
            return { provider: 'openai', mode: 'zh' };
        default:
            return { provider: 'openai', mode: 'zh' };
    }
};

const errorToBriefMessage = (error: unknown): string | undefined => {
    if (!error) {
        return undefined;
    }
    if (error instanceof Error) {
        return error.message?.trim() ? error.message.trim() : String(error);
    }
    if (typeof error === 'string') {
        return error.trim() ? error.trim() : undefined;
    }
    try {
        const asString = JSON.stringify(error);
        return asString && asString !== '{}' ? asString : String(error);
    } catch {
        return String(error);
    }
};

const truncate = (value: string, maxLength: number): string => {
    if (value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
};

const sanitizeString = (value?: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const sanitizePhonetic = (value?: unknown): string | undefined => {
    const trimmed = sanitizeString(value);
    if (!trimmed) {
        return undefined;
    }
    const core = trimmed.replace(/^\/+/, '').replace(/\/+$/, '');
    return core.length > 0 ? core : undefined;
};

const sanitizeStringArray = (value?: unknown): string[] | undefined => {
    if (!Array.isArray(value)) {
        return undefined;
    }
    const uniqueValues = new Set<string>();
    value.forEach((item) => {
        if (typeof item === 'string') {
            const trimmed = item.trim();
            if (trimmed) {
                uniqueValues.add(trimmed);
            }
        }
    });
    return uniqueValues.size > 0 ? Array.from(uniqueValues) : undefined;
};

const sanitizeExamples = (value?: unknown): OpenAIDictionaryExample[] | undefined => {
    if (!Array.isArray(value)) {
        return undefined;
    }

    const normalized: OpenAIDictionaryExample[] = value
        .map((example) => {
            if (!example || typeof example !== 'object') {
                return null;
            }
            const record = example as Record<string, unknown>;
            const sentence = sanitizeString(record.sentence);
            if (!sentence) {
                return null;
            }
            const translation = sanitizeString(record.translation);
            const explanation = sanitizeString(record.explanation);

            const normalizedExample: OpenAIDictionaryExample = { sentence };
            if (translation) {
                normalizedExample.translation = translation;
            }
            if (explanation) {
                normalizedExample.explanation = explanation;
            }
            return normalizedExample;
        })
        .filter((example): example is OpenAIDictionaryExample => example !== null);

    return normalized.length > 0 ? normalized : undefined;
};

const sanitizeDefinitions = (value?: unknown): OpenAIDictionaryDefinition[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((definition) => {
            if (!definition || typeof definition !== 'object') {
                return null;
            }

            const record = definition as Record<string, unknown>;
            const meaning = sanitizeString(record.meaning);
            if (!meaning) {
                return null;
            }

            const normalizedDefinition: OpenAIDictionaryDefinition = { meaning };

            const partOfSpeech = sanitizeString(record.partOfSpeech);
            if (partOfSpeech) {
                normalizedDefinition.partOfSpeech = partOfSpeech;
            }

            const explanation = sanitizeString(record.explanation);
            if (explanation) {
                normalizedDefinition.explanation = explanation;
            }

            const translationNote = sanitizeString(record.translationNote);
            if (translationNote) {
                normalizedDefinition.translationNote = translationNote;
            }

            const synonyms = sanitizeStringArray(record.synonyms);
            if (synonyms) {
                normalizedDefinition.synonyms = synonyms;
            }

            const antonyms = sanitizeStringArray(record.antonyms);
            if (antonyms) {
                normalizedDefinition.antonyms = antonyms;
            }

            const relatedPhrases = sanitizeStringArray(record.relatedPhrases);
            if (relatedPhrases) {
                normalizedDefinition.relatedPhrases = relatedPhrases;
            }

            const examples = sanitizeExamples(record.examples);
            if (examples) {
                normalizedDefinition.examples = examples;
            }

            return normalizedDefinition;
        })
        .filter((definition): definition is OpenAIDictionaryDefinition => definition !== null);
};

type OpenAIDictionaryResultLike = z.infer<typeof openAIDictionaryResultSchema> | OpenAIDictionaryResult;

const sanitizeDictionaryResult = (value: OpenAIDictionaryResultLike): OpenAIDictionaryResult => ({
    word: sanitizeString(value.word) ?? '',
    phonetic: sanitizePhonetic(value.phonetic),
    ukPhonetic: sanitizePhonetic(value.ukPhonetic),
    usPhonetic: sanitizePhonetic(value.usPhonetic),
    definitions: sanitizeDefinitions(value.definitions),
    examples: sanitizeExamples(value.examples),
    pronunciation: sanitizeString(value.pronunciation)
});

const deepEqual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

@injectable()
export default class TranslateServiceImpl implements TranslateService {
    @inject(TYPES.YouDaoClientProvider)
    private youDaoProvider!: ClientProviderService<YouDaoClient>;
    @inject(TYPES.TencentClientProvider)
    private tencentProvider!: ClientProviderService<TencentClient>;
    @inject(TYPES.RendererGateway)
    private rendererGateway!: RendererGateway;
    @inject(TYPES.AiProviderService)
    private aiProviderService!: AiProviderService;
    @inject(TYPES.CacheService)
    private cacheService!: CacheService;
    @inject(TYPES.SettingService)
    private settingService!: SettingService;
    @inject(TYPES.WordTranslatesRepository)
    private wordTranslatesRepository!: WordTranslatesRepository;
    @inject(TYPES.SentenceTranslatesRepository)
    private sentenceTranslatesRepository!: SentenceTranslatesRepository;

    private showSubtitleTranslationToast(params: {
        message: string;
        title?: string;
        variant?: 'default' | 'success' | 'info' | 'warning' | 'error';
        dedupeKey: string;
        error?: unknown;
    }): void {
        const errorMessage = errorToBriefMessage(params.error);
        const combinedMessage = errorMessage
            ? truncate(`${params.message}（${errorMessage}）`, 220)
            : params.message;

        this.rendererGateway.fireAndForget('ui/show-toast', {
            title: params.title ?? '字幕翻译失败',
            message: combinedMessage,
            variant: params.variant ?? 'error',
            position: 'top-left',
            bubble: true,
            dedupeKey: params.dedupeKey,
            duration: 6500,
        });
    }

    public async groupTranslate(params: {
        fileHash: string;
        indices: number[];
        useCache?: boolean;
    }): Promise<void> {
        const { fileHash, indices, useCache = true } = params;
        if (!indices || indices.length === 0) {
            return;
        }

        const engine = await this.settingService.getCurrentTranslationProvider();
        if (!engine) {
            dpLog.error('没有启用的翻译服务');
            this.showSubtitleTranslationToast({
                message: '未启用字幕翻译服务，请在设置中配置后重试',
                dedupeKey: 'subtitle-translation:engine-not-enabled',
            });
            return;
        }
        const openAiMode: TranslationMode | null = engine === 'openai'
            ? await this.settingService.getOpenAiSubtitleTranslationMode()
            : null;
        let promptConfig: SubtitlePromptConfig | null = null;
        let storageMode: SubtitleTranslationStorageMode = 'tencent';

        if (engine === 'openai' && openAiMode) {
            promptConfig = await this.resolveOpenAiPromptConfig(openAiMode);
            storageMode = mapOpenAiModeToStorage(openAiMode, promptConfig.styleSignature);
        }

        const srtData = this.cacheService.get('cache:srt', fileHash);
        if (!srtData || !srtData.sentences) {
            dpLog.error(`未找到 Hash 为 ${fileHash} 的字幕缓存`);
            this.showSubtitleTranslationToast({
                message: '未找到字幕缓存，请重新加载字幕或重新打开视频后再试',
                dedupeKey: `subtitle-translation:missing-srt-cache:${fileHash}`,
            });
            return;
        }

        const allSentences = srtData.sentences;
        let sentencesToTranslate = indices.map(index => allSentences[index]).filter(s => s && s.text.trim() !== '');

        if (useCache) {
            const keysToLookup = sentencesToTranslate.map(s => s.translationKey);
            const cachedResults = await this.getTranslationsByKeys(keysToLookup, storageMode);
            if (cachedResults.size > 0) {
                const rendererMeta = mapStorageModeToRendererFields(storageMode);
                const cachedTranslations: RendererTranslationItem[] = Array.from(cachedResults.entries()).map(([key, translation]) => ({
                    key,
                    translation,
                    provider: rendererMeta.provider,
                    mode: rendererMeta.mode,
                    isComplete: true
                }));

                this.rendererGateway.fireAndForget('translation/batch-result', {
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
            await this.processTencentBatch(sentencesToTranslate, storageMode);
        } else if (engine === 'openai') {
            if (!openAiMode || !promptConfig) {
                dpLog.error('OpenAI 翻译配置缺失，无法执行翻译');
                this.showSubtitleTranslationToast({
                    message: 'OpenAI 字幕翻译配置缺失，请检查设置',
                    dedupeKey: 'subtitle-translation:openai-config-missing',
                });
                return;
            }
            await this.processOpenAIBatch(sentencesToTranslate, allSentences, storageMode, openAiMode, promptConfig);
        }
    }

    private async processTencentBatch(tasks: Sentence[], storageMode: SubtitleTranslationStorageMode): Promise<void> {
        const currentProvider = await this.settingService.getCurrentTranslationProvider();
        if (currentProvider !== 'tencent') {
            dpLog.error('腾讯翻译服务未启用');
            this.showSubtitleTranslationToast({
                message: '腾讯字幕翻译未启用，请检查设置',
                dedupeKey: 'subtitle-translation:tencent-not-enabled',
            });
            return;
        }

        const tencentClient = this.tencentProvider.getClient();
        if (!tencentClient) {
            dpLog.error('Tencent 翻译客户端未初始化');
            this.showSubtitleTranslationToast({
                message: '腾讯翻译客户端未初始化，请检查密钥配置',
                dedupeKey: 'subtitle-translation:tencent-client-not-ready',
            });
            return;
        }

        const sentencesText = tasks.map(t => t.text);
        try {
            const translationMap = await tencentClient.batchTrans(sentencesText);
            const resultsToSave: Map<string, string> = new Map();
            const resultsToRender: RendererTranslationItem[] = [];
            const rendererMeta = mapStorageModeToRendererFields(storageMode);

            tasks.forEach(task => {
                const translation = translationMap.get(task.text) || '';
                // 仅当翻译结果非空时才处理
                if (translation) {
                    resultsToSave.set(task.translationKey, translation);
                    resultsToRender.push({
                        key: task.translationKey,
                        translation,
                        provider: rendererMeta.provider,
                        mode: rendererMeta.mode,
                        isComplete: true
                    });
                }
            });

            if (resultsToRender.length > 0) {
                await this.saveTranslationsByKeys(resultsToSave, storageMode);
                this.rendererGateway.fireAndForget('translation/batch-result', {
                    translations: resultsToRender
                });
                dpLog.log(`腾讯翻译完成，成功回传并保存 ${resultsToRender.length} 条结果`);
            } else {
                this.showSubtitleTranslationToast({
                    message: '腾讯字幕翻译未返回有效结果，请稍后重试或检查服务配置',
                    dedupeKey: 'subtitle-translation:tencent-empty-result',
                });
            }
        } catch (error) {
            dpLog.error('腾讯批量翻译失败:', error);
            this.showSubtitleTranslationToast({
                message: '腾讯字幕翻译请求失败',
                dedupeKey: 'subtitle-translation:tencent-request-failed',
                error,
            });
        }
    }

    private async processOpenAIBatch(
        tasks: Sentence[],
        allSentences: Sentence[],
        storageMode: SubtitleTranslationStorageMode,
        openAiMode: TranslationMode,
        promptConfig: SubtitlePromptConfig
    ): Promise<void> {
        const currentProvider = await this.settingService.getCurrentTranslationProvider();
        if (currentProvider !== 'openai') {
            dpLog.error('OpenAI 翻译服务未启用');
            this.showSubtitleTranslationToast({
                message: 'OpenAI 字幕翻译未启用，请检查设置',
                dedupeKey: 'subtitle-translation:openai-not-enabled',
            });
            return;
        }

        const model = this.aiProviderService.getModel();
        if (!model) {
            dpLog.error('OpenAI 模型未配置');
            this.showSubtitleTranslationToast({
                message: 'OpenAI 模型未配置，请在设置中选择模型/填写 Key',
                dedupeKey: 'subtitle-translation:openai-model-missing',
            });
            return;
        }

        const schema = this.buildOpenAISchema(openAiMode);

        let failedCount = 0;
        let firstError: unknown = null;
        const translationPromises = tasks.map(async (task) => {
            try {
                const currentIndex = task.index;
                const prevSentence = allSentences[currentIndex - 1]?.text || '';
                const nextSentence = allSentences[currentIndex + 1]?.text || '';
                const prompt = this.buildOpenAIPrompt(task.text, prevSentence, nextSentence, promptConfig);

                const { partialObjectStream } = streamObject({ model, schema, prompt });

                let finalTranslation = '';
                for await (const partialObject of partialObjectStream) {
                    if (partialObject.translation) {
                        finalTranslation = partialObject.translation;
                        this.rendererGateway.fireAndForget('translation/batch-result', {
                            translations: [{
                                key: task.translationKey,
                                translation: finalTranslation,
                                provider: 'openai',
                                mode: openAiMode,
                                isComplete: false
                            }]
                        });
                    }
                }

                if (finalTranslation) {
                    this.rendererGateway.fireAndForget('translation/batch-result', {
                        translations: [{
                            key: task.translationKey,
                            translation: finalTranslation,
                            provider: 'openai',
                            mode: openAiMode,
                            isComplete: true
                        }]
                    });
                    return { key: task.translationKey, translation: finalTranslation };
                }
                failedCount += 1;
                if (!firstError) {
                    firstError = new Error('empty translation');
                }
            } catch (error) {
                dpLog.error(`OpenAI 翻译句子失败 (key: ${task.translationKey}):`, error);
                failedCount += 1;
                if (!firstError) {
                    firstError = error;
                }
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
            await this.saveTranslationsByKeys(resultsToSave, storageMode);
            dpLog.log(`OpenAI 翻译流程结束，已保存 ${resultsToSave.size} 条结果。`);
        }

        if (failedCount > 0) {
            this.showSubtitleTranslationToast({
                message: `OpenAI 字幕翻译失败 ${failedCount}/${tasks.length} 条`,
                dedupeKey: `subtitle-translation:openai-batch-failed:${openAiMode}`,
                error: firstError,
            });
        }
    }

    private buildOpenAISchema(mode: TranslationMode) {
        const description = (() => {
            switch (mode) {
                case 'zh':
                    return 'The translated sentence in Simplified Chinese.';
                case 'simple_en':
                    return 'The simplified English sentence that preserves the original wording order and punctuation.';
                case 'custom':
                default:
                    return 'The generated text produced according to the custom subtitle prompt.';
            }
        })();

        return z.object({
            translation: z.string().describe(description)
        });
    }

    private async resolveOpenAiPromptConfig(mode: TranslationMode): Promise<SubtitlePromptConfig> {
        const template = getSubtitlePromptTemplate();
        if (mode === 'custom') {
            const styleOverride = await this.settingService.getOpenAiSubtitleCustomStyle();
            const { style, signature } = resolveSubtitleStyleWithSignature(mode, styleOverride);
            return { template, style, styleSignature: signature };
        }
        const { style, signature } = resolveSubtitleStyleWithSignature(mode);
        return { template, style, styleSignature: signature };
    }

    private buildOpenAIPrompt(current: string, prev: string, next: string, config: SubtitlePromptConfig): string {
        return fillSubtitlePrompt(config.template, {
            current,
            prev,
            next,
            style: config.style
        });
    }

    // --- 数据库与缓存操作 ---

    public async getTranslationsByKeys(keys: string[], mode: SubtitleTranslationStorageMode): Promise<Map<string, string>> {
        const result = new Map<string, string>();
        if (!keys || keys.length === 0) return result;

        try {
            const values: SentenceTranslate[] = await this.sentenceTranslatesRepository.findBySentencesAndMode(keys, mode);

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

    public async saveTranslationsByKeys(translations: Map<string, string>, mode: SubtitleTranslationStorageMode): Promise<void> {
        if (!translations || translations.size === 0) return;

        const params = Array.from(translations.entries()).map(([key, translation]) => ({
            sentence: key,
            translate: translation,
            mode,
            updated_at: TimeUtil.timeUtc()
        }));

        try {
            await this.sentenceTranslatesRepository.upsertMany(params);
        } catch (error) {
            dpLog.error('批量保存翻译结果失败:', error);
        }
    }


    // --- 保留的旧方法 (兼容旧版或特定功能) ---

    public async transWord(
        str: string,
        forceRefresh?: boolean,
        requestId?: string
    ): Promise<YdRes | OpenAIDictionaryResult | null> {
        const currentProvider = await this.settingService.getCurrentDictionaryProvider();

        if (!currentProvider) {
            dpLog.log('没有启用的字典服务');
            return null;
        }

        // 如果不是强制刷新，先检查缓存
        if (!forceRefresh) {
            const cacheRes = await this.wordLoad(str, currentProvider);
            if (cacheRes) {
                dpLog.log(`命中${currentProvider}单词缓存:`, cacheRes);
                return cacheRes;
            }
        } else {
            dpLog.log(`强制刷新${currentProvider}单词:`, str);
        }

        if (currentProvider === 'youdao') {
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
        } else if (currentProvider === 'openai') {
            return await this.translateWordWithOpenAI(str, requestId);
        }

        return null;
    }

    private async translateWordWithOpenAI(word: string, requestId?: string): Promise<OpenAIDictionaryResult | null> {
        const streamId = requestId ?? `openai-dict-${Date.now()}-${word}`;

        try {
            const model = this.aiProviderService.getModel();
            if (!model) {
                dpLog.error('OpenAI 模型未配置');
                return null;
            }

            const prompt = `You are a professional English-Chinese dictionary. Provide thorough, structured dictionary information for the word "${word}".

Requirements:
1. Always respond in Simplified Chinese where appropriate (meanings, explanations, translations).
2. Provide phonetic transcription (IPA) and UK/US variations if they differ.
3. For each sense, include part of speech (if known), concise meaning (Simplified Chinese), optional explanation, helpful translation notes, and any useful synonyms/antonyms/related phrases (in English).
4. Attach up to 2 short example sentences for each sense. Each example must include the original English sentence AND a natural Simplified Chinese translation. Add a brief Chinese explanation if helpful.
5. Optionally provide up to 2 additional overall usage examples with translations if they add value.

Ensure the response strictly matches the provided JSON schema.`;

            const { partialObjectStream } = streamObject({
                model,
                schema: openAIDictionaryResultSchema,
                prompt
            });

            const aggregated: OpenAIDictionaryResult = {
                word: sanitizeString(word) ?? word,
                definitions: []
            };
            let hasStreamed = false;

            for await (const partialObject of partialObjectStream) {
                let changed = false;

                if (partialObject.word !== undefined) {
                    const sanitizedWord = sanitizeString(partialObject.word) ?? aggregated.word;
                    if (sanitizedWord !== aggregated.word) {
                        aggregated.word = sanitizedWord;
                        changed = true;
                    }
                }

                if (partialObject.phonetic !== undefined) {
                    const sanitizedPhoneticValue = sanitizePhonetic(partialObject.phonetic);
                    if (sanitizedPhoneticValue !== aggregated.phonetic) {
                        aggregated.phonetic = sanitizedPhoneticValue;
                        changed = true;
                    }
                }

                if (partialObject.ukPhonetic !== undefined) {
                    const sanitizedUkPhonetic = sanitizePhonetic(partialObject.ukPhonetic);
                    if (sanitizedUkPhonetic !== aggregated.ukPhonetic) {
                        aggregated.ukPhonetic = sanitizedUkPhonetic;
                        changed = true;
                    }
                }

                if (partialObject.usPhonetic !== undefined) {
                    const sanitizedUsPhonetic = sanitizePhonetic(partialObject.usPhonetic);
                    if (sanitizedUsPhonetic !== aggregated.usPhonetic) {
                        aggregated.usPhonetic = sanitizedUsPhonetic;
                        changed = true;
                    }
                }

                if (partialObject.pronunciation !== undefined) {
                    const sanitizedPronunciation = sanitizeString(partialObject.pronunciation);
                    if (sanitizedPronunciation !== aggregated.pronunciation) {
                        aggregated.pronunciation = sanitizedPronunciation;
                        changed = true;
                    }
                }

                if (partialObject.definitions !== undefined) {
                    const sanitizedDefinitions = sanitizeDefinitions(partialObject.definitions);
                    if (!deepEqual(sanitizedDefinitions, aggregated.definitions)) {
                        aggregated.definitions = sanitizedDefinitions;
                        changed = true;
                    }
                }

                if (partialObject.examples !== undefined) {
                    const sanitizedExamples = sanitizeExamples(partialObject.examples);
                    if (!deepEqual(sanitizedExamples, aggregated.examples)) {
                        aggregated.examples = sanitizedExamples;
                        changed = true;
                    }
                }

                if (changed && requestId) {
                    await this.emitOpenAIDictionaryUpdate(streamId, aggregated.word, sanitizeDictionaryResult(aggregated), false);
                    hasStreamed = true;
                }
            }

            const finalResult = sanitizeDictionaryResult(aggregated);

            if (finalResult.definitions.length > 0) {
                if (requestId) {
                    await this.emitOpenAIDictionaryUpdate(streamId, finalResult.word, finalResult, true);
                }
                await this.wordRecordOpenAI(word, finalResult);
                return finalResult;
            }

            if (hasStreamed && requestId) {
                await this.emitOpenAIDictionaryUpdate(streamId, finalResult.word, finalResult, true);
            }

            return null;
        } catch (error) {
            dpLog.error(`OpenAI 字典查询失败 (word: ${word}):`, error);
            if (requestId) {
                try {
                    await this.emitOpenAIDictionaryUpdate(
                        streamId,
                        sanitizeString(word) ?? word,
                        { word: sanitizeString(word) ?? word, definitions: [] },
                        true
                    );
                } catch (emitError) {
                    dpLog.error('Failed to notify renderer about OpenAI dictionary error', emitError);
                }
            }
            return null;
        }
    }

    private async emitOpenAIDictionaryUpdate(
        requestId: string,
        word: string,
        data: OpenAIDictionaryResult,
        isComplete: boolean
    ): Promise<void> {
        const cloneExamples = (examples?: OpenAIDictionaryExample[]): OpenAIDictionaryExample[] | undefined => {
            if (!examples) {
                return undefined;
            }
            return examples.map(example => ({
                sentence: example.sentence,
                translation: example.translation,
                explanation: example.explanation
            }));
        };

        const payload: OpenAIDictionaryResult = {
            word: data.word,
            phonetic: data.phonetic,
            ukPhonetic: data.ukPhonetic,
            usPhonetic: data.usPhonetic,
            definitions: data.definitions.map(def => ({
                partOfSpeech: def.partOfSpeech,
                meaning: def.meaning,
                explanation: def.explanation,
                translationNote: def.translationNote,
                synonyms: def.synonyms ? [...def.synonyms] : undefined,
                antonyms: def.antonyms ? [...def.antonyms] : undefined,
                relatedPhrases: def.relatedPhrases ? [...def.relatedPhrases] : undefined,
                examples: cloneExamples(def.examples)
            })),
            examples: cloneExamples(data.examples),
            pronunciation: data.pronunciation
        };

        try {
            await this.rendererGateway.call('dictionary/openai-update', {
                requestId,
                word,
                data: payload,
                isComplete
            });
        } catch (error) {
            dpLog.error('发送 OpenAI 字典流式更新失败', { requestId, word, error });
        }
    }

    /**
     * @deprecated 请使用 groupTranslate 替代。此方法基于句子原文，而非哈希key。
     */
    public async transSentences(sentences: string[]): Promise<Map<string, string>> {
        const processedSentences = sentences.map((s) => p(s));
        const currentProvider = await this.settingService.getCurrentTranslationProvider();
        let openAiMode: TranslationMode | null = null;
        let storageMode: SubtitleTranslationStorageMode = 'tencent';
        let promptConfig: SubtitlePromptConfig | null = null;

        if (currentProvider === 'openai') {
            openAiMode = await this.settingService.getOpenAiSubtitleTranslationMode();
            if (openAiMode) {
                promptConfig = await this.resolveOpenAiPromptConfig(openAiMode);
                storageMode = mapOpenAiModeToStorage(openAiMode, promptConfig.styleSignature);
            }
        } else if (currentProvider === 'tencent') {
            storageMode = 'tencent';
        }

        const cache: TransHolder<string> = await this.sentenceLoadBatch(processedSentences, storageMode);
        dpLog.log('旧版句子翻译-缓存命中:', cache.getMapping());

        const retries = processedSentences.filter((e) => !cache.get(e));
        dpLog.log('旧版句子翻译-需要在线翻译:', retries);

        if (retries.length === 0) {
            return cache.getMapping();
        }

        try {
            if (!currentProvider) {
                dpLog.log('没有启用的翻译服务');
                return cache.getMapping();
            }

            if (currentProvider === 'tencent') {
                const tencentClient = this.tencentProvider.getClient();
                if (!tencentClient) {
                    return cache.getMapping();
                }
                const transResult: TransHolder<string> = await tencentClient.batchTrans(retries);
                await this.sentenceRecordBatch(transResult, storageMode);
                return cache.merge(transResult).getMapping();
            } else if (currentProvider === 'openai') {
                if (!openAiMode || !promptConfig) {
                    dpLog.error('OpenAI 翻译配置缺失，无法执行旧版翻译流程');
                    return cache.getMapping();
                }
                const transResult = await this.processOpenAIBatchLegacy(retries, openAiMode, promptConfig);
                await this.sentenceRecordBatch(transResult, storageMode);
                return cache.merge(transResult).getMapping();
            }
        } catch (e) {
            dpLog.error('旧版 transSentences 失败:', e);
            return cache.getMapping();
        }
        return cache.getMapping();
    }

    private async processOpenAIBatchLegacy(
        sentences: string[],
        openAiMode: TranslationMode,
        promptConfig: SubtitlePromptConfig
    ): Promise<TransHolder<string>> {
        const result = new TransHolder<string>();
        const model = this.aiProviderService.getModel();
        if (!model) {
            dpLog.error('OpenAI 模型未配置');
            return result;
        }

        const schema = this.buildOpenAISchema(openAiMode);

        const translationPromises = sentences.map(async (sentence) => {
            try {
                const prompt = this.buildOpenAIPrompt(sentence, '', '', promptConfig);
                const { partialObjectStream } = streamObject({ model, schema, prompt });

                let finalTranslation = '';
                for await (const partialObject of partialObjectStream) {
                    if (partialObject.translation) {
                        finalTranslation = partialObject.translation;
                    }
                }

                if (finalTranslation) {
                    return { sentence, translation: finalTranslation };
                }
            } catch (error) {
                dpLog.error(`OpenAI 翻译句子失败 (sentence: ${sentence}):`, error);
            }
            return null;
        });

        const settledResults = await Promise.all(translationPromises);
        settledResults.forEach(res => {
            if (res) {
                result.add(res.sentence, res.translation);
            }
        });

        return result;
    }

    private async wordLoad(word: string, provider: 'youdao' | 'openai'): Promise<YdRes | OpenAIDictionaryResult | undefined> {
        const value: WordTranslate | null = await this.wordTranslatesRepository.findOne(p(word), provider);
        if (!value) return undefined;

        const trans = value.translate;
        if (StrUtil.isBlank(trans)) {
            return undefined;
        }

        try {
            const parsed = JSON.parse(trans ?? '');
            if (provider === 'openai') {
                const parsedResult = openAIDictionaryResultSchema.safeParse(parsed);
                if (!parsedResult.success) {
                    dpLog.warn('OpenAI 字典缓存格式不正确，忽略本地缓存', {
                        word,
                        issues: parsedResult.error.issues
                    });
                    return undefined;
                }
                const sanitized = sanitizeDictionaryResult(parsedResult.data as OpenAIDictionaryResult);
                if (!sanitized.definitions.length) {
                    dpLog.warn('OpenAI 字典缓存缺少有效释义，忽略本地缓存', { word });
                    return undefined;
                }
                return sanitized;
            }

            return parsed as YdRes;
        } catch (error) {
            dpLog.error(`解析字典缓存失败 (provider: ${provider}, word: ${word})`, error);
            return undefined;
        }
    }

    private async wordRecord(word: string, translate: YdRes): Promise<void> {
        const value = JSON.stringify(translate);
        const wt: InsertWordTranslate = { word: p(word), provider: 'youdao', translate: value };
        await this.wordTranslatesRepository.upsert(wt.word, 'youdao', value, TimeUtil.timeUtc());
    }

    private async wordRecordOpenAI(word: string, translate: OpenAIDictionaryResult): Promise<void> {
        const sanitized = sanitizeDictionaryResult(translate);
        const value = JSON.stringify(sanitized);
        const wt: InsertWordTranslate = { word: p(word), provider: 'openai', translate: value };
        await this.wordTranslatesRepository.upsert(wt.word, 'openai', value, TimeUtil.timeUtc());
    }

    private async sentenceLoadBatch(sentences: string[], mode: SubtitleTranslationStorageMode): Promise<TransHolder<string>> {
        const result = new TransHolder<string>();
        if (sentences.length === 0) return result;

        const normalizedSentences = sentences.map(w => p(w));
        const values: SentenceTranslate[] = await this.sentenceTranslatesRepository.findTranslatedBySentencesAndMode(normalizedSentences, mode);

        values
            .filter((e) => e.sentence && !StrUtil.isBlank(e.translate))
            .forEach((e) => {
                result.add(e.sentence!, e.translate!);
            });

        return result;
    }

    private async sentenceRecordBatch(validTrans: TransHolder<string>, mode: SubtitleTranslationStorageMode): Promise<void> {
        const params = [];
        for (const [key, value] of validTrans.getMapping().entries()) {
            params.push({
                sentence: p(key),
                translate: value,
                mode,
            });
        }
        await this.sentenceTranslatesRepository.upsertMany(params);
    }
}
