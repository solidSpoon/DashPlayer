import { inject, injectable } from 'inversify';
import { CoreMessage, streamObject, streamText } from 'ai';
import { getMainLogger } from '@/backend/infrastructure/logger';
import RendererGateway from '@/backend/application/ports/gateways/renderer/RendererGateway';
import TYPES from '@/backend/ioc/types';
import AiProviderService from '@/backend/application/services/AiProviderService';
import ChatSessionService from '@/backend/application/services/ChatSessionService';
import { ChatStartResult, ChatWelcomeParams } from '@/common/types/chat';
import { AnalysisStartParams, AnalysisStartResult } from '@/common/types/analysis';
import { AiUnifiedAnalysisSchema } from '@/common/types/aiRes/AiUnifiedAnalysisRes';
import { WaitRateLimit } from '@/common/utils/RateLimiter';

type ChatSession = {
    messages: CoreMessage[];
};

@injectable()
export default class ChatSessionServiceImpl implements ChatSessionService {
    private logger = getMainLogger('ChatSessionService');
    private sessions = new Map<string, ChatSession>();

    @inject(TYPES.AiProviderService)
    private aiProviderService!: AiProviderService;

    @inject(TYPES.RendererGateway)
    private rendererGateway!: RendererGateway;

    public reset(sessionId: string): void {
        this.sessions.delete(sessionId);
    }

    @WaitRateLimit('gpt')
    public async startWelcome(params: ChatWelcomeParams): Promise<ChatStartResult> {
        const messageId = this.createMessageId();
        const sessionId = params.sessionId;
        this.rendererGateway.fireAndForget('chat/stream', {
            sessionId,
            messageId,
            event: 'start',
        });

        const model = this.aiProviderService.getModel();
        if (!model) {
            this.rendererGateway.fireAndForget('chat/stream', {
                sessionId,
                messageId,
                event: 'error',
                error: 'OpenAI api key or endpoint is empty',
            });
            return { messageId };
        }

        const messages = this.buildWelcomeMessages(params);
        this.ensureSession(sessionId, messages);
        this.runStream(sessionId, messageId, messages, {
            contextTransform: (content) => this.stripSwitchMarkers(content),
        }).catch((error) => {
            this.logger.error('welcome stream failed', {
                error: error instanceof Error ? error.message : String(error),
            });
            this.rendererGateway.fireAndForget('chat/stream', {
                sessionId,
                messageId,
                event: 'error',
                error: error instanceof Error ? error.message : String(error),
            });
        });

        return { messageId };
    }

    @WaitRateLimit('gpt')
    public async startAnalysis(params: AnalysisStartParams): Promise<AnalysisStartResult> {
        const messageId = this.createMessageId();
        const sessionId = params.sessionId;
        this.rendererGateway.fireAndForget('analysis/stream', {
            sessionId,
            messageId,
            event: 'start',
        });

        const model = this.aiProviderService.getModel();
        if (!model) {
            this.rendererGateway.fireAndForget('analysis/stream', {
                sessionId,
                messageId,
                event: 'error',
                error: 'OpenAI api key or endpoint is empty',
            });
            return { messageId };
        }

        const prompt = this.buildAnalysisPrompt(params.text);
        this.runAnalysisStream(sessionId, messageId, prompt).catch((error) => {
            this.logger.error('analysis stream failed', {
                error: error instanceof Error ? error.message : String(error),
            });
            this.rendererGateway.fireAndForget('analysis/stream', {
                sessionId,
                messageId,
                event: 'error',
                error: error instanceof Error ? error.message : String(error),
            });
        });

        return { messageId };
    }

    @WaitRateLimit('gpt')
    public async start(sessionId: string, messages: CoreMessage[]): Promise<ChatStartResult> {
        const messageId = this.createMessageId();
        this.ensureSession(sessionId, messages);
        this.rendererGateway.fireAndForget('chat/stream', {
            sessionId,
            messageId,
            event: 'start',
        });

        const model = this.aiProviderService.getModel();
        if (!model) {
            this.rendererGateway.fireAndForget('chat/stream', {
                sessionId,
                messageId,
                event: 'error',
                error: 'OpenAI api key or endpoint is empty',
            });
            return { messageId };
        }

        this.runStream(sessionId, messageId, messages).catch((error) => {
            this.logger.error('chat stream failed', {
                error: error instanceof Error ? error.message : String(error),
            });
            this.rendererGateway.fireAndForget('chat/stream', {
                sessionId,
                messageId,
                event: 'error',
                error: error instanceof Error ? error.message : String(error),
            });
        });

        return { messageId };
    }

    private ensureSession(sessionId: string, messages: CoreMessage[]): void {
        this.sessions.set(sessionId, { messages });
    }

    private async runStream(
        sessionId: string,
        messageId: string,
        messages: CoreMessage[],
        options?: {
            contextTransform?: (content: string) => string;
        }
    ): Promise<void> {
        const model = this.aiProviderService.getModel();
        if (!model) {
            return;
        }
        const result = streamText({
            model,
            messages,
        });
        let response = '';
        for await (const chunk of result.textStream) {
            response += chunk;
            this.rendererGateway.fireAndForget('chat/stream', {
                sessionId,
                messageId,
                event: 'chunk',
                chunk,
            });
        }
        this.rendererGateway.fireAndForget('chat/stream', {
            sessionId,
            messageId,
            event: 'done',
        });
        const session = this.sessions.get(sessionId);
        if (session) {
            const content = options?.contextTransform ? options.contextTransform(response) : response;
            session.messages = [...messages, { role: 'assistant', content }];
        }
    }

    private createMessageId(): string {
        return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    private stripSwitchMarkers(content: string): string {
        return content.replace(/\[\[switch:[\s\S]*?\]\]/g, '');
    }

    private buildWelcomeMessages(params: ChatWelcomeParams): CoreMessage[] {
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
    }

    private buildAnalysisPrompt(text: string): string {
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
            '- grammar: 用中文 Markdown 简洁解释语法点，段落精炼但不要遗漏重点。',
            '- examples: 必须给出 5 个例句，sentences 数组长度必须为 5。',
            '- examples: 尽量使用 vocab/phrases 中的点，points 列出用到的词或短语；如果没有合适的点，points 返回空数组但例句仍必须给出。',
        ].join('\n');
    }

    private async runAnalysisStream(sessionId: string, messageId: string, prompt: string): Promise<void> {
        const model = this.aiProviderService.getModel();
        if (!model) {
            return;
        }
        const result = streamObject({
            model,
            schema: AiUnifiedAnalysisSchema,
            prompt,
        });
        for await (const partial of result.partialObjectStream) {
            this.rendererGateway.fireAndForget('analysis/stream', {
                sessionId,
                messageId,
                event: 'chunk',
                partial,
            });
        }
        const finalObject = await result.object;
        this.rendererGateway.fireAndForget('analysis/stream', {
            sessionId,
            messageId,
            event: 'chunk',
            partial: finalObject,
        });
        this.rendererGateway.fireAndForget('analysis/stream', {
            sessionId,
            messageId,
            event: 'done',
        });
    }
}
