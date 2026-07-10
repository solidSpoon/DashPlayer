import { describe, expect, it, vi } from 'vitest';
import TranslateServiceImpl from '../TranslateServiceImpl';

vi.mock('electron', () => ({
    app: {
        getPath: vi.fn(() => '/tmp/dashplayer-test')
    }
}));

vi.mock('inversify', () => ({
    injectable: () => (target: unknown) => target,
    inject: () => (target: unknown, _propertyKey: string) => target,
}));

describe('TranslateServiceImpl OpenAI text fallback', () => {
    it('uses chat completions so OpenAI-compatible providers can translate subtitle batches', async () => {
        const service = new TranslateServiceImpl() as unknown as {
            openAiService: {
                getOpenAi: ReturnType<typeof vi.fn>;
            };
            modelRoutingService: {
                resolveOpenAiModel: ReturnType<typeof vi.fn>;
            };
            translateOpenAIBatchWithText: (
                prompt: string,
                windowSentences: Array<{ fileHash: string; translationKey: string }>
            ) => Promise<Array<{ key: string; fileHash: string; translation: string }>>;
        };
        const create = vi.fn().mockResolvedValue({
            choices: [
                {
                    message: {
                        content: JSON.stringify({
                            items: [
                                { key: 'file-a:1', translation: '你好' }
                            ]
                        })
                    }
                }
            ]
        });
        service.openAiService = {
            getOpenAi: vi.fn().mockReturnValue({
                chat: {
                    completions: {
                        create
                    }
                }
            })
        };
        service.modelRoutingService = {
            resolveOpenAiModel: vi.fn().mockReturnValue({
                modelId: 'deepseek-v4-flash'
            })
        };

        const result = await service.translateOpenAIBatchWithText('Translate this batch', [
            { fileHash: 'file-a', translationKey: 'file-a:1' }
        ]);

        expect(create).toHaveBeenCalledWith(expect.objectContaining({
            model: 'deepseek-v4-flash',
            messages: expect.arrayContaining([
                expect.objectContaining({ role: 'user', content: 'Translate this batch' })
            ])
        }));
        expect(result).toEqual([
            { key: 'file-a:1', fileHash: 'file-a', translation: '你好' }
        ]);
    });
});
