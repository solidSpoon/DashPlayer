import { randomUUID } from 'crypto';
import fsp from 'fs/promises';
import path from 'path';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { getMainLogger } from '@/backend/infrastructure/logger';
import { storeGet } from '@/backend/infrastructure/settings/store';
import { PiRpcClient } from '@/backend/infrastructure/agent/PiRpcClient';
import {
    buildPiDownloadSystemPrompt,
    buildPiDownloadUserMessage,
} from '@/backend/services/download/piDownloadPrompt';
import {
    parseLatestToolProgressFromChunk,
    parsePresentVideoToolArgs,
    parseReportStageToolArgs,
} from '@/backend/services/download/piProgressParser';
import { ensurePiStageExtension } from '@/backend/services/download/piStageExtension';
import type MediaService from '@/backend/services/MediaService';
import type PiRuntimeService from '@/backend/services/PiRuntimeService';
import type RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';
import type StorageDirectoryProvider from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import { StorageDirectoryTarget } from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import { AI_API_FORMATS, type AiApiFormat } from '@/common/utils/cloud-ai-api-format';
import StrUtil from '@/common/utils/str-util';
import TimeUtil from '@/common/utils/TimeUtil';
import type {
    PiDownloadMediaCardInfo,
    PiDownloadProgressInfo,
    PiDownloadSessionDetailVO,
    PiDownloadSessionStatus,
    PiDownloadSessionVO,
    PiDownloadStreamEvent,
    PiDownloadTimelineItem,
} from '@/common/contracts/pi-download';

const DASHPLAYER_PROVIDER_ID = 'dashplayer';
const SESSIONS_DIR_NAME = 'sessions';
const TOOLS_DIR_NAME = 'tools';
const SESSION_FILE_NAME = 'session.json';
const WORKSPACE_DIR_NAME = 'workspace';
const RPC_LOG_FILE_NAME = 'rpc-events.jsonl';

interface ActiveDownloadSession {
    vo: PiDownloadSessionVO;
    items: PiDownloadTimelineItem[];
    error: string | null;
    sessionDir: string;
    rpcLogPath: string;
    client: PiRpcClient;
    disposed: boolean;
    lastProgressSignature: string | null;
    itemSeq: number;
    persistTimer: NodeJS.Timeout | null;
}

/**
 * Pi 下载 Agent 会话服务接口。
 */
export default interface PiDownloadService {
    /** 启动一个新的下载对话会话并发送预设下载提示词。 */
    startDownload(url: string, outputDir?: string): Promise<PiDownloadSessionDetailVO>;
    /** 向指定会话追加用户指令。 */
    sendMessage(sessionId: string, message: string): Promise<void>;
    /** 中止指定会话当前正在执行的回合。 */
    abort(sessionId: string): Promise<void>;
    /** 关闭并清理指定会话的子进程（保留持久化记录）。 */
    close(sessionId: string): Promise<void>;
    /** 列出所有下载会话摘要（含历史持久化记录，按创建时间倒序）。 */
    listSessions(): Promise<PiDownloadSessionVO[]>;
    /** 获取指定会话的完整详情与历史对话时间线。 */
    getSession(sessionId: string): Promise<PiDownloadSessionDetailVO | null>;
    /** 删除指定历史会话及其持久化目录。 */
    deleteSession(sessionId: string): Promise<void>;
    /** 获取下载工作台基础上下文（如最终输出目录）。 */
    getContext(): Promise<{ videosDir: string }>;
}

/**
 * 基于 `pi --mode rpc` 的媒体下载会话服务实现。
 *
 * 将会话工作区、对话时间线与原始 RPC 事件持久化到 `<storage.path>/downloads/`，
 * 便于历史回看与问题定位；同时把共享工具目录与常见用户工具路径注入 PATH。
 */
@injectable()
export class PiDownloadServiceImpl implements PiDownloadService {
    private readonly logger = getMainLogger('PiDownloadService');
    private readonly sessions = new Map<string, ActiveDownloadSession>();

    constructor(
        @inject(TYPES.PiRuntimeService) private readonly piRuntimeService: PiRuntimeService,
        @inject(TYPES.StorageDirectoryProvider) private readonly storageDirectoryProvider: StorageDirectoryProvider,
        @inject(TYPES.RendererGateway) private readonly rendererGateway: RendererGateway,
        @inject(TYPES.MediaService) private readonly mediaService: MediaService,
    ) {}

    /**
     * 启动新的下载会话：创建持久化工作区、同步隔离 AI 配置并启动 `pi --mode rpc`。
     * @param rawUrl 用户输入的目标链接。
     * @param rawOutputDir 本次会话指定的保存目录（可选，默认使用应用视频目录）。
     */
    public async startDownload(rawUrl: string, rawOutputDir?: string): Promise<PiDownloadSessionDetailVO> {
        const url = rawUrl.trim();
        if (url.length === 0) {
            throw new Error('请输入有效的下载链接');
        }

        const executablePath = await this.piRuntimeService.requireExecutablePath();
        const agentDir = await this.piRuntimeService.getIsolatedAgentDir();
        await ensurePiStageExtension(agentDir);
        const modelId = await this.syncIsolatedModelsConfig(agentDir);

        const downloadsRoot = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.DOWNLOAD_WORKSPACE);
        let videosDir: string;
        if (rawOutputDir && rawOutputDir.trim().length > 0) {
            videosDir = path.resolve(rawOutputDir.trim());
            await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(videosDir);
            await fsp.mkdir(videosDir, { recursive: true });
        } else {
            videosDir = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.VIDEOS);
        }

        const toolsDir = path.join(downloadsRoot, TOOLS_DIR_NAME);
        await fsp.mkdir(toolsDir, { recursive: true });

        const sessionId = randomUUID();
        const sessionDir = path.join(downloadsRoot, SESSIONS_DIR_NAME, `${Date.now()}-${sessionId.slice(0, 8)}`);
        const workspaceDir = path.join(sessionDir, WORKSPACE_DIR_NAME);
        const rpcLogPath = path.join(sessionDir, RPC_LOG_FILE_NAME);
        const systemPromptPath = path.join(sessionDir, 'system-prompt.md');
        await fsp.mkdir(workspaceDir, { recursive: true });

        const systemPrompt = buildPiDownloadSystemPrompt({ workspaceDir, toolsDir, videosDir });
        await fsp.writeFile(systemPromptPath, systemPrompt, 'utf8');

        const now = Date.now();
        const vo: PiDownloadSessionVO = {
            sessionId,
            url,
            workspaceDir,
            videosDir,
            status: 'starting',
            progress: {
                phase: 'checking_env',
                percent: null,
                detail: '正在启动 Pi Agent...',
            },
            createdAt: now,
            updatedAt: now,
        };

        const env = this.buildProcessEnv(agentDir, toolsDir);
        const client = new PiRpcClient({
            executablePath,
            cwd: workspaceDir,
            provider: DASHPLAYER_PROVIDER_ID,
            modelId,
            appendSystemPrompt: systemPromptPath,
            env,
            onRecord: (record) => this.handleRpcRecord(sessionId, record),
            onStderr: (text) => {
                this.appendRpcLog(sessionId, { source: 'stderr', text });
                this.applyAndEmitEvent(sessionId, { sessionId, kind: 'stderr', text });
            },
            onExit: (code, signal) => {
                this.handleProcessExit(sessionId, code, signal);
            },
            onError: (error) => {
                this.updateStatus(sessionId, 'error', error.message);
            },
        });

        const activeSession: ActiveDownloadSession = {
            vo,
            items: [],
            error: null,
            sessionDir,
            rpcLogPath,
            client,
            disposed: false,
            lastProgressSignature: null,
            itemSeq: 0,
            persistTimer: null,
        };
        this.sessions.set(sessionId, activeSession);

        const initialUserMessage = buildPiDownloadUserMessage(url);
        this.applyAndEmitEvent(sessionId, {
            sessionId,
            kind: 'system_prompt',
            text: systemPrompt,
        });
        this.applyAndEmitEvent(sessionId, {
            sessionId,
            kind: 'user_message',
            text: initialUserMessage,
            timestamp: Date.now(),
        });
        this.updateStatus(sessionId, 'running');
        await this.persistSessionNow(activeSession);
        client.prompt(initialUserMessage);

        this.logger.info('started pi download session', { sessionId, workspaceDir, videosDir, modelId });
        return {
            session: { ...activeSession.vo },
            items: activeSession.items.map((item) => ({ ...item })),
            error: activeSession.error,
        };
    }

    /**
     * 向指定会话发送后续消息（运行中采用 steer 插话，空闲时直接发起新回合）。
     */
    public async sendMessage(sessionId: string, rawMessage: string): Promise<void> {
        const session = this.requireActiveSession(sessionId);
        const message = rawMessage.trim();
        if (message.length === 0) {
            return;
        }
        if (session.vo.status === 'closed') {
            throw new Error('下载会话已关闭');
        }

        const isActive = session.vo.status === 'running' || session.vo.status === 'starting';
        this.applyAndEmitEvent(sessionId, {
            sessionId,
            kind: 'user_message',
            text: message,
            timestamp: Date.now(),
        });
        this.updateStatus(sessionId, 'running');
        session.client.prompt(message, isActive ? 'steer' : undefined);
    }

    /**
     * 中止指定会话的当前回合。
     */
    public async abort(sessionId: string): Promise<void> {
        const session = this.requireActiveSession(sessionId);
        session.client.abort();
    }

    /**
     * 关闭并销毁指定会话的子进程，同时落盘最终会话状态。
     */
    public async close(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }
        session.disposed = true;
        session.client.dispose();
        this.updateStatus(sessionId, 'closed');
        await this.persistSessionNow(session);
        this.sessions.delete(sessionId);
    }

    /**
     * 列出所有会话摘要（合并内存中活跃会话与磁盘持久化历史会话）。
     */
    public async listSessions(): Promise<PiDownloadSessionVO[]> {
        const result = new Map<string, PiDownloadSessionVO>();

        for (const active of this.sessions.values()) {
            result.set(active.vo.sessionId, { ...active.vo });
        }

        const sessionDirs = await this.listPersistedSessionDirs();
        for (const dir of sessionDirs) {
            const detail = await this.readPersistedSessionFile(path.join(dir, SESSION_FILE_NAME));
            if (!detail) {
                continue;
            }
            if (!result.has(detail.session.sessionId)) {
                result.set(detail.session.sessionId, this.normalizeDetachedSession(detail.session));
            }
        }

        return Array.from(result.values()).sort((a, b) => b.createdAt - a.createdAt);
    }

    /**
     * 获取指定会话的完整详情（含历史对话与工具执行记录）。
     */
    public async getSession(sessionId: string): Promise<PiDownloadSessionDetailVO | null> {
        const active = this.sessions.get(sessionId);
        if (active) {
            return {
                session: { ...active.vo },
                items: active.items.map((item) => ({ ...item })),
                error: active.error,
            };
        }

        const sessionDirs = await this.listPersistedSessionDirs();
        for (const dir of sessionDirs) {
            const detail = await this.readPersistedSessionFile(path.join(dir, SESSION_FILE_NAME));
            if (detail && detail.session.sessionId === sessionId) {
                return {
                    ...detail,
                    session: this.normalizeDetachedSession(detail.session),
                };
            }
        }
        return null;
    }

    /**
     * 删除指定会话及其持久化目录。
     */
    public async deleteSession(sessionId: string): Promise<void> {
        const active = this.sessions.get(sessionId);
        if (active) {
            active.disposed = true;
            if (active.persistTimer) {
                clearTimeout(active.persistTimer);
                active.persistTimer = null;
            }
            active.client.dispose();
            this.sessions.delete(sessionId);
            await fsp.rm(active.sessionDir, { recursive: true, force: true });
            return;
        }

        const sessionDirs = await this.listPersistedSessionDirs();
        for (const dir of sessionDirs) {
            const detail = await this.readPersistedSessionFile(path.join(dir, SESSION_FILE_NAME));
            if (detail && detail.session.sessionId === sessionId) {
                await fsp.rm(dir, { recursive: true, force: true });
                return;
            }
        }
    }

    /**
     * 获取下载工作台基础上下文（如配置好的最终视频保存目录）。
     */
    public async getContext(): Promise<{ videosDir: string }> {
        const videosDir = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.VIDEOS);
        return { videosDir };
    }

    private requireActiveSession(sessionId: string): ActiveDownloadSession {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`下载会话不存在或已结束: ${sessionId}`);
        }
        return session;
    }

    /**
     * 若历史会话来自上次应用运行（已脱离内存进程），把残留的运行中状态修正为已结束。
     */
    private normalizeDetachedSession(session: PiDownloadSessionVO): PiDownloadSessionVO {
        if (session.status === 'running' || session.status === 'starting') {
            return { ...session, status: 'closed' };
        }
        return session;
    }

    private async listPersistedSessionDirs(): Promise<string[]> {
        try {
            const downloadsRoot = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.DOWNLOAD_WORKSPACE);
            const sessionsRoot = path.join(downloadsRoot, SESSIONS_DIR_NAME);
            const entries = await fsp.readdir(sessionsRoot, { withFileTypes: true });
            return entries
                .filter((entry) => entry.isDirectory())
                .map((entry) => path.join(sessionsRoot, entry.name));
        } catch {
            return [];
        }
    }

    private async readPersistedSessionFile(filePath: string): Promise<PiDownloadSessionDetailVO | null> {
        try {
            const raw = await fsp.readFile(filePath, 'utf8');
            const parsed = JSON.parse(raw) as PiDownloadSessionDetailVO;
            if (!parsed?.session?.sessionId || !Array.isArray(parsed.items)) {
                return null;
            }
            return parsed;
        } catch {
            return null;
        }
    }

    private schedulePersist(session: ActiveDownloadSession): void {
        if (session.persistTimer) {
            return;
        }
        session.persistTimer = setTimeout(() => {
            session.persistTimer = null;
            void this.persistSessionNow(session);
        }, 400);
        session.persistTimer.unref?.();
    }

    private async persistSessionNow(session: ActiveDownloadSession): Promise<void> {
        if (session.persistTimer) {
            clearTimeout(session.persistTimer);
            session.persistTimer = null;
        }
        const detail: PiDownloadSessionDetailVO = {
            session: { ...session.vo },
            items: session.items,
            error: session.error,
        };
        try {
            await fsp.writeFile(
                path.join(session.sessionDir, SESSION_FILE_NAME),
                JSON.stringify(detail, null, 2),
                'utf8',
            );
        } catch (error) {
            this.logger.warn('failed to persist pi download session', {
                sessionId: session.vo.sessionId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    private appendRpcLog(sessionId: string, record: unknown): void {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }
        const line = `${JSON.stringify({ ts: Date.now(), record })}\n`;
        void fsp.appendFile(session.rpcLogPath, line, 'utf8').catch(() => undefined);
    }

    /**
     * 把 DashPlayer 当前配置的云端 AI 凭据写入受管 `PI_CODING_AGENT_DIR/models.json`。
     */
    private async syncIsolatedModelsConfig(agentDir: string): Promise<string> {
        const apiKey = storeGet('apiKeys.openAi.key');
        const endpoint = storeGet('apiKeys.openAi.endpoint');
        const apiFormat = storeGet('apiKeys.openAi.apiFormat');

        if (StrUtil.hasBlank(apiKey, endpoint)) {
            throw new Error('云端 AI 未配置：请先到「设置 → 服务与资源」填写 API Key 和接口地址');
        }
        if (!AI_API_FORMATS.includes(apiFormat as AiApiFormat)) {
            throw new Error(`不支持的 AI 接口格式: ${apiFormat}`);
        }

        const availableRaw = storeGet('models.openai.available');
        const availableModels = availableRaw
            .split(/[\n,]/)
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
        if (availableModels.length === 0) {
            throw new Error('可用云端模型列表为空，请先在「设置 → 服务与资源」添加模型');
        }

        const preferredModel = storeGet('models.openai.sentenceLearning').trim();
        const modelId = availableModels.includes(preferredModel) ? preferredModel : availableModels[0];

        const piApiType = this.mapApiFormatToPiApi(apiFormat as AiApiFormat);
        const modelsConfig = {
            providers: {
                [DASHPLAYER_PROVIDER_ID]: {
                    baseUrl: endpoint.trim(),
                    apiKey: apiKey.trim(),
                    api: piApiType,
                    models: [{ id: modelId }],
                },
            },
        };

        await fsp.writeFile(path.join(agentDir, 'models.json'), JSON.stringify(modelsConfig, null, 2), 'utf8');
        return modelId;
    }

    private mapApiFormatToPiApi(format: AiApiFormat): string {
        if (format === 'anthropic') {
            return 'anthropic-messages';
        }
        if (format === 'gemini') {
            return 'google-generative-ai';
        }
        return 'openai-completions';
    }

    /**
     * 组装子进程环境变量：注入受管配置目录、受管工具目录 PATH 与代理设置。
     */
    private buildProcessEnv(agentDir: string, toolsDir: string): NodeJS.ProcessEnv {
        const existingPath = process.env.PATH ?? '';
        const mergedPath = Array.from(
            new Set([
                toolsDir,
                ...existingPath.split(path.delimiter).filter((item) => item.length > 0),
            ]),
        ).join(path.delimiter);

        const env: NodeJS.ProcessEnv = {
            PI_CODING_AGENT_DIR: agentDir,
            PATH: mergedPath,
        };

        const proxyMode = storeGet('proxy.mode');
        const proxyUrl = storeGet('proxy.url').trim();
        if (proxyMode === 'custom' && proxyUrl.length > 0) {
            env.HTTP_PROXY = proxyUrl;
            env.HTTPS_PROXY = proxyUrl;
            env.ALL_PROXY = proxyUrl;
        } else if (proxyMode === 'none') {
            env.HTTP_PROXY = '';
            env.HTTPS_PROXY = '';
            env.ALL_PROXY = '';
        }
        return env;
    }

    private handleRpcRecord(sessionId: string, record: Record<string, unknown>): void {
        this.appendRpcLog(sessionId, record);
        const type = record.type;

        if (type === 'response') {
            if (record.success === false) {
                const errorText = typeof record.error === 'string' ? record.error : 'Pi RPC 指令执行失败';
                this.updateStatus(sessionId, 'error', errorText);
            }
            return;
        }

        if (type === 'agent_start') {
            this.updateStatus(sessionId, 'running');
            return;
        }

        if (type === 'agent_settled') {
            const aborted = record.aborted === true;
            this.updateStatus(sessionId, aborted ? 'aborted' : 'idle');
            const session = this.sessions.get(sessionId);
            if (session) {
                void this.persistSessionNow(session);
            }
            return;
        }

        if (type === 'message_start') {
            const message = record.message as { role?: unknown } | undefined;
            if (message?.role === 'assistant') {
                this.applyAndEmitEvent(sessionId, { sessionId, kind: 'assistant_start' });
            }
            return;
        }

        if (type === 'message_update') {
            const nested = record.assistantMessageEvent as { type?: unknown; delta?: unknown; error?: unknown } | undefined;
            if (!nested) {
                return;
            }
            if (nested.type === 'text_delta' && typeof nested.delta === 'string') {
                this.applyAndEmitEvent(sessionId, { sessionId, kind: 'assistant_text_delta', delta: nested.delta });
            } else if (nested.type === 'thinking_delta' && typeof nested.delta === 'string') {
                this.applyAndEmitEvent(sessionId, { sessionId, kind: 'assistant_thinking_delta', delta: nested.delta });
            } else if (nested.type === 'error' && nested.error) {
                const message = typeof nested.error === 'string' ? nested.error : JSON.stringify(nested.error);
                this.updateStatus(sessionId, 'error', message);
            }
            return;
        }

        if (type === 'message_end') {
            const message = record.message as { role?: unknown } | undefined;
            if (message?.role === 'assistant') {
                this.applyAndEmitEvent(sessionId, { sessionId, kind: 'assistant_end' });
            }
            return;
        }

        if (type === 'tool_execution_start') {
            const toolName = String(record.toolName ?? 'tool');
            if (toolName === 'report_stage') {
                const parsedStage = parseReportStageToolArgs(record.args);
                if (parsedStage) {
                    this.emitProgressIfChanged(sessionId, parsedStage.progress);
                    if (parsedStage.progress.phase === 'downloading') {
                        this.upsertMediaCard(sessionId, {
                            state: 'downloading',
                            title: parsedStage.title ?? parsedStage.progress.detail ?? '正在下载视频...',
                            percent: null,
                        });
                    }
                }
                return;
            }
            if (toolName === 'present_video') {
                const card = parsePresentVideoToolArgs(record.args);
                if (card) {
                    void this.enrichAndUpsertVideoCard(sessionId, card);
                }
                return;
            }
            this.applyAndEmitEvent(sessionId, {
                sessionId,
                kind: 'tool_start',
                toolCallId: String(record.toolCallId ?? ''),
                toolName,
                args: record.args,
            });
            return;
        }

        if (type === 'tool_execution_update') {
            const toolName = String(record.toolName ?? 'tool');
            if (toolName === 'report_stage' || toolName === 'present_video') {
                return;
            }
            const output = this.extractToolText(record.partialResult);
            this.consumeToolOutputProgress(sessionId, output);
            this.applyAndEmitEvent(sessionId, {
                sessionId,
                kind: 'tool_update',
                toolCallId: String(record.toolCallId ?? ''),
                toolName,
                output,
            });
            return;
        }

        if (type === 'tool_execution_end') {
            const toolName = String(record.toolName ?? 'tool');
            if (toolName === 'report_stage' || toolName === 'present_video') {
                return;
            }
            const output = this.extractToolText(record.result);
            this.consumeToolOutputProgress(sessionId, output);
            this.applyAndEmitEvent(sessionId, {
                sessionId,
                kind: 'tool_end',
                toolCallId: String(record.toolCallId ?? ''),
                toolName,
                output,
                isError: record.isError === true,
            });
        }
    }

    private consumeToolOutputProgress(sessionId: string, output: string): void {
        if (output.length === 0) {
            return;
        }
        const progress = parseLatestToolProgressFromChunk(output);
        if (progress) {
            this.emitProgressIfChanged(sessionId, progress);
            if (progress.phase === 'downloading') {
                const existingCard = this.findLatestMediaCard(sessionId);
                if (!existingCard || existingCard.state === 'downloading') {
                    this.upsertMediaCard(sessionId, {
                        state: 'downloading',
                        title: existingCard?.title ?? '正在下载视频...',
                        percent: progress.percent ?? existingCard?.percent ?? null,
                        detail: progress.detail ?? existingCard?.detail,
                    });
                }
            }
        }
    }

    private findLatestMediaCard(sessionId: string): PiDownloadMediaCardInfo | null {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }
        for (let i = session.items.length - 1; i >= 0; i -= 1) {
            const item = session.items[i];
            if (item.kind === 'media_card') {
                return item.card;
            }
        }
        return null;
    }

    private upsertMediaCard(sessionId: string, card: PiDownloadMediaCardInfo): void {
        this.applyAndEmitEvent(sessionId, {
            sessionId,
            kind: 'media_card',
            card,
        });
    }

    /**
     * 补全视频时长等元数据后推送就绪视频卡片，避免 AI 额外跑 ffprobe。
     */
    private async enrichAndUpsertVideoCard(sessionId: string, card: PiDownloadMediaCardInfo): Promise<void> {
        let enriched = card;
        if (card.videoPath && !card.durationText) {
            try {
                const info = await this.mediaService.info(card.videoPath);
                if (info.duration > 0) {
                    enriched = {
                        ...card,
                        durationText: TimeUtil.secondToTimeStrCompact(info.duration),
                    };
                }
            } catch {
                // 探测失败时仍展示基础视频卡片，不阻塞流程
            }
        }
        this.upsertMediaCard(sessionId, enriched);
    }

    private emitProgressIfChanged(sessionId: string, progress: PiDownloadProgressInfo): void {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }
        const signature = `${progress.phase}|${progress.percent ?? ''}|${progress.detail ?? ''}`;
        if (session.lastProgressSignature === signature) {
            return;
        }
        session.lastProgressSignature = signature;
        this.applyAndEmitEvent(sessionId, { sessionId, kind: 'progress', progress });
    }

    private extractToolText(result: unknown): string {
        if (!result || typeof result !== 'object') {
            return '';
        }
        const content = (result as { content?: unknown }).content;
        if (!Array.isArray(content)) {
            return '';
        }
        return content
            .map((part) => {
                if (part && typeof part === 'object' && (part as { type?: unknown }).type === 'text') {
                    return String((part as { text?: unknown }).text ?? '');
                }
                return '';
            })
            .filter((text) => text.length > 0)
            .join('\n');
    }

    private handleProcessExit(sessionId: string, code: number | null, signal: NodeJS.Signals | null): void {
        const session = this.sessions.get(sessionId);
        if (!session || session.disposed) {
            return;
        }
        if (code !== 0 && code !== null) {
            this.updateStatus(sessionId, 'error', `Pi 进程异常退出 (code=${code}, signal=${signal ?? 'none'})`);
        } else {
            this.updateStatus(sessionId, 'closed');
        }
        void this.persistSessionNow(session);
    }

    private updateStatus(sessionId: string, status: PiDownloadSessionStatus, error?: string): void {
        this.applyAndEmitEvent(sessionId, { sessionId, kind: 'status', status, error });
    }

    /**
     * 同步更新内存中的会话时间线与状态、触发异步落盘并推送到前端。
     */
    private applyAndEmitEvent(sessionId: string, event: PiDownloadStreamEvent): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.vo.updatedAt = Date.now();
            this.reduceSessionState(session, event);
            this.schedulePersist(session);
        }
        this.rendererGateway.fireAndForget('download/pi-event', event);
    }

    private reduceSessionState(session: ActiveDownloadSession, event: PiDownloadStreamEvent): void {
        const nextItemId = () => {
            session.itemSeq += 1;
            return `persisted-${session.itemSeq}`;
        };

        if (event.kind === 'status') {
            session.vo.status = event.status;
            if (event.error) {
                session.error = event.error;
            } else if (event.status === 'running') {
                session.error = null;
            }
            return;
        }

        if (event.kind === 'progress') {
            session.vo.progress = event.progress;
            return;
        }

        if (event.kind === 'media_card') {
            if (event.card.state === 'ready') {
                if (!session.vo.title && event.card.title) {
                    session.vo.title = event.card.title;
                }
                // 移除下载中占位进度卡片
                for (let i = session.items.length - 1; i >= 0; i -= 1) {
                    const item = session.items[i];
                    if (item.kind === 'media_card' && item.card.state === 'downloading') {
                        session.items.splice(i, 1);
                    }
                }
                // 合集场景下按 videoPath 区分，避免后续视频覆盖前面的卡片
                if (event.card.videoPath) {
                    const existing = session.items.find(
                        (item) => item.kind === 'media_card' && item.card.videoPath === event.card.videoPath,
                    );
                    if (existing && existing.kind === 'media_card') {
                        existing.card = event.card;
                        return;
                    }
                }
                session.items.push({
                    id: nextItemId(),
                    kind: 'media_card',
                    card: event.card,
                });
                return;
            }

            // downloading 状态只更新当前下载中的进度卡片
            for (let i = session.items.length - 1; i >= 0; i -= 1) {
                const item = session.items[i];
                if (item.kind === 'media_card' && item.card.state === 'downloading') {
                    item.card = event.card;
                    return;
                }
            }
            session.items.push({
                id: nextItemId(),
                kind: 'media_card',
                card: event.card,
            });
            return;
        }

        if (event.kind === 'system_prompt') {
            session.items.push({
                id: nextItemId(),
                kind: 'system',
                text: event.text,
            });
            return;
        }

        if (event.kind === 'user_message') {
            session.items.push({
                id: nextItemId(),
                kind: 'user',
                text: event.text,
                isInitialPrompt: false,
                timestamp: event.timestamp,
            });
            return;
        }

        if (event.kind === 'assistant_start') {
            session.items.push({
                id: nextItemId(),
                kind: 'assistant',
                text: '',
                thinking: '',
                streaming: true,
            });
            return;
        }

        if (event.kind === 'assistant_text_delta' || event.kind === 'assistant_thinking_delta') {
            for (let i = session.items.length - 1; i >= 0; i -= 1) {
                const target = session.items[i];
                if (target.kind === 'assistant') {
                    if (event.kind === 'assistant_text_delta') {
                        target.text += event.delta;
                    } else {
                        target.thinking += event.delta;
                    }
                    return;
                }
            }
            session.items.push({
                id: nextItemId(),
                kind: 'assistant',
                text: event.kind === 'assistant_text_delta' ? event.delta : '',
                thinking: event.kind === 'assistant_thinking_delta' ? event.delta : '',
                streaming: true,
            });
            return;
        }

        if (event.kind === 'assistant_end') {
            for (let i = session.items.length - 1; i >= 0; i -= 1) {
                const target = session.items[i];
                if (target.kind === 'assistant' && target.streaming) {
                    target.streaming = false;
                    return;
                }
            }
            return;
        }

        if (event.kind === 'tool_start') {
            session.items.push({
                id: nextItemId(),
                kind: 'tool',
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                args: event.args,
                output: '',
                status: 'running',
            });
            return;
        }

        if (event.kind === 'tool_update') {
            for (const item of session.items) {
                if (item.kind === 'tool' && item.toolCallId === event.toolCallId) {
                    item.output = event.output;
                }
            }
            return;
        }

        if (event.kind === 'tool_end') {
            for (const item of session.items) {
                if (item.kind === 'tool' && item.toolCallId === event.toolCallId) {
                    item.output = event.output || item.output;
                    item.status = event.isError ? 'error' : 'success';
                }
            }
            return;
        }

        if (event.kind === 'stderr') {
            const last = session.items[session.items.length - 1];
            if (last && last.kind === 'stderr') {
                last.text += event.text;
            } else {
                session.items.push({
                    id: nextItemId(),
                    kind: 'stderr',
                    text: event.text,
                });
            }
        }
    }
}
