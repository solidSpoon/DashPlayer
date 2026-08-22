import { ModelMessage } from 'ai';
import { ChatBackgroundContext } from '@/common/types/chat';
import { AiUnifiedAnalysisRes } from '@/common/types/aiRes/AiUnifiedAnalysisRes';

/**
 * 格式化通用 TTS 朗读与排版规范指令，供 Welcome 与 Chat System Prompt 复用。
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
    overview?: ChatBackgroundContext['subtitleOverview']
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
 * 欢迎消息提示词所需的后端内部上下文。
 */
type ChatWelcomePromptParams = {
    /** 会话 ID，保持调用语义完整。 */
    sessionId: string;
    /** 用户选择的原始学习文本。 */
    originalTopic: string;
    /** 创建会话时冻结的完整段落。 */
    fullText?: string;
    /** 完整字幕的统计概览。 */
    subtitleOverview?: ChatBackgroundContext['subtitleOverview'];
};

/**
 * 构建整句学习面板的欢迎语提示词。
 */
export const buildWelcomeMessages = (params: ChatWelcomePromptParams): ModelMessage[] => {
    const system = [
        '你是用户的英语学习伙伴，以亲切、自然的口吻引导用户理解和掌握当前选中的英语表达。',
        '',
        '# 身份与交流风格',
        '- 像和朋友聊天一样自然交流，避免刻板或机械式的报告词汇。',
        '- 保持启发与鼓励，每次表达自然灵动。',
        '',
        '# 格式与标记要求',
        '- 严格使用 Markdown 格式（不要使用 HTML 标签）。',
        TTS_FORMAT_GUIDELINES,
        '',
        '## 完整句切换标记（[[switch:...]]）：',
        '- 字幕常因排版将长句切分到多行。若提供了“完整段落”且目标句明显只是被截断的片段：',
        '  - 使用 [[switch:完整句子原文|提示文本]] 引导用户切换（如 [[switch:Full sentence here.|点击查看完整句]]）。',
        '  - 若无法确信或无完整段落，不要输出 switch 标记。',
        '',
        '# 消息内容结构（自然衔接，避免生硬的小标题列举）',
        '1. 轻松问候开场：简述本句的语言特色、地道之处或使用场景。',
        '2. 展示并解析句子：',
        '   - 直接以 [[tts:英文原句]] 起始，换行后提供准确自然的中文意译。',
        '   - 禁止在 [[tts:...]] 前后重复写英文原句或使用“原文：”等冗余标签。',
        '   - 如被截断，附加 [[switch:...]] 切换建议。',
        '3. 地道同义表达：',
        '   - 给出 2~3 个地道改写，使用 Markdown 列表（- 开头），每项英文均用 [[tts:...]] 包裹并简要说明语境差异。',
        '4. 引导侧边材料：',
        '   - 自然提示界面中已同步解析的意群拆解、生词音标、常用短语及例句，鼓励用户随心查看。',
        '',
        '# 长度控制',
        '- 整体长度保持在 12~18 行 Markdown 之间，充实且不冗长。',
    ].join('\n');

    const userLines = [
        '用户选择了以下内容开始学习：',
        '',
        params.originalTopic,
    ];

    if (params.fullText && params.fullText.trim() !== params.originalTopic.trim()) {
        userLines.push(
            '',
            '完整段落（供判断是否被换行截断）：',
            params.fullText,
        );
    }

    const overviewText = formatSubtitleOverview(params.subtitleOverview);
    if (overviewText) {
        userLines.push('', overviewText);
    }

    userLines.push('', '请生成一段自然、生动的开场欢迎与导学消息。');

    return [
        { role: 'system', content: system },
        { role: 'user', content: userLines.join('\n') },
    ];
};

/**
 * 构建整句深度分析的结构化 JSON 提示词。
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
        '- structure: 意群拆解。phraseGroups 按原句自然顺序切分，并给出每个意群的中文翻译。',
        '- vocab: 提取中级学习者可能不熟悉的生词，提供标准音标与中文释义；如无生词则 words 为空数组且 hasNewWord=false。',
        '- phrases: 提取重点词组或搭配，提供中文释义；如无短语则 phrases 为空数组且 hasPhrase=false。',
        '- grammar: 用清晰的中文 Markdown 解释关键语法结构，不要使用 # 级标题，使用加粗或列表即可。',
        '- examples: 必须给出 5 个例句（sentences 数组长度固定为 5）。尽量结合本句词汇与短语，points 标明所用考点，meaning 提供中文释义。',
        '',
        '# 字段契约与示例模板（请完全遵循此 JSON 结构与字段命名）:',
        '```json',
        '{',
        '  "structure": {',
        '    "sentence": "目标句子完整原文",',
        '    "phraseGroups": [',
        '      { "original": "意群英文", "translation": "意群中文翻译" }',
        '    ]',
        '  },',
        '  "vocab": {',
        '    "hasNewWord": true,',
        '    "words": [',
        '      { "word": "单词", "phonetic": "音标", "meaning": "中文释义" }',
        '    ]',
        '  },',
        '  "phrases": {',
        '    "hasPhrase": true,',
        '    "phrases": [',
        '      { "phrase": "词组/搭配", "meaning": "中文释义" }',
        '    ]',
        '  },',
        '  "grammar": {',
        '    "hasGrammar": true,',
        '    "grammarsMd": "语法要点说明（Markdown）"',
        '  },',
        '  "examples": {',
        '    "sentences": [',
        '      { "sentence": "英文例句", "meaning": "例句中文翻译", "points": ["考点词/短语"] }',
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
                '1. 【定位线索】：使用 `search_subtitles` 工具搜索关键词（可提供 1~5 个关键词，支持 any/all 匹配）。',
                '2. 【展开上下文】：根据搜索结果中的命中索引 `index`，使用 `get_subtitle_context` 读取该句前后的连续字幕（通过 `limit` 控制跨度）。',
                '3. 【综合回答】：结合检索到的影视台词上下文，给出准确、有依据的回答。',
                '注：如果用户仅询问当前句的语法、词汇或通用英语知识，直接回答即可，无需调用字幕工具。',
            ].join('\n'),
        },
        ...messages,
    ];
};

/**
 * 将已有的背景分析与段落上下文装配进消息队列中。
 */
export const buildChatBackgroundMessage = (
    background?: ChatBackgroundContext
): ModelMessage | null => {
    const parts: string[] = [];
    const overviewText = formatSubtitleOverview(background?.subtitleOverview);
    if (overviewText) {
        parts.push(overviewText);
    }

    const paragraphLines = background?.paragraphLines ?? [];
    if (paragraphLines.length > 0) {
        parts.push([
            '原始段落上下文（当前句及前后台词）：',
            paragraphLines.map((line, index) => `${index + 1}. ${line}`).join('\n'),
        ].join('\n'));
    }

    const analysis = background?.analysis;
    if (analysis?.structure?.phraseGroups?.length) {
        const lines = analysis.structure.phraseGroups.map(
            (group: AiUnifiedAnalysisRes['structure']['phraseGroups'][number]) =>
                `- ${group.original ?? ''} -> ${group.translation ?? ''}`
        );
        parts.push(['已解析的意群拆解：', ...lines].join('\n'));
    }

    if (analysis?.vocab?.words?.length) {
        const lines = analysis.vocab.words.map(
            (word: AiUnifiedAnalysisRes['vocab']['words'][number]) => {
                const phonetic = word.phonetic ? ` ${word.phonetic}` : '';
                return `- ${word.word}${phonetic}: ${word.meaning ?? ''}`;
            }
        );
        parts.push(['已提取的生词：', ...lines].join('\n'));
    }

    if (analysis?.phrases?.phrases?.length) {
        const lines = analysis.phrases.phrases.map(
            (phrase: AiUnifiedAnalysisRes['phrases']['phrases'][number]) =>
                `- ${phrase.phrase ?? ''}: ${phrase.meaning ?? ''}`
        );
        parts.push(['已提取的短语：', ...lines].join('\n'));
    }

    if (analysis?.grammar?.grammarsMd) {
        parts.push(['已总结的语法要点：', analysis.grammar.grammarsMd].join('\n'));
    }

    if (analysis?.examples?.sentences?.length) {
        const lines = analysis.examples.sentences.map(
            (example: AiUnifiedAnalysisRes['examples']['sentences'][number], index) => {
                const sentence = example.sentence ?? '';
                const meaning = example.meaning ?? '';
                const points = example.points?.length ? ` [${example.points.join('、')}]` : '';
                return `${index + 1}. ${sentence}${meaning ? ` / ${meaning}` : ''}${points}`;
            }
        );
        parts.push(['关联参考例句：', ...lines].join('\n'));
    }

    if (parts.length === 0) {
        return null;
    }

    return {
        role: 'system',
        content: [
            '以下是本次对话所关联的背景材料与语言分析数据，请在与用户交流时参考：',
            '',
            parts.join('\n\n'),
        ].join('\n'),
    };
};

/**
 * 将背景信息注入到用户最后一条消息之前。
 */
export const appendBackgroundMessage = (
    messages: ModelMessage[],
    background?: ChatBackgroundContext
): ModelMessage[] => {
    const withRole = ensureChatRoleMessage(messages);
    const backgroundMessage = buildChatBackgroundMessage(background);
    if (!backgroundMessage) {
        return withRole;
    }
    const insertIndex = withRole.findLastIndex((message) => message.role === 'user');
    if (insertIndex < 0) {
        return [...withRole, backgroundMessage];
    }
    return [
        ...withRole.slice(0, insertIndex),
        backgroundMessage,
        ...withRole.slice(insertIndex),
    ];
};
