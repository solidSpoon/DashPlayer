import { RendererApiDefinitions, RendererApiMap } from '@/common/api/renderer-api-def';
import useDictionaryStream from '@/fronted/features/player/dictionaryStore';
import useChatPanel from '@/fronted/features/chat/chatStore';
import { receiveChatChunk } from '@/fronted/features/chat/chatTransport';
import useTranslation from '@/fronted/features/player/translationStore';
import { registerRendererApi } from '@/fronted/infrastructure/electron/rendererApiRegistry';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { SWR_KEY, swrMutate } from '@/fronted/lib/swr-util';
import { TranscriptTaskState } from '@/common/contracts/transcript/transcript-task';
import { transcriptApi } from '@/fronted/features/transcript/transcriptApi';
import toast from 'react-hot-toast';
import useFile from '@/fronted/features/file-browser/fileStore';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';

/**
 * 注册 main 进程可调用的 renderer 接口。
 *
 * @returns 注销本次全部 renderer 接口的函数。
 */
export function initRendererApis(): () => void {
    const logger = getRendererLogger('RendererApis');
    const unregisters: Array<() => void> = [];

    /**
     * 统一注册入口：只负责执行与错误兜底，日志粒度由各 handler 自行决定。
     */
    const register = <K extends keyof RendererApiMap>(path: K, handler: RendererApiMap[K]) => {
        const wrappedHandler = async (params: RendererApiDefinitions[K]['params']) => {
            try {
                return await handler(params);
            } catch (error) {
                logger.error('renderer api call failed', {
                    path,
                    error: error instanceof Error ? error.message : String(error),
                });
                throw error;
            }
        };

        unregisters.push(registerRendererApi(path, wrappedHandler as RendererApiMap[K]));
    };

    register('ui/show-toast', async (params) => {
        logger.debug('Show toast', { params });
        window.dispatchEvent(new CustomEvent('show-toast', { detail: params }));
    });

    register('settings/parakeet-model-download-progress', async (params) => {
        window.dispatchEvent(new CustomEvent('parakeet-model-download-progress', { detail: params }));
    });

    register('settings/sherpa-tts-model-download-progress', async (params) => {
        window.dispatchEvent(new CustomEvent('sherpa-tts-model-download-progress', { detail: params }));
    });

    register('settings/whisper-cpp-model-download-progress', async (params) => {
        window.dispatchEvent(new CustomEvent('whisper-cpp-model-download-progress', { detail: params }));
    });

    register('settings/local-ai-model-download-progress', async (params) => {
        window.dispatchEvent(new CustomEvent('local-ai-model-download-progress', { detail: params }));
    });

    register('settings/local-mt-download-progress', async (params) => {
        window.dispatchEvent(new CustomEvent('local-mt-download-progress', { detail: params }));
    });

    register('translation/batch-result', async (params) => {
        useTranslation.getState().updateTranslations(params.translations);
    });

    register('transcript/batch-result', async (params) => {
        logger.debug('Batch transcription result', {
            count: params.updates.length,
            statuses: params.updates.map((update) => update.status),
        });

        try {
            for (const update of params.updates) {
                if (update.status === TranscriptTaskState.DONE && update.result?.srtPath) {
                    await transcriptApi.attachSubtitle(update.filePath, 'same');
                    await swrMutate(SWR_KEY.PLAYER_P);
                    // 转录产出通常就是视频自己那份同名 SRT，解析出的路径与转录期间一模一样；
                    // 而字幕上下文的依赖里只有路径与重载令牌，路径没变就不会重建，增量字幕
                    // 与空 srtHash 会原地留着（配音、收藏、生词、自动切片全按 srtHash 开关）。
                    // 因此结束事件必须自己把重建意图表达出来，不能指望路径恰好变了。
                    if (update.filePath === useFile.getState().videoPath) {
                        useFile.getState().reloadSubtitles();
                    }
                    toast('Transcript done', { icon: '🚀' });
                    continue;
                }
                // 取消/失败后增量会话已结束，当前视频需回退到已挂载的真实字幕（无则清空）。
                if (
                    (update.status === TranscriptTaskState.CANCELLED || update.status === TranscriptTaskState.FAILED)
                    && update.filePath === useFile.getState().videoPath
                ) {
                    useFile.getState().reloadSubtitles();
                }
            }
        } finally {
            await swrMutate(SWR_KEY.TRANSCRIPTION_TASKS);
        }
    });

    register('transcript/chunk-result', async (params) => {
        if (params.filePath !== useFile.getState().videoPath) return;
        if (params.sentences.length === 0) return;
        useTranslation.getState().setActiveFileHash(params.sessionId);
        // 转录期间每完成一块推送一次全集；走合并入口，避免清掉逐句循环等播放期状态
        playerActions.mergeSubtitles(params.sentences);
    });

    register('dictionary/openai-update', async ({ requestId, word, data, isComplete = false }) => {
        logger.debug('Received OpenAI dictionary update', {
            requestId,
            word,
            isComplete,
            hasDefinitions: data.definitions.length,
        });

        useDictionaryStream.getState().receiveUpdate(requestId, word, data, isComplete);
    });

    register('chat/stream', async (params) => {
        // 标准消息流只记录生命周期片段，文本增量不落日志。
        if (params.chunk.type !== 'text-delta') {
            logger.debug('Chat stream event', {
                sessionId: params.sessionId,
                event: params.chunk.type,
            });
        }
        receiveChatChunk(params.sessionId, params.chunk);
    });

    register('chat/analysis/stream', async (params) => {
        if (params.chunk.type !== 'data-analysis') {
            logger.debug('Analysis stream event', {
                sessionId: params.sessionId,
                messageId: params.messageId,
                event: params.chunk.type,
            });
        }
        useChatPanel.getState().receiveAnalysisStream(params);
    });

    logger.info('renderer apis registered', { count: unregisters.length });

    return () => {
        unregisters.forEach((unregister) => unregister());
        logger.info('renderer apis unregistered');
    };
}
