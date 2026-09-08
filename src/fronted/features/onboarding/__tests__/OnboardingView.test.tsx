import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OnboardingView, { CURRENT_ONBOARDING_VERSION } from '../OnboardingView';
import { backendClient } from '@/fronted/infrastructure/electron/backendClient';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import { ONBOARDING_COMPLETED_VERSION_KEY } from '@/common/constants/systemConfigKeys';

vi.mock('@/fronted/infrastructure/electron/backendClient', () => ({
    backendClient: {
        call: vi.fn(),
    },
}));

vi.mock('@/fronted/features/settings/settingsApi', () => ({
    settingsApi: {
        getSherpaTtsModelStatus: vi.fn(),
        getParakeetModelStatus: vi.fn(),
        downloadSherpaTtsModel: vi.fn(),
        downloadParakeetModel: vi.fn(),
        getLocalAiStatus: vi.fn(),
        downloadLocalAi: vi.fn(),
        getServiceCredentials: vi.fn(),
        saveServiceCredentials: vi.fn(),
        testServiceCredential: vi.fn(),
        getEngineSelection: vi.fn(),
        saveEngineSelection: vi.fn(),
    },
}));

vi.mock('@/fronted/components/layout/TitleBar/TitleBar', () => ({
    default: () => <div data-testid="title-bar" />,
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: any) => {
            if (key === 'stepIndicator') return `Step ${opts?.current} of ${opts?.total}`;
            return key;
        },
    }),
}));

describe('OnboardingView Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(backendClient.call).mockImplementation(async (route: string) => {
            if (route === 'system/config/get') {
                return null;
            }
            return undefined;
        });
        vi.mocked(settingsApi.getSherpaTtsModelStatus).mockResolvedValue({
            ready: true,
            downloading: false,
            phase: null,
            percent: 100,
            downloadUrl: 'https://example.com/tts.tar.bz2',
            archivePath: '/path/tts',
            modelPath: '/path/tts/model',
            missingFiles: [],
        });
        vi.mocked(settingsApi.getParakeetModelStatus).mockResolvedValue({
            ready: false,
            downloading: false,
            phase: null,
            percent: 0,
            downloadUrl: 'https://example.com/parakeet.tar.bz2',
            archivePath: '/path/parakeet',
            modelPath: '/path/parakeet/model',
            missingFiles: [],
        });
        vi.mocked(settingsApi.getLocalAiStatus).mockResolvedValue({
            runtimeReady: true,
            running: false,
            activeModelId: 'qwen3.5-2b-q4_k_m',
            modelsDirectory: '/path/models',
            models: [
                {
                    modelId: 'qwen3.5-2b-q4_k_m',
                    name: 'Qwen3.5 2B Q4_K_M',
                    file: 'Qwen3.5-2B-Q4_K_M.gguf',
                    bytes: 1280835840,
                    sizeLabel: '~1.28 GB',
                    memoryEstimateGb: '1.9',
                    ready: false,
                    phase: 'idle',
                    downloaded: 0,
                    total: 1280835840,
                    modelPath: '/path/models/Qwen3.5-2B-Q4_K_M.gguf',
                    downloadUrl: 'https://example.com/qwen.gguf',
                    error: null,
                    custom: false,
                },
            ],
        });
        vi.mocked(settingsApi.getServiceCredentials).mockResolvedValue({
            openai: {
                key: '',
                endpoint: 'https://api.openai.com',
                autoAppendV1: true,
                models: [{ model: 'gpt-4o-mini', inUseBy: [] }],
            },
            tencent: {
                secretId: '',
                secretKey: '',
            },
        });
        vi.mocked(settingsApi.getEngineSelection).mockResolvedValue({
            openai: {
                enableSentenceLearning: true,
                subtitleTranslationMode: 'zh',
                subtitleCustomStyle: '',
                featureModels: {
                    sentenceLearning: 'gpt-4o-mini',
                    subtitleTranslation: 'gpt-4o-mini',
                    dictionary: 'gpt-4o-mini',
                },
            },
            providers: {
                subtitleTranslationEngine: 'openai',
                dictionaryEngine: 'openai',
            },
            invalidValues: {},
        });
    });

    it('renders initial step with model information', async () => {
        render(<OnboardingView />);
        expect(screen.getByText('dialogTitle')).toBeDefined();
        expect(screen.getByText('steps.models.title')).toBeDefined();
        await waitFor(() => {
            expect(settingsApi.getSherpaTtsModelStatus).toHaveBeenCalled();
            expect(settingsApi.getParakeetModelStatus).toHaveBeenCalled();
        });
    });

    it('allows in-place local LLM download in Step 2', async () => {
        render(<OnboardingView />);

        // Go to Step 2
        const nextButton = screen.getByText('nextStep');
        fireEvent.click(nextButton);

        // Expect local model download button to be present
        const downloadLocalModelBtn = screen.getByText('steps.translation.localModelActionDownload');
        fireEvent.click(downloadLocalModelBtn);

        expect(settingsApi.downloadLocalAi).toHaveBeenCalledWith('qwen3.5-2b-q4_k_m');
    });

    it('allows entering cloud API key and saving credentials on finish', async () => {
        const onCompleted = vi.fn();
        render(<OnboardingView onCompleted={onCompleted} />);

        // Step 1 -> Step 2
        fireEvent.click(screen.getByText('nextStep'));

        // Step 2: Select OpenAI
        fireEvent.click(screen.getByText('steps.translation.optionOpenAiTitle'));

        const keyInput = screen.getByPlaceholderText('steps.translation.openaiKeyPlaceholder');
        fireEvent.change(keyInput, { target: { value: 'sk-test-123456' } });

        // Step 2 -> Step 3
        fireEvent.click(screen.getByText('nextStep'));

        // Step 3 -> Finish
        fireEvent.click(screen.getByText('finish'));

        await waitFor(() => {
            expect(settingsApi.saveServiceCredentials).toHaveBeenCalledWith(
                expect.objectContaining({
                    openai: expect.objectContaining({
                        key: 'sk-test-123456',
                    }),
                })
            );
            expect(settingsApi.saveEngineSelection).toHaveBeenCalledWith(
                expect.objectContaining({
                    providers: expect.objectContaining({
                        subtitleTranslationEngine: 'openai',
                        dictionaryEngine: 'openai',
                    }),
                })
            );
            expect(backendClient.call).toHaveBeenCalledWith('system/config/set', {
                key: ONBOARDING_COMPLETED_VERSION_KEY,
                value: CURRENT_ONBOARDING_VERSION,
            });
            expect(onCompleted).toHaveBeenCalled();
        });
    });

    it('saves completed status immediately when skipping', async () => {
        const onCompleted = vi.fn();
        render(<OnboardingView onCompleted={onCompleted} />);

        const skipButton = screen.getByText('skip');
        fireEvent.click(skipButton);

        await waitFor(() => {
            expect(backendClient.call).toHaveBeenCalledWith('system/config/set', {
                key: ONBOARDING_COMPLETED_VERSION_KEY,
                value: CURRENT_ONBOARDING_VERSION,
            });
            expect(onCompleted).toHaveBeenCalled();
        });
    });
});
