import { inject, injectable } from 'inversify';
import { z } from 'zod';
import { Output, streamText } from 'ai';
import TYPES from '@/backend/ioc/types';
import { WordTranslate, InsertWordTranslate } from '@/backend/infrastructure/db/tables/wordTranslates';
import WordTranslatesRepository from '@/backend/services/repositories/WordTranslatesRepository';
import TimeUtil from '@/common/utils/TimeUtil';
import StrUtil from '@/common/utils/str-util';
import { p } from '@/common/utils/Util';
import { YdRes, OpenAIDictionaryResult, OpenAIDictionaryDefinition, OpenAIDictionaryExample } from '@/common/types/YdRes';
import RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';
import AiProviderService from '@/backend/services/AiProviderService';
import ClientProviderService from '@/backend/services/ClientProviderService';
import SettingService from '@/backend/services/SettingService';
import { YouDaoDictionaryClient } from '@/backend/services/gateways/translate/YouDaoDictionaryClient';
import { getMainLogger } from '@/backend/infrastructure/logger';

export default interface TranslateService {
    transWord(
        str: string,
        forceRefresh?: boolean,
        requestId?: string
    ): Promise<YdRes | OpenAIDictionaryResult | null>;
}


const openAIDictionaryExampleSchema = z.object({
    sentence: z.string().describe('Example sentence in English'),
    translation: z.string().describe('Translation of the example sentence in Simplified Chinese')
});

const openAIDictionaryDefinitionSchema = z.object({
    partOfSpeech: z.string().describe('Part of speech, e.g. n., v., adj.; empty string when unavailable'),
    meaning: z.string().describe('Meaning or translation in Simplified Chinese'),
    examples: z.array(openAIDictionaryExampleSchema).describe('Examples illustrating this specific meaning')
});

const openAIDictionaryResultSchema = z.object({
    word: z.string().describe('The input word'),
    phonetic: z.string().describe('International phonetic alphabet pronunciation; empty string when unavailable'),
    definitions: z.array(openAIDictionaryDefinitionSchema).describe('Array of structured definitions'),
});

/**
 * 历史缓存兼容 Schema（允许可选字段与不同格式的音标）。
 */
const openAIDictionaryCacheSchema = z.object({
    word: z.string().describe('The input word'),
    phonetic: z.string().optional().nullable(),
    ukPhonetic: z.string().optional().nullable(),
    usPhonetic: z.string().optional().nullable(),
    definitions: z.array(z.object({
        partOfSpeech: z.string().optional(),
        meaning: z.string().optional(),
        examples: z.array(z.object({
            sentence: z.string(),
            translation: z.string().optional(),
            explanation: z.string().optional(),
        })).optional(),
    })).optional(),
    examples: z.array(z.object({
        sentence: z.string(),
        translation: z.string().optional(),
    })).optional(),
    pronunciation: z.string().optional().nullable(),
});

/**
 * 构建高兼容性词典 JSON 输出提示词（兼容不支持 json_schema 的各类大模型服务商）。
 *
 * @param word 查询的英文单词。
 * @returns 提示词文本。
 */
export const buildDictionaryPrompt = (word: string): string => {
    return [
        'You are a professional English-Chinese dictionary.',
        `Provide concise, structured dictionary information for the word "${word}".`,
        '',
        'Requirements:',
        '1. Respond with valid JSON only. Do not include markdown fences or any explanation.',
        '2. Structure format:',
        '   - word: The word itself.',
        '   - phonetic: IPA pronunciation (e.g. "/.../"). Empty string if unavailable.',
        '   - definitions: Array of definitions. Each contains partOfSpeech (e.g. "n.", "v."), meaning (in Simplified Chinese), and 1-2 practical examples.',
        '   - examples: Array of { sentence, translation } illustrating that definition.',
        '3. If any field is unavailable, provide empty string for text and empty array for lists.',
        '4. Keep content concise, practical, and clear for a quick word popup.',
        '',
        'Output template (field names and nesting must match exactly):',
        '{"word":"serendipity","phonetic":"/ˌserənˈdɪpəti/","definitions":[{"partOfSpeech":"n.","meaning":"意外发现美好事物的运气","examples":[{"sentence":"Meeting her was a stroke of serendipity.","translation":"遇见她纯属偶然的好运。"}]}]}',
    ].join('\n');
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

/**
 * 清洗例句数组并补齐必填字段；非法项会被过滤。
 */
const sanitizeExamples = (value?: unknown): OpenAIDictionaryExample[] => {
    if (!Array.isArray(value)) {
        return [];
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
            const translation = sanitizeString(record.translation) ?? '';
            return { sentence, translation };
        })
        .filter((example): example is OpenAIDictionaryExample => example !== null);
    return normalized;
};

/**
 * 清洗释义数组并补齐必填字段；无效释义会被过滤。
 */
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

            return {
                partOfSpeech: sanitizeString(record.partOfSpeech) ?? '',
                meaning,
                examples: sanitizeExamples(record.examples)
            };
        })
        .filter((definition): definition is OpenAIDictionaryDefinition => definition !== null);
};

type OpenAIDictionaryResultLike = z.infer<typeof openAIDictionaryCacheSchema> | OpenAIDictionaryResult;

/**
 * 将 OpenAI 原始/缓存字典结果归一化为前端约定的简化必填结构。
 */
const sanitizeDictionaryResult = (value: OpenAIDictionaryResultLike): OpenAIDictionaryResult => ({
    word: sanitizeString(value.word) ?? '',
    phonetic: sanitizePhonetic(value.phonetic)
        ?? sanitizePhonetic('ukPhonetic' in value ? value.ukPhonetic : undefined)
        ?? sanitizePhonetic('usPhonetic' in value ? value.usPhonetic : undefined)
        ?? '',
    definitions: sanitizeDefinitions(value.definitions),
});

const deepEqual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

@injectable()
export class TranslateServiceImpl implements TranslateService {
    private readonly logger = getMainLogger('TranslateServiceImpl');
    /**
     * 记录进行中的单词词典查询，避免同 provider + 同单词被短时间重复触发。
     *
     * 约束：
     * - 仅用于非强制刷新请求。
     * - key 由 provider 与归一化后的单词组成。
     * - 请求完成后必须立即清理，避免脏状态长期驻留。
     */
    private readonly wordLookupInFlight = new Map<string, Promise<YdRes | OpenAIDictionaryResult | null>>();
    @inject(TYPES.YouDaoClientProvider)
    private youDaoProvider!: ClientProviderService<YouDaoDictionaryClient>;
    @inject(TYPES.RendererGateway)
    private rendererGateway!: RendererGateway;
    @inject(TYPES.AiProviderService)
    private aiProviderService!: AiProviderService;
    @inject(TYPES.SettingService)
    private settingService!: SettingService;
    @inject(TYPES.WordTranslatesRepository)
    private wordTranslatesRepository!: WordTranslatesRepository;

    public async transWord(
        str: string,
        forceRefresh?: boolean,
        requestId?: string
    ): Promise<YdRes | OpenAIDictionaryResult | null> {
        const currentProvider = await this.settingService.getCurrentDictionaryProvider();

        if (!currentProvider) {
            this.logger.info('没有启用的字典服务');
            return null;
        }

        if (forceRefresh) {
            return this.executeWordLookup(str, currentProvider, true, requestId);
        }

        const lookupKey = this.buildWordLookupKey(currentProvider, str);
        const existingPromise = this.wordLookupInFlight.get(lookupKey);
        if (existingPromise) {
            this.logger.debug('复用进行中的单词查询请求', {
                provider: currentProvider,
                word: str,
                lookupKey,
            });
            return existingPromise;
        }

        const lookupPromise = this.executeWordLookup(str, currentProvider, false, requestId)
            .finally(() => {
                this.wordLookupInFlight.delete(lookupKey);
            });
        this.wordLookupInFlight.set(lookupKey, lookupPromise);
        return lookupPromise;
    }

    /**
     * 归一化单词查询 key，保证大小写与首尾空白不会影响并发合并。
     *
     * @param provider 当前字典 provider。
     * @param word 原始查询词。
     * @returns 可用于 in-flight 映射的稳定 key。
     */
    private buildWordLookupKey(provider: 'openai' | 'youdao', word: string): string {
        return `${provider}:${word.trim().toLowerCase()}`;
    }

    /**
     * 执行单词词典查询，并优先复用持久化缓存结果。
     *
     * @param str 查询单词。
     * @param currentProvider 当前字典 provider。
     * @param forceRefresh 是否绕过缓存强制刷新。
     * @param requestId 渲染层流式请求 id。
     * @returns 命中缓存或远端查询得到的词典结果。
     */
    private async executeWordLookup(
        str: string,
        currentProvider: 'openai' | 'youdao',
        forceRefresh: boolean,
        requestId?: string
    ): Promise<YdRes | OpenAIDictionaryResult | null> {

        // 如果不是强制刷新，先检查缓存
        if (!forceRefresh) {
            const cacheRes = await this.wordLoad(str, currentProvider);
            if (cacheRes) {
                this.logger.info('命中单词缓存', { provider: currentProvider, cache: cacheRes });
                return cacheRes;
            }
        } else {
            this.logger.info('强制刷新单词', { provider: currentProvider, word: str });
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

    /**
     * 使用 OpenAI 生成简化单词卡并在需要时推送流式更新。
     * @param word 查询单词。
     * @param requestId 渲染层流式请求 id；为空时仅返回最终结果。
     * @returns 生成成功返回简化词典结果；无有效释义或异常时返回 null。
     */
    private async translateWordWithOpenAI(word: string, requestId?: string): Promise<OpenAIDictionaryResult | null> {
        const streamId = requestId ?? `openai-dict-${Date.now()}-${word}`;
        const streamLogger = this.logger;

        try {
            const model = this.aiProviderService.getModel('dictionary');
            if (!model) {
                this.logger.error('OpenAI 模型未配置');
                return null;
            }

            const prompt = buildDictionaryPrompt(word);

            const { partialOutputStream } = streamText({
                model,
                reasoning: 'low',
                output: Output.object({ schema: openAIDictionaryResultSchema }),
                prompt,
            });

            const aggregated: OpenAIDictionaryResult = {
                word: sanitizeString(word) ?? word,
                phonetic: '',
                definitions: []
            };
            let hasStreamed = false;
            let chunkCount = 0;

            for await (const partialObject of partialOutputStream) {
                // 词典流式 chunk 频率同样较高，按间隔采样，保留进度可见性。
                chunkCount += 1;
                if (chunkCount === 1 || chunkCount % 20 === 0) {
                    streamLogger.debug('dictionary json chunk', {
                        word,
                        chunkCount,
                        keys: Object.keys(partialObject ?? {}),
                    });
                }
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
                        aggregated.phonetic = sanitizedPhoneticValue ?? '';
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
            this.logger.error('OpenAI 字典查询失败', { word, error });
            if (requestId) {
                try {
                    await this.emitOpenAIDictionaryUpdate(
                        streamId,
                        sanitizeString(word) ?? word,
                        { word: sanitizeString(word) ?? word, phonetic: '', definitions: [] },
                        true
                    );
                } catch (emitError) {
                    this.logger.error('failed to notify renderer about OpenAI dictionary error', { error: emitError });
                }
            }
            return null;
        }
    }

    /**
     * 将简化词典结果推送到渲染层，供弹窗实时刷新。
     * @param requestId 当前流式请求 id。
     * @param word 查询单词。
     * @param data 已归一化的词典数据。
     * @param isComplete 是否已完成本次流式推送。
     */
    private async emitOpenAIDictionaryUpdate(
        requestId: string,
        word: string,
        data: OpenAIDictionaryResult,
        isComplete: boolean
    ): Promise<void> {
        /**
         * 深拷贝例句数组，避免渲染层误改后端持有对象。
         */
        const cloneExamples = (examples: OpenAIDictionaryExample[]): OpenAIDictionaryExample[] => {
            return examples.map(example => ({
                sentence: example.sentence,
                translation: example.translation
            }));
        };

        const payload: OpenAIDictionaryResult = {
            word: data.word,
            phonetic: data.phonetic,
            definitions: data.definitions.map(def => ({
                partOfSpeech: def.partOfSpeech,
                meaning: def.meaning,
                examples: cloneExamples(def.examples)
            }))
        };

        try {
            await this.rendererGateway.call('dictionary/openai-update', {
                requestId,
                word,
                data: payload,
                isComplete
            });
        } catch (error) {
            this.logger.error('发送 OpenAI 字典流式更新失败', { requestId, word, error });
        }
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
                const parsedResult = openAIDictionaryCacheSchema.safeParse(parsed);
                if (!parsedResult.success) {
                    this.logger.warn('OpenAI 字典缓存格式不正确，忽略本地缓存', {
                        word,
                        issues: parsedResult.error.issues
                    });
                    return undefined;
                }
                const sanitized = sanitizeDictionaryResult(parsedResult.data as OpenAIDictionaryResult);
                if (!sanitized.definitions.length) {
                    this.logger.warn('OpenAI 字典缓存缺少有效释义，忽略本地缓存', { word });
                    return undefined;
                }
                return sanitized;
            }

            return parsed as YdRes;
        } catch (error) {
            this.logger.error('解析字典缓存失败', { provider, word, error });
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

}
