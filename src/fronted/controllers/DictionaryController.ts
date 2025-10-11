import { BaseRendererController } from './BaseRendererController';
import useDictionaryStream from '@/fronted/hooks/useDictionaryStream';

export class DictionaryController extends BaseRendererController {
    readonly name = 'DictionaryController';

    protected setupApis(): void {
        this.registerApi('dictionary/openai-update', async ({ requestId, word, data, isComplete = false }) => {
            this.logger.debug('Received OpenAI dictionary update', {
                requestId,
                word,
                isComplete,
                hasDefinitions: data.definitions.length
            });

            useDictionaryStream.getState().receiveUpdate(requestId, word, data, isComplete);
        });
    }
}
