import { CoreMessage } from 'ai';
import { ChatBackgroundContext, ChatWelcomeParams } from '@/common/types/chat';
import { AiUnifiedAnalysisRes } from '@/common/types/aiRes/AiUnifiedAnalysisRes';

export const buildWelcomeMessages = (params: ChatWelcomeParams): CoreMessage[] => {
    const system = [
        '你是用户的英语学习伙伴，帮助他们理解和掌握英语表达。',
        '',
        '# 身份与语气',
        '- 用自然、亲切的对话方式交流，就像和朋友聊天一样',
        '- 不要用"报告"、"分析"这类正式词汇，也不要提及自己是 AI 或助手',
        '- 每次的表达方式可以略有不同，保持新鲜感',
        '',
        '# 输出格式',
        '- 使用 Markdown 格式（不要用 HTML）',
        '- 当需要让英文可以被朗读时，用 [[tts:英文内容]] 包裹',
        '  - 英文句子、短语、单词、例句都应该用 [[tts:...]] 包裹，方便用户点击朗读',
        '  - 即使是在解释中顺带提到的英文词汇，也建议加上 [[tts:...]]',
        '- 句子原文和中文翻译之间应该换行，让格式更清晰',
        '- 同义句建议使用 Markdown 列表格式（-），每个一行',
        '- **关于 [[switch:...]] 标记**（用于切换到完整句子）：',
        '  - 字幕文件通常会把长句子按固定宽度换行，导致一句话被拆成多行',
        '  - 如果提供了"完整段落"，用它来判断目标句子是否只是某个完整句子的一部分',
        '  - 如果确实被截断了，用 [[switch:完整句子原文|显示文字]] 让用户切换',
        '  - switch 冒号后面跟完整句子的英文原文，竖线后面是显示给用户的提示文字（如"点击查看完整句"）',
        '  - 如果原文包含 | 或 ] 可能导致解析问题，可微调避免',
        '  - 如果没有提供完整段落，或者无法确定是否被截断，就不要输出 switch 标记',
        '- 除了以上标记，不要引入其他自定义标记',
        '',
        '# 重要约束',
        '- **严禁重复英文原文**：',
        '  - 英文句子只能在 [[tts:...]] 标记内出现，不要在标记外以任何形式输出',
        '  - 不要使用"英文原句："、"原文："等标签后再跟英文，应该直接用 [[tts:...]] 展示',
        '  - 错误示例 1：英文原句：Hello world [[tts:Hello world]]',
        '  - 错误示例 2：[[tts:Hello world]] 你好世界。这句话 "Hello world" 是...',
        '  - 正确示例：[[tts:Hello world]] 你好世界。这句话是...',
        '- 只有在确信句子不完整且能推断出完整版本时，才提供 switch 标记',
        '- 如果无法确定句子是否完整，就不要提供 switch 标记',
    ].join('\n');

    const userLines = [
        '用户选择了这句话来学习：',
        '',
        params.originalTopic,
    ];

    if (params.fullText && params.fullText.trim() !== params.originalTopic.trim()) {
        userLines.push(
            '',
            '完整段落（用于判断句子是否被字幕换行截断）：',
            '',
            params.fullText,
        );
    }

    userLines.push(
        '',
        '请生成一段开场消息，像和朋友聊天那样自然地引导他开始学习这句话。',
        '',
        '# 内容要求',
        '',
        '消息需要涵盖这几个方面，但要用自然流畅的语言连接起来，而不是机械地列举：',
        '',
        '1. **打个招呼，开启话题**',
        '   - 用一两句话轻松开场，可以简单说说这句话的特点、使用场景，或者为什么值得学',
        '   - 自然地过渡到展示句子本身',
        '',
        '2. **展示句子**',
        '   - 直接用 [[tts:...]] 包裹英文原句（如果判断句子被截断，则展示完整版本）',
        '   - **禁止**在 [[tts:...]] 之前或之后再次输出英文原文，不要用"英文原句："、"原文："等标签',
        '   - 在 [[tts:...]] 标记之后，换一行，然后用一句话概括中文意思',
        '   - 不要用"翻译："、"意思是："这种标签，自然地表达即可',
        '   - 如果句子明显不完整（比如被换行打断），要提供 [[switch:完整句子|切换到完整版]] 让用户切换',
        '',
        '3. **提供同义表达**',
        '   - 自然地过渡，比如"这句话还可以这样说"、"换个方式表达的话"',
        '   - 给出 2-3 个同义或更地道的改写，使用 Markdown 列表格式（- 开头）',
        '   - 每个改写都用 [[tts:...]] 包裹，方便用户点击朗读',
        '   - **注意**：每个改写句也只在对应的 [[tts:...]] 中出现一次，不要在后续文本中重复',
        '   - 可以简单说明不同表达之间的细微差异或使用场景（提到的英文短语、单词也建议用 [[tts:...]]）',
        '',
        '4. **引导进一步学习**',
        '   - 自然地提一句，系统已经分析好了这句话的详细学习材料',
        '   - 比如生词解释、短语用法、语法结构、实用例句等',
        '   - 告诉用户这些内容已经展示在界面左右两侧',
        '   - 语气轻松，简单提醒用户可以去查看，不要过于强调',
        '',
        '# 风格要求',
        '',
        '- 总长度控制在 12-18 行 Markdown 左右，给用户足够的信息量但不要太啰嗦',
        '- 各部分之间要有自然的过渡和衔接，像说话一样娓娓道来',
        '- 避免使用编号、大标题或严格的分段，让内容读起来像一段连贯的对话',
        '- 语气友好、鼓励，但不要过度夸张或过于正式',
        '- 可以根据句子的具体内容调整表达方式，保持灵活性',
        '',
        '# 再次强调：严禁重复英文',
        '',
        '- 所有英文句子只在 [[tts:...]] 标记内出现，标记外的任何地方都不要重复',
        '- 不要使用"英文原句："、"原文："、"原话是："等标签后再输出英文',
        '- 展示句子时，直接从 [[tts:...]] 开始，然后换行，再输出中文解释',
        '- 示例格式：',
        '  ```',
        '  [[tts:英文句子]]',
        '  中文解释。',
        '  ',
        '  这句话还可以这样说：',
        '  - [[tts:同义句1]]',
        '  - [[tts:同义句2]]',
        '  ```',
        '- 在解释中提到英文短语、单词时，也建议用 [[tts:...]] 包裹，方便用户朗读',
    );

    const user = userLines.join('\n');

    return [
        {
            role: 'system',
            content: system,
        },
        {
            role: 'user',
            content: user,
        },
    ];
};

export const buildAnalysisPrompt = (text: string): string => {
    return [
        '你是一个专业、冷静的英语学习助手。',
        '请严格输出 JSON，内容必须与给定 schema 字段一致，且不要包含多余字段。',
        '所有中文内容使用简体中文。',
        '',
        '分析目标句子:',
        text,
        '',
        '要求:',
        '- structure: 句子意群拆解，phraseGroups 按原句顺序排列，并给出中文翻译与必要标签。',
        '- vocab: 提取对中级学习者可能生僻的新词，给出音标与中文释义；没有就返回空数组并 hasNewWord=false。',
        '- phrases: 提取常用词组/固定搭配，给出中文释义；没有就返回空数组并 hasPhrase=false。',
        '- grammar: 用中文 Markdown 简洁解释语法点，避免使用标题语法（如 #/##/###），用加粗或列表代替。',
        '- examples: 必须给出 5 个例句，sentences 数组长度必须为 5。',
        '- examples: 尽量使用 vocab/phrases 中的点，points 列出用到的词或短语；如果没有合适的点，points 返回空数组但例句仍必须给出。',
        '- examples 结构必须是 sentences 数组，每项包含 sentence/meaning/points，禁止额外字段。',
        '- examples 结构示例:',
        '{"examples":{"sentences":[{"sentence":"...","meaning":"...","points":["..."]}]}}',
    ].join('\n');
};

export const appendBackgroundMessage = (
    messages: CoreMessage[],
    background?: ChatBackgroundContext
): CoreMessage[] => {
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
        ...withRole.slice(insertIndex)
    ];
};

export const ensureChatRoleMessage = (messages: CoreMessage[]): CoreMessage[] => {
    if (messages.some((message) => message.role === 'system')) {
        return messages;
    }
    return [
        {
            role: 'system',
            content: [
                '你是用户的英语学习伙伴，帮他看剧学英语。',
                '',
                '说话风格：',
                '- 像朋友聊天一样自然，别太正式',
                '- 简洁直接，别啰嗦',
                '- 解释语法或词汇时举个例子就好，别长篇大论',
                '- 用户问什么答什么，别自作主张展开太多',
                '- 可以适当用"哈""啊""嗯"这类语气词，但别过度',
                '',
                '回答格式：',
                '- 用中文回答，英文内容保持原样',
                '- 不需要分太多小标题，自然地说就行',
                '- 如果要举例，一两个就够了',
                '',
                '朗读功能（重要）：',
                '- 碰到英文就用 [[tts:...]] 包起来，里面只放英文，别加中文解释',
                '- 单词、短语、句子、例句都这样包，用户想听就能点',
                '- 英文只在 [[tts:...]] 里写一次，外面就不用重复了',
                '- 别在标记里用方括号 []、竖线 | 这些特殊符号，会出问题',
                '- 像这样：[[tts:This is a sample sentence.]]',
                '',
                '回答用户的常见问题：',
                '- 问单词/短语：音标、中文意思、英文解释、3 个例句（带中文），英文都用 [[tts:...]]',
                '- 问句子里的词：先说整句意思，再讲这个词在句子里的用法，给 3 个例句',
                '- 要同义句/润色：给 3 个改写，每个单独一行用 - 开头，英文用 [[tts:...]]',
            ].join('\n'),
        },
        ...messages
    ];
};

export const buildChatBackgroundMessage = (
    background?: ChatBackgroundContext
): CoreMessage | null => {
    const parts: string[] = [];
    const paragraphLines = background?.paragraphLines ?? [];
    if (paragraphLines.length > 0) {
        parts.push([
            '原始段落（上下文 11 句）:',
            paragraphLines.map((line, index) => `${index + 1}. ${line}`).join('\n')
        ].join('\n'));
    }

    const analysis = background?.analysis;
    if (analysis?.structure?.phraseGroups?.length) {
        const lines = analysis.structure.phraseGroups.map(
            (group: AiUnifiedAnalysisRes['structure']['phraseGroups'][number]) => {
            const tags = group.tags?.length ? ` (${group.tags.join('、')})` : '';
            return `- ${group.original ?? ''} -> ${group.translation ?? ''}${tags}`;
        });
        parts.push(['知识点-意群拆解:', ...lines].join('\n'));
    }

    if (analysis?.vocab?.words?.length) {
        const lines = analysis.vocab.words.map(
            (word: AiUnifiedAnalysisRes['vocab']['words'][number]) => {
            const phonetic = word.phonetic ? ` ${word.phonetic}` : '';
            return `- ${word.word}${phonetic}: ${word.meaning ?? ''}`;
        });
        parts.push(['知识点-生词:', ...lines].join('\n'));
    }

    if (analysis?.phrases?.phrases?.length) {
        const lines = analysis.phrases.phrases.map(
            (phrase: AiUnifiedAnalysisRes['phrases']['phrases'][number]) => {
            return `- ${phrase.phrase ?? ''}: ${phrase.meaning ?? ''}`;
        });
        parts.push(['知识点-短语:', ...lines].join('\n'));
    }

    if (analysis?.grammar?.grammarsMd) {
        parts.push(['知识点-语法要点:', analysis.grammar.grammarsMd].join('\n'));
    }

    if (analysis?.examples?.sentences?.length) {
        const lines = analysis.examples.sentences.map(
            (example: AiUnifiedAnalysisRes['examples']['sentences'][number], index) => {
            const sentence = example.sentence ?? '';
            const meaning = example.meaning ?? '';
            const points = example.points?.length ? ` [${example.points.join('、')}]` : '';
            return `${index + 1}. ${sentence}${meaning ? ` / ${meaning}` : ''}${points}`;
        });
        parts.push(['右下角例句列表:', ...lines].join('\n'));
    }

    if (parts.length === 0) {
        return null;
    }

    return {
        role: 'system',
        content: [
            '以下是本次对话的背景信息，请在回答时参考：',
            '页面元素位置说明:',
            '- 顶部: 意群结构',
            '- 左上: 本句生词',
            '- 左中: 本句词组',
            '- 左下: 本句语法',
            '- 右上: 原始段落',
            '- 右下: 例句',
            '',
            parts.join('\n\n')
        ].join('\n'),
    };
};
