import { ModelMessage } from 'ai';

/**
 * 会话创建时冻结的字幕规模概览。
 */
export type SubtitleOverview = {
    /** 字幕行数。 */
    lineCount: number;
    /** 所有字幕文本的单词数（按空格分词统计）。 */
    wordCount: number;
    /** 字幕索引的最小值。 */
    minIndex: number;
    /** 字幕索引的最大值。 */
    maxIndex: number;
    /** 当前学习句的字幕索引。 */
    anchorIndex: number;
};

/**
 * 格式化通用 TTS 朗读与排版规范指令，供聊天系统提示词复用。
 */
const TTS_FORMAT_GUIDELINES = [
    '## 朗读标记规范（重要）：',
    '- 遇到英文词汇、短语、句子或例句时，必须使用 [[tts:英文内容]] 包裹以支持点击朗读。',
    '- 严禁重复英文：英文内容仅在 [[tts:...]] 中出现一次，标记外部严禁重复输出相同英文。',
    '- 标记内仅包含纯英文字符，不要夹带中文翻译，也不要使用 [] 或 | 等特殊符号。',
    '- 示例：[[tts:This is an example.]] 这是一个示例。',
].join('\n');

/**
 * 格式化字幕概览文本，统一输出结构。
 */
export const formatSubtitleOverview = (
    overview?: SubtitleOverview
): string | null => {
    if (!overview) {
        return null;
    }
    const currentPosition = overview.anchorIndex - overview.minIndex + 1;
    return [
        '字幕全局概览：',
        `- 全片字幕：共 ${overview.lineCount} 句（索引 ${overview.minIndex} ~ ${overview.maxIndex}，约 ${overview.wordCount} 词）`,
        `- 当前学习句：索引 ${overview.anchorIndex}（全片第 ${currentPosition} / ${overview.lineCount} 句）`,
    ].join('\n');
};

/**
 * 构建整句学习的结构化分析提示词。
 *
 * 说明：
 * - 一次分析只产出结构化解析（意群、词组），左栏据此渲染句子卡片；
 * - 生词不在此处提取：由本地词典选词（vocabulary/pick-sentence）负责，模型不再重复产出词表；
 * - 语法不在此处展开：需要语法讲解时由对话流承担（输入框上方的快捷提问），模型不再重复产出；
 * - 例句不在此处生成：需要例句时由聊天中的字幕检索工具取真实台词，避免模型生造语料。
 *
 * @param text 用户选中的学习文本（已由会话冻结）。
 * @returns 交给 Output.object 的单条分析提示词。
 */
export const buildAnalysisPrompt = (text: string): string => {
    return [
        '你是一个专业、严谨的英语语言分析助手。',
        '请对目标句子进行全面的语言学与教学分析，并严格输出符合指定 JSON 契约的数据，不要包含任何额外字段或 markdown 外层包裹。',
        '所有中文解释均使用简体中文。',
        '',
        '分析目标句子:',
        text,
        '',
        '# 分析要求',
        '- structure: 意群拆解。phraseGroups 为字符串数组，按原句自然阅读顺序切分出 2~5 个英文意群片段。',
        '- phrases: 提取重点词组或搭配，提供中文释义；如无短语则 phrases 为空数组且 hasPhrase=false。',
        '',
        '# 字段契约与示例模板（请完全遵循此 JSON 结构与字段命名）:',
        '```json',
        '{',
        '  "structure": {',
        '    "phraseGroups": ["意群片段1", "意群片段2", "意群片段3"]',
        '  },',
        '  "phrases": {',
        '    "hasPhrase": true,',
        '    "phrases": [',
        '      { "phrase": "词组/搭配", "meaning": "中文释义" }',
        '    ]',
        '  }',
        '}',
        '```',
    ].join('\n');
};

/**
 * 把消息列表中的 system 角色消息拆分出来，供 AI SDK v7 的 streamText(system, messages) 使用。
 */
export const splitSystemMessages = (
    messages: ModelMessage[]
): { system?: string; messages: ModelMessage[] } => {
    const systemParts: string[] = [];
    const rest: ModelMessage[] = [];
    for (const message of messages) {
        if (message.role === 'system') {
            systemParts.push(message.content);
        } else {
            rest.push(message);
        }
    }
    return {
        system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
        messages: rest,
    };
};

/**
 * 确保消息流包含完整的角色人设与字幕工具调用指南。
 */
export const ensureChatRoleMessage = (messages: ModelMessage[]): ModelMessage[] => {
    if (messages.some((message) => message.role === 'system')) {
        return messages;
    }
    return [
        {
            role: 'system',
            content: [
                '你是用户的影视英语学习专属伙伴，陪伴用户看剧学英语。',
                '',
                '# 交流原则与风格',
                '- 语气自然、亲切、像朋友交流，简洁直接，避免冗长陈述。',
                '- 遵循问什么答什么的原则，重点突出，切中要害。',
                '- 中文回答为主，英文内容保持原汁原味。',
                '',
                TTS_FORMAT_GUIDELINES,
                '',
                '# 典型问题处理模式',
                '- 单词/词组解析：提供音标、中文释义、英文释义及 2~3 个地道双语例句（英文使用 [[tts:...]]）。',
                '- 句意/句式解析：先说明句子语境含义，再拆解关键结构或词汇在句中的具体用法。',
                '- 表达改写/润色：提供 2~3 个不同语域的地道改写（Markdown 列表 - 开头），英文均包裹 [[tts:...]]。',
                '',
                '# 字幕上下文工具调用指南（ReAct 工作流）',
                '当用户询问需要超越当前单句的信息（如剧情发展、人物对话、前因后果、某人是否说过某话等）时，请按以下策略主动调用工具：',
                '1. 【定位线索】：使用 `search_subtitles` 工具搜索关键词（可提供一个或多个关键词，支持 any/all 匹配）；只为看清命中处的语境时，把 `context` 设为若干行，返回的每个命中会各自带上前后连续字幕，不必再单独展开一次。',
                '2. 【展开上下文】：需要更长的上下文时，用命中索引 `index` 调用 `get_subtitle_context`，通过 `before`/`after` 指定向前、向后各读多少行（片头/片尾处不足则少给）；想继续往后读，把返回的 `endIndex` 当作下一次的 `index`。',
                '3. 【综合回答】：结合检索到的影视台词上下文，给出准确、有依据的回答。',
                '注：如果用户仅询问当前句的语法、词汇或通用英语知识，直接回答即可，无需调用字幕工具。',
            ].join('\n'),
        },
        ...messages,
    ];
};

/** 字幕参考材料的固定前缀。 */
const SUBTITLE_CONTEXT_PREFIX = '【字幕参考材料】';

/**
 * 构建首轮对话的字幕参考材料。
 *
 * 说明：
 * - 只包含模型无法自行推导的客观上下文（当前学习句、全片规模、周边台词）；
 * - 不包含句子解析结果：解析内容已由句子卡片呈现，重复回灌既浪费上下文，也会与卡片产生两套说法。
 *
 * @param params 会话冻结的主题、周边字幕与字幕概览。
 * @returns 参考材料文本；没有可用内容时返回 null。
 */
export const buildSubtitleContext = (params: {
    /** 会话冻结的学习主题原文。 */
    originalTopic: string;
    /** 会话冻结的周边字幕。 */
    paragraphLines?: string[];
    /** 全片字幕规模概览。 */
    subtitleOverview?: SubtitleOverview;
}): string | null => {
    const parts: string[] = [];
    if (params.originalTopic.trim().length > 0) {
        parts.push(`当前学习句：${params.originalTopic}`);
    }

    const overviewText = formatSubtitleOverview(params.subtitleOverview);
    if (overviewText) {
        parts.push(overviewText);
    }

    const paragraphLines = params.paragraphLines ?? [];
    if (paragraphLines.length > 0) {
        parts.push([
            '原始段落上下文（当前句及前后台词）：',
            paragraphLines.map((line, index) => `${index + 1}. ${line}`).join('\n'),
        ].join('\n'));
    }

    if (parts.length === 0) {
        return null;
    }
    return [SUBTITLE_CONTEXT_PREFIX, '', parts.join('\n\n')].join('\n');
};

/**
 * 构建字幕完整句判定与补全的提示词。
 *
 * 说明：
 * - 字幕按换行/时间轴切分后，一行常只有半个句子；同时给前文与后续行，
 *   让模型返回当前行所在的完整句子（真实句首到真实句尾）；
 * - 译文随这一次调用一并产出：学习页要把中文摆在句子下方，单独再走一遍字幕
 *   翻译链路要重建上下文与缓存，代价远高于在同一次结构化输出里多要一个字段。
 *
 * @param params 当前字幕行及其前后紧邻字幕行。
 * @returns 交给 generateObject 的单条提示词。
 */
export const buildCompleteSentencePrompt = (params: {
    /** 当前字幕行原文。 */
    text: string;
    /** 当前行之前紧邻的字幕行（时间升序，最近一行在最后）。 */
    precedingLines: string[];
    /** 当前行之后紧邻的字幕行（时间升序）。 */
    followingLines: string[];
}): string => {
    const formatLines = (lines: string[]) => (lines.length > 0
        ? lines.map((line, index) => `${index + 1}. ${line}`).join('\n')
        : '（无）');
    return [
        '你在处理影视字幕。字幕经常被换行或时间轴切断，一行可能只有半个句子。',
        '请判断「当前字幕行」是否已是一个完整句子的全部；如果不是，结合前后紧邻字幕行，把当前行所在的句子补全。',
        '',
        '当前字幕行：',
        params.text,
        '',
        '前文行（按时间顺序，最近一行在最后）：',
        formatLines(params.precedingLines),
        '',
        '后续行（按时间顺序）：',
        formatLines(params.followingLines),
        '',
        '# 输出要求',
        // DeepSeek 等接口在使用 json_object 响应格式时强制要求提示词里出现 "json" 字样，缺失会直接报错。
        '- 只输出一个 JSON 对象，包含 complete、sentence 与 translation 三个字段，不要输出任何其他文字。',
        '- complete：当前字幕行本身是否已完整（句首与句尾都在当前行内）。',
        '- sentence：当前行所在的完整句子原文，从真实句首到真实句尾。',
        '- 当前行只是句子后半时，sentence 必须带上前文里的前半句；当前行开头已是句首时，sentence 从当前行开始。',
        '- 已完整时 sentence 与当前字幕行保持一致，不要改写或润色。',
        '- sentence 内不要包裹引号、代码块或任何说明文字，语言与原字幕保持一致。',
        '- translation：sentence 的中文译文，只输出译文本身，不要加引号或说明。',
        '- sentence 本身已是中文时，translation 与 sentence 保持一致。',
    ].join('\n');
};
