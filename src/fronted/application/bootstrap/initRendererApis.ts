import { RendererApiMap } from '@/common/api/renderer-api-def';
import useDictionaryStream from '@/fronted/hooks/useDictionaryStream';
import useTranscript from '@/fronted/hooks/useTranscript';
import useTranslation from '@/fronted/hooks/useTranslation';
import useVocabulary from '@/fronted/hooks/useVocabulary';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { rendererApiRegistry } from './rendererApiRegistry';

export function initRendererApis(): () => void {
    const logger = getRendererLogger('RendererApis');
    const unregisters: Array<() => void> = [];

    const register = <K extends keyof RendererApiMap>(path: K, handler: RendererApiMap[K]) => {
        const wrappedHandler = async (params: Parameters<RendererApiMap[K]>[0]) => {
            try {
                logger.info(`API called: ${path}`, { params });
                const result = await handler(params);
                logger.info(`API success: ${path}`);
                return result;
            } catch (error) {
                logger.error(`API error: ${path}`, {
                    error: error instanceof Error ? error.message : String(error),
                });
                throw error;
            }
        };

        unregisters.push(rendererApiRegistry.register(path, wrappedHandler as any));
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

    register('settings/whisper-model-download-progress', async (params) => {
        logger.debug('Whisper model download progress', { params });
        window.dispatchEvent(new CustomEvent('whisper-model-download-progress', { detail: params }));
    });

    register('translation/result', async (params) => {
        logger.debug('Translation result', { params });
        useTranslation.getState().updateTranslation(params);
    });

    register('translation/batch-result', async (params) => {
        logger.debug('Batch translation result', { params });
        useTranslation.getState().updateTranslations(params.translations);
    });

    register('transcript/batch-result', async (params) => {
        logger.debug('Batch transcription result', { params });
        useTranscript.getState().updateTranscriptTasks(params.updates);
    });

    register('vocabulary/match-result', async (params) => {
        logger.info('Vocabulary match result received', { count: params.vocabularyWords.length });
        useVocabulary.getState().setVocabularyWords(params.vocabularyWords);
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

    logger.info('renderer apis registered', { count: unregisters.length });

    return () => {
        unregisters.forEach((unregister) => unregister());
        logger.info('renderer apis unregistered');
    };
}

