import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingView, CURRENT_ONBOARDING_VERSION } from '../OnboardingView';
import { markOnboardingCompleted } from '../onboardingApi';
import { settingsApi } from '@/fronted/features/settings/settingsApi';

vi.mock('@/fronted/features/onboarding/onboardingApi', () => ({
    markOnboardingCompleted: vi.fn(),
}));

vi.mock('@/fronted/features/settings/settingsApi', () => ({
    settingsApi: {
        getTranscriptionEngine: vi.fn(),
        getStorageStatus: vi.fn(),
        selectStorageFolder: vi.fn(),
        saveStorage: vi.fn(),
        openUrl: vi.fn(),
        openFolderForFile: vi.fn(),
        getSherpaTtsModelStatus: vi.fn(),
        getWhisperCppModelStatus: vi.fn(),
        getParakeetModelStatus: vi.fn(),
        downloadSherpaTtsModel: vi.fn(),
        downloadWhisperCppModel: vi.fn(),
        downloadParakeetModel: vi.fn(),
        cancelSherpaTtsModelDownload: vi.fn(),
        cancelWhisperCppModelDownload: vi.fn(),
        cancelParakeetModelDownload: vi.fn(),
        getLocalAiStatus: vi.fn(),
        getLocalMtStatus: vi.fn(),
        downloadLocalAi: vi.fn(),
        cancelLocalAiDownload: vi.fn(),
        downloadLocalMt: vi.fn(),
        cancelLocalMtDownload: vi.fn(),
        getServiceCredentials: vi.fn(),
        saveServiceCredentials: vi.fn(),
        testOpenAi: vi.fn(),
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
        vi.mocked(markOnboardingCompleted).mockResolvedValue();
        vi.mocked(settingsApi.getTranscriptionEngine).mockResolvedValue('whisper-cpp');
        vi.mocked(settingsApi.getStorageStatus).mockResolvedValue({
            configuredPath: '',
            resolvedPath: '/Users/test/DashPlayer',
            exists: true,
            isDirectory: true,
            readable: true,
            writable: true,
            available: true,
            code: 'ok',
            message: '',
        });
        vi.mocked(settingsApi.getSherpaTtsModelStatus).mockResolvedValue({
            ready: true,
            downloading: false,
            phase: null,
            percent: 100,
            downloadUrls: ['https://example.com/tts.tar.bz2'],
            archivePath: '/path/tts',
            modelPath: '/path/tts/model',
            missingFiles: [],
        });
        vi.mocked(settingsApi.getWhisperCppModelStatus).mockResolvedValue({
            ready: false,
            downloading: false,
            phase: null,
            percent: 0,
            downloadUrls: ['https://example.com/whisper-cpp.gguf'],
            archivePath: '/path/whisper-cpp',
            modelPath: '/path/whisper-cpp/model',
            missingFiles: [],
        });
        vi.mocked(settingsApi.getParakeetModelStatus).mockResolvedValue({
            ready: false,
            downloading: false,
            phase: null,
            percent: 0,
            downloadUrls: ['https://example.com/parakeet.tar.bz2'],
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
                    downloadUrls: ['https://example.com/qwen.gguf', 'https://hf-mirror.com/qwen.gguf'],
                    error: null,
                    custom: false,
                },
            ],
        });
        vi.mocked(settingsApi.getLocalMtStatus).mockResolvedValue({
            ready: false,
            phase: 'idle',
            downloaded: 0,
            total: 1,
            modelPath: '/path/local-mt',
            downloadUrl: 'https://example.com/local-mt',
            error: null,
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
        expect(screen.getByText('steps.storage.title')).toBeDefined();
        await waitFor(() => {
            expect(settingsApi.getSherpaTtsModelStatus).toHaveBeenCalled();
            expect(settingsApi.getWhisperCppModelStatus).toHaveBeenCalled();
        });
    });

    it('allows downloading the selected local model in the translation step', async () => {
        render(<OnboardingView />);

        // 存储位置 -> 离线模型 -> 翻译与词典
        fireEvent.click(screen.getByText('nextStep'));
        fireEvent.click(screen.getByText('nextStep'));

        // 默认字幕翻译是本地快速翻译，页面上只有一个下载按钮
        fireEvent.click(screen.getByText('steps.models.actionDownload'));

        expect(settingsApi.downloadLocalMt).toHaveBeenCalled();
    });

    it('allows entering cloud API key and saving credentials on finish', async () => {
        const onCompleted = vi.fn();
        render(<OnboardingView onCompleted={onCompleted} />);

        // 存储位置 -> 离线模型 -> 翻译与词典
        fireEvent.click(screen.getByText('nextStep'));
        fireEvent.click(screen.getByText('nextStep'));

        // 打开「字幕翻译」下拉并选择云端大模型（Radix Select 需要真实指针事件）
        const user = userEvent.setup();
        await user.click(screen.getAllByRole('combobox')[0]);
        await user.click(await screen.findByText('steps.translation.translationCloud'));

        const keyInput = screen.getByPlaceholderText('steps.translation.openaiKeyPlaceholder');
        fireEvent.change(keyInput, { target: { value: 'sk-test-123456' } });

        // 翻译与词典 -> 完成配置（保存并进入完成页）
        fireEvent.click(screen.getByText('finishConfig'));

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
                        dictionaryEngine: 'none',
                    }),
                })
            );
            expect(markOnboardingCompleted).toHaveBeenCalledWith(CURRENT_ONBOARDING_VERSION);
        });

        // 完成页：开始使用后关闭引导
        fireEvent.click(screen.getByText('startUsing'));
        await waitFor(() => {
            expect(onCompleted).toHaveBeenCalled();
        });
    });

    it('saves completed status immediately when skipping', async () => {
        const onCompleted = vi.fn();
        render(<OnboardingView onCompleted={onCompleted} />);

        const skipButton = screen.getByText('skip');
        fireEvent.click(skipButton);

        await waitFor(() => {
            expect(markOnboardingCompleted).toHaveBeenCalledWith(CURRENT_ONBOARDING_VERSION);
            expect(onCompleted).toHaveBeenCalled();
        });
    });
});
