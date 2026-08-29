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

    register('ui/show-notification', async (params) => {
        logger.debug('Show notification', { params });

        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(params.title, {
                body: params.message,
                icon: '/icon.png',
            });
            return;
        }

        alert(`${params.title}: ${params.message}`);
    });

    register('ui/show-confirm-dialog', async (params) => {
        logger.debug('Show confirmation dialog', { params });
        return true;
    });

    register('ui/update-progress', async (params) => {
        logger.debug('Update progress', { params });
        window.dispatchEvent(new CustomEvent('progress-update', { detail: params }));
    });

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

    register('translation/batch-result', async (params) => {
        // 字幕批次只回推最终结果，日志不记录完整译文。
        logger.info('字幕翻译回推已到达 renderer handler', {
            count: params.translations.length,
            fileHashes: Array.from(new Set(params.translations.map((item) => item.fileHash))),
        });
        useTranslation.getState().updateTranslations(params.translations);
        logger.info('字幕翻译回推已写入状态仓库', {
            count: params.translations.length,
        });
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
                    toast('Transcript done', { icon: '🚀' });
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
        playerActions.loadSubtitles(params.sentences);
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
