import { z } from 'zod';
import { TranslationMode } from '@/common/types/TranslationResult';

/**
 * 字幕批量翻译的采样温度：翻译属近确定性任务，低温显著减少元话发挥
 * （（注：…）、复述原文之类）与合译漂移；过低温（如 0）则可能引入
 * 重复循环，取经验折中值，由本地链路评测脚本对比校准。
 */
export const LOCAL_TRANSLATION_TEMPERATURE = 0.3;

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
    /** 当前翻译模式；云端模板不使用，本地模板据此决定目标语言与示例语向。 */
    mode: TranslationMode;
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
 * 返回本地提示词里目标语言的短标签（直接嵌入 “into ${label}” 等指令位）。
 *
 * 与 getSubtitleTranslationDescription（schema 字段描述用的完整句）不同，
 * 这里必须是可以接在介词后面的名词短语。
 *
 * @param mode 当前字幕模式。
 * @returns 英文目标语言短标签。
 */
export const getSubtitleTargetLanguageLabel = (mode: TranslationMode): string => {
    if (mode === 'zh') return 'Simplified Chinese';
    if (mode === 'simple_en') return 'plain English';
    return 'the target style';
};

/**
 * 把待输出的固定文本转为 GBNF 字面量。
 *
 * 固定文本本身是合法 JSON 片段，GBNF 与 JSON 的字符串转义兼容：
 * 反斜杠与双引号是仅有的两类需转义字符，其余字符逐字保留。
 *
 * @param raw 模型输出中应逐字出现的固定文本。
 * @returns GBNF 字面量。
 */
const gbnfLiteral = (raw: string): string =>
    '"' + raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';

/**
 * 单条译文的自由段规则：排除 ASCII 双引号与反斜杠，保证拼回的 JSON 可直接
 * parse（中文引号为全角，不受影响）；下限 1 保证非空，上限 200 防止模型
 * 在槽内退化重复循环拖到 max_tokens（评测中观察到过 100 秒以上的循环）。
 */
const FILL_TRANSLATION_RULE = 'tran ::= [^"\\\\]{1,200}';

/**
 * 构建源文锚定的填槽语法：源文预拼进 JSON 骨架字面量，GBNF 在解码层
 * 逐字强制骨架，模型只在每个 translation 槽自由生成。
 *
 * 这是本地字幕翻译的核心策略：每条译文生成时，它自己的源文就在上一个
 * token 位置（局部条件性），既不需要模型自己推断跨行断句分组，也不可能
 * 出现合译后的行错位——行式方案在长行悬挂收尾的批次上稳定合译、再用
 * 回抄英文凑行数（真实失败案例见本地链路评测脚本），填槽在评测中
 * 全批次稳定通过。代价是输出要逐字回显源文，解码 token 约多一倍。
 *
 * @param sources 批次内各句源文，顺序即槽序，必须非空。
 * @returns 可直接传给 llama-server `grammar` 参数的 GBNF 文本。
 */
export const buildLocalSubtitleFillGrammar = (sources: string[]): string => {
    if (sources.length < 1) {
        throw new Error(`非法的字幕批次槽数：${sources.length}`);
    }
    const parts: string[] = [gbnfLiteral(`{"items":[{"source": ${JSON.stringify(sources[0])}, "translation": "`)];
    for (const [index, source] of sources.entries()) {
        if (index > 0) {
            // 槽间字面量以上一槽译文的收尾引号开头。
            parts.push(gbnfLiteral(`"},{"source": ${JSON.stringify(source)}, "translation": "`));
        }
        parts.push('tran');
    }
    parts.push(gbnfLiteral('"}]}'));
    return `root ::= ${parts.join(' ')}\n${FILL_TRANSLATION_RULE}`;
};

/** 构建源文预填的 JSON 骨架（提示词展示用）：translation 字段全部留空，由模型填充。 */
const buildFillSkeleton = (sources: string[]): string =>
    `{"items":[${sources.map((source) => `{"source": ${JSON.stringify(source)}, "translation": ""}`).join(', ')}]}`;

/**
 * 生成本地模型的源文锚定填槽提示词。
 *
 * 与云端 JSON 模板语义一致（风格、只读上下文、禁照抄），但模型的任务
 * 从“自由生成译文行”改为“把骨架里的空 translation 字段填上”。结构由
 * buildLocalSubtitleFillGrammar 在解码层硬保证，提示词只保留语法管不了的
 * 事：逐句翻译语义、行内无装饰符号、禁照抄。禁照抄规则放在最贴近源文的
 * 位置（小模型对末尾指令遵从度最高），且用正向措辞（必须做什么）。
 *
 * @param input 当前批次的目标字幕与只读上下文。
 * @param style 风格约束文本；由业务层解析保证非空。
 * @param options 拼装选项；本地网关传 forbidEcho 以禁止模型照抄原文充数。
 * @returns 可直接发送给本地模型的填槽 prompt。
 */
export const buildLocalSubtitleFillPrompt = (
    input: SubtitleBatchPromptInput,
    style: string,
    options: SubtitleBatchPromptOptions = {},
): string => {
    const targetLanguage = getSubtitleTargetLanguageLabel(input.mode);
    const unchangedRule = options.forbidEcho
        ? 'Never leave a translation empty; copying a source text as its own translation is forbidden.'
        : 'If a source should remain unchanged, copy it into the translation field.';
    const contextParts = [
        ...(input.contextBefore.length > 0 ? [`Context before (read-only, do NOT translate or output): ${input.contextBefore.map((item) => item.text).join(' / ')}`] : []),
        ...(input.contextAfter.length > 0 ? [`Context after (read-only, do NOT translate or output): ${input.contextAfter.map((item) => item.text).join(' / ')}`] : []),
    ];
    const instruction = `Fill every empty "translation" field with your own natural translation of the "source" text in the same object into ${targetLanguage}. Output exactly one completed JSON document with every field and its order unchanged, translations only: no numbering, no bullet points, no extra words.`;
    return [
        'You are a professional subtitle translation assistant.',
        'Style guidelines:',
        style,
        '',
        ...contextParts,
        instruction,
        unchangedRule,
        '',
        'JSON to complete:',
        buildFillSkeleton(input.targets.map((target) => target.text)),
    ].join('\n');
};

/**
 * 解析本地模型返回的填槽 JSON。
 *
 * 结构由语法硬保证，这里的校验全是纯防御：JSON 可 parse、形状符合、
 * 槽数一致、源文逐字回显无错位。任一不满足都显式报错交调度器重试，
 * 不做静默对齐——它们同时是推理端未按约束解码的归因证据。
 *
 * @param text 模型返回的原始文本。
 * @param sources 按槽序的源文，用于回显校验。
 * @returns 按输入顺序排列的译文（已 trim）。
 */
export const parseLocalSubtitleFill = (text: string, sources: string[]): string[] => {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch (error) {
        throw new Error(`本地模型填槽输出不是合法 JSON：${error instanceof Error ? error.message : String(error)}`);
    }
    const shape = z.object({
        items: z.array(z.object({ source: z.string(), translation: z.string() })),
    }).safeParse(parsed);
    if (!shape.success) {
        throw new Error(`本地模型填槽输出形状不符：${shape.error.message}`);
    }
    if (shape.data.items.length !== sources.length) {
        throw new Error(`本地模型返回槽数不匹配: expected=${sources.length}, actual=${shape.data.items.length}`);
    }
    for (const [index, item] of shape.data.items.entries()) {
        if (item.source !== sources[index]) {
            throw new Error(`本地模型填槽源文错位（第 ${index + 1} 槽）`);
        }
    }
    return shape.data.items.map((item) => item.translation.trim());
};
