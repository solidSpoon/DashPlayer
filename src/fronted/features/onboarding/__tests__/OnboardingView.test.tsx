import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OnboardingView, CURRENT_ONBOARDING_VERSION } from '../OnboardingView';
import { markOnboardingCompleted } from '../onboardingApi';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import type { LocalMtStatus } from '@/common/contracts/local-mt';

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
        getLocalMtStatus: vi.fn(),
        downloadLocalMt: vi.fn(),
        cancelLocalMtDownload: vi.fn(),
        getEngineSelection: vi.fn(),
        saveEngineSelection: vi.fn(),
    },
}));

vi.mock('@/fronted/components/layout/TitleBar/TitleBar', () => ({
    default: () => <div data-testid="title-bar" />,
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

/** 未下载完成的模型状态。 */
const NOT_READY = {
    ready: false,
    downloading: false,
    phase: null,
    percent: 0,
    downloadUrls: ['https://example.com/model.tar.bz2'],
    archivePath: '/path/model.tar.bz2',
    modelPath: '/path/model',
    missingFiles: [],
};

/** 未下载完成的轻量翻译模型状态。 */
function localMtStatus(ready: boolean): LocalMtStatus {
    return {
        ready,
        phase: 'idle',
        downloaded: ready ? 1 : 0,
        total: 1,
        modelPath: '/path/opus-mt-en-zh',
        downloadUrls: ['https://example.com/opus-mt-en-zh'],
        error: null,
    };
}

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
        vi.mocked(settingsApi.getSherpaTtsModelStatus).mockResolvedValue(NOT_READY);
        vi.mocked(settingsApi.getWhisperCppModelStatus).mockResolvedValue(NOT_READY);
        vi.mocked(settingsApi.getParakeetModelStatus).mockResolvedValue(NOT_READY);
        vi.mocked(settingsApi.getLocalMtStatus).mockResolvedValue(localMtStatus(false));
        vi.mocked(settingsApi.getEngineSelection).mockResolvedValue({
            openai: {
                enableSentenceLearning: false,
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

    it('第一页选择保存位置，继续后进入下载页并加载各项资源状态', async () => {
        render(<OnboardingView />);

        expect(screen.getByText('steps.storage.heroTitle')).toBeDefined();
        fireEvent.click(screen.getByText('nextStep'));
        expect(screen.getByText('steps.download.heroTitle')).toBeDefined();
        expect(screen.getByText('steps.download.action')).toBeDefined();
        await waitFor(() => {
            expect(settingsApi.getSherpaTtsModelStatus).toHaveBeenCalled();
            expect(settingsApi.getWhisperCppModelStatus).toHaveBeenCalled();
            expect(settingsApi.getLocalMtStatus).toHaveBeenCalled();
        });
    });

    it('下载会依次处理三项资源，全部完成后保存配置并进入完成页', async () => {
        // 模拟真实时序：下载完成后本地轻量模型状态变为就绪
        let mtReady = false;
        vi.mocked(settingsApi.getLocalMtStatus).mockImplementation(async () => localMtStatus(mtReady));
        vi.mocked(settingsApi.downloadLocalMt).mockImplementation(async () => { mtReady = true; });

        render(<OnboardingView />);

        fireEvent.click(screen.getByText('nextStep'));
        fireEvent.click(screen.getByText('steps.download.action'));

        await waitFor(() => {
            expect(settingsApi.downloadSherpaTtsModel).toHaveBeenCalled();
            expect(settingsApi.downloadWhisperCppModel).toHaveBeenCalled();
            expect(settingsApi.downloadLocalMt).toHaveBeenCalled();
            expect(settingsApi.saveEngineSelection).toHaveBeenCalledWith(
                expect.objectContaining({
                    providers: expect.objectContaining({
                        subtitleTranslationEngine: 'local-mt',
                        dictionaryEngine: 'none',
                    }),
                })
            );
            expect(markOnboardingCompleted).toHaveBeenCalledWith(CURRENT_ONBOARDING_VERSION);
        });
        // 进入完成页
        expect(await screen.findByText('steps.done.title')).toBeDefined();
    });

    it('任一项下载失败即停下，并把失败原因显示在下载按钮下方', async () => {
        vi.mocked(settingsApi.downloadWhisperCppModel).mockRejectedValue(new Error('网络中断'));

        render(<OnboardingView />);
        fireEvent.click(screen.getByText('nextStep'));
        fireEvent.click(screen.getByText('steps.download.action'));

        await waitFor(() => {
            expect(screen.getByText('网络中断')).toBeDefined();
        });
        // 失败后不再继续后面的项，也不进入完成页
        expect(settingsApi.downloadLocalMt).not.toHaveBeenCalled();
        expect(markOnboardingCompleted).not.toHaveBeenCalled();
    });

    it('跳过下载时仍然保存保守配置并进入完成页', async () => {
        render(<OnboardingView />);
        fireEvent.click(screen.getByText('nextStep'));
        fireEvent.click(screen.getByText('steps.download.skip'));

        await waitFor(() => {
            expect(settingsApi.downloadSherpaTtsModel).not.toHaveBeenCalled();
            expect(settingsApi.saveEngineSelection).toHaveBeenCalledWith(
                expect.objectContaining({
                    providers: expect.objectContaining({
                        subtitleTranslationEngine: 'none',
                        dictionaryEngine: 'none',
                    }),
                })
            );
            expect(markOnboardingCompleted).toHaveBeenCalledWith(CURRENT_ONBOARDING_VERSION);
        });
    });

    it('资源都已就绪时显示完成按钮，开始使用会关闭引导', async () => {
        const readyStatus = { ...NOT_READY, ready: true };
        vi.mocked(settingsApi.getSherpaTtsModelStatus).mockResolvedValue(readyStatus);
        vi.mocked(settingsApi.getWhisperCppModelStatus).mockResolvedValue(readyStatus);
        vi.mocked(settingsApi.getLocalMtStatus).mockResolvedValue(localMtStatus(true));
        const onCompleted = vi.fn();
        render(<OnboardingView onCompleted={onCompleted} />);

        fireEvent.click(screen.getByText('nextStep'));
        // 等状态加载完，按钮才会从「下载」变成「完成」
        fireEvent.click(await screen.findByText('steps.download.finish'));

        expect(await screen.findByText('startUsing')).toBeDefined();
        fireEvent.click(screen.getByText('startUsing'));
        expect(onCompleted).toHaveBeenCalled();
    });
});
