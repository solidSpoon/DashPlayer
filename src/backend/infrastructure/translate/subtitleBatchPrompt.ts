import { z } from 'zod';
import { TranslationMode } from '@/common/types/TranslationResult';

/**
 * 批量字幕翻译的提示词模板与结构化输出约定。
 *
 * 这是各引擎网关（云端/本地）自持的拼装细节：模板文本、JSON 形状与字段说明
 * 都属于"怎么跟模型打交道"，业务层只提供当前组、组前后句、模式与风格。
 * 两个引擎网关当前共用同一模板与 schema，之后可按各自模型特性分叉。
 */

type BatchPromptItem = {
    key: string;
    text: string;
};

type SubtitleBatchPromptInput = {
    targets: BatchPromptItem[];
    contextBefore: BatchPromptItem[];
    contextAfter: BatchPromptItem[];
};

/**
 * 提示词拼装选项。
 */
type SubtitleBatchPromptOptions = {
    /**
     * 禁止“原文回传”后门。不可译行（♪ 等）在业务层已被过滤，永远不会
     * 进入提示词；而模型可能把它当成偷懒授权，大量照抄英文原文充数，
     * 本地网关必须开启此项。
     */
    forbidEcho?: boolean;
    /** 目标语言描述（如 "Simplified Chinese"）；缺省为 "the target language"。 */
    targetLanguageDescription?: string;
};

const OPENAI_SUBTITLE_BATCH_PROMPT = `You are a professional subtitle translation assistant.

Follow these style guidelines closely:
{{style}}

You will receive target subtitle lines and optional surrounding context in JSON format.
Context lines (contextBefore and contextAfter) are READ-ONLY references to help understand tone, intent, and terminology.

Rules:
1. Return exactly one translation for every item in targets.
2. Copy every target key exactly; never change, omit, duplicate, or invent keys.
3. NEVER translate, include, or return contextBefore or contextAfter items.
4. Do not merge or split target lines.
{{unchangedRule}}6. Respond with valid JSON only in the following shape:
{"items":[{"key":"target_key","translation":"translated_text"}]}

Subtitle request:
{{request}}`;

/**
 * 生成字幕窗口批量翻译提示词。
 *
 * @param input 当前批次的目标字幕与只读上下文。
 * @param style 风格约束文本；由业务层解析保证非空，这里不做兜底替换。
 * @param options 拼装选项；本地网关传 forbidEcho 以禁止模型照抄原文充数。
 * @returns 可直接发送给模型的批量翻译 prompt。
 */
export const buildSubtitleBatchPrompt = (
    input: SubtitleBatchPromptInput,
    style: string,
    options: SubtitleBatchPromptOptions = {},
): string => {
    const unchangedRule = options.forbidEcho
        ? '5. Every translation must be a non-empty translation into the target language described for the translation field. NEVER return the original sentence text as its own translation.\n'
        : '5. Every translation must be a non-empty string. If a target should remain unchanged, return its original text.\n';
    return OPENAI_SUBTITLE_BATCH_PROMPT
        .replace(/{{\s*unchangedRule\s*}}/gi, unchangedRule)
        .replace(/{{\s*style\s*}}/gi, style)
        .replace(/{{\s*request\s*}}/gi, JSON.stringify(input, null, 2));
};

/**
 * 返回当前模式下 translation 字段的结构说明。
 *
 * @param mode 当前字幕模式。
 * @returns 英文结构字段说明。
 */
export const getSubtitleTranslationDescription = (mode: TranslationMode): string => {
    if (mode === 'zh') {
        return 'The translated sentence in Simplified Chinese.';
    }
    if (mode === 'simple_en') {
        return 'The simplified English sentence that preserves the original meaning and subtitle readability.';
    }
    return 'The generated subtitle sentence that follows the custom style.';
};

/**
 * 构建批量字幕结果的结构化输出 schema。
 *
 * 云端与本地网关共用同一形状；分叉容错策略时各自的 schema 由各自实现持有。
 * @param mode 当前字幕模式。
 * @returns zod schema；本地网关会再转成 JSON Schema 交给 llama.cpp。
 */
export const createSubtitleBatchResultSchema = (mode: TranslationMode) =>
    z.object({
        items: z.array(z.object({
            key: z.string().describe('Original subtitle key.'),
            translation: z.string().describe(getSubtitleTranslationDescription(mode)),
        })),
    });

/**
 * 生成本地模型的紧凑行式批量翻译提示词。
 *
 * 与云端 JSON 模板语义一致（风格、只读上下文、禁照抄），但输出改为
 * 「每行一条译文、按输入顺序对齐」，由调用方按行数与行序校验：
 * 省 key 回抄与 JSON 结构 token，本地模型每批解码量约减半。
 *
 * @param input 当前批次的目标字幕与只读上下文。
 * @param style 风格约束文本；由业务层解析保证非空。
 * @param options 拼装选项；本地网关传 forbidEcho 以禁止模型照抄原文充数。
 * @returns 可直接发送给本地模型的紧凑 prompt。
 */
export const buildLocalSubtitleBatchPrompt = (
    input: SubtitleBatchPromptInput,
    style: string,
    options: SubtitleBatchPromptOptions = {},
): string => {
    const targetLanguage = options.targetLanguageDescription
        ?? 'the target language';
    const unchangedRule = options.forbidEcho
        ? '- NEVER return the original sentence text as its own translation; every line must be a non-empty translation.'
        : '- If a target should remain unchanged, return its original text.';
    const requestLines = input.targets.map((target) => `- ${target.text}`).join('\n');
    const contextParts = [
        ...(input.contextBefore.length > 0 ? [`Context before (read-only, do NOT translate or output): ${input.contextBefore.map((item) => item.text).join(' / ')}`] : []),
        ...(input.contextAfter.length > 0 ? [`Context after (read-only, do NOT translate or output): ${input.contextAfter.map((item) => item.text).join(' / ')}`] : []),
    ];
    return [
        'You are a professional subtitle translation assistant.',
        `Style guidelines:`,
        style,
        '',
        ...contextParts,
        `Translate each subtitle line below into ${targetLanguage}.`,
        `- Output exactly ${input.targets.length} lines, one translation per line, in the same order as the input.`,
        '- Output the translations only: no numbering, no quotes, no blank lines, no extra words.',
        '- Do not merge or split lines.',
        unchangedRule,
        '',
        'Lines:',
        requestLines,
    ].filter((line) => line !== undefined).join('\n');
};

/**
 * 解析本地模型返回的紧凑行式译文。
 *
 * 去除首尾空白行后按行拆分；行数必须与目标数一致（多行/少行都显式报错，
 * 交调度器重试），否则无法安全按序对齐。
 *
 * @param text 模型返回的原始文本。
 * @param expectedCount 目标句数。
 * @returns 按输入顺序排列的译文行。
 */
export const parseSubtitleBatchLines = (text: string, expectedCount: number): string[] => {
    const lines = text.trim().split('\n').filter((line) => line.trim().length > 0);
    if (lines.length !== expectedCount) {
        throw new Error(`本地模型返回行数不匹配: expected=${expectedCount}, actual=${lines.length}`);
    }
    return lines.map((line) => line.trim());
};
