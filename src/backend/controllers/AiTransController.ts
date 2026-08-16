// src/backend/controllers/AiTransController.ts

import registerRoute from '@/backend/controllers/ipc/registerRoute';

import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types'; // 使用接口定义
import { YdRes, OpenAIDictionaryResult } from '@/common/types/YdRes';
import Controller from '@/backend/controllers/Controller';
import TranslateService from '@/backend/services/TranslateService';
import SubtitleTranslationService from '@/backend/services/subtitle-translation/SubtitleTranslationService';

@injectable()
export default class AiTransController implements Controller {
    @inject(TYPES.TranslateService)
    private translateService!: TranslateService;

    @inject(TYPES.SubtitleTranslationService)
    private subtitleTranslationService!: SubtitleTranslationService;

    /**
     * 单独的单词翻译（有道）
     */
    public async youDaoTrans(params: { word: string; forceRefresh?: boolean; requestId?: string }): Promise<YdRes | OpenAIDictionaryResult | null> {
        return this.translateService.transWord(params.word, params.forceRefresh, params.requestId);
    }

    /**
     * 更新当前字幕播放位置并提交翻译需求。
     *
     * @param params 字幕文件哈希与当前播放索引。
     */
    public async updateSubtitleDemand(params: {
        fileHash: string;
        currentIndex: number;
        demandId: number;
    }): Promise<void> {
        await this.subtitleTranslationService.updateDemand(params);
    }

    /**
     * 释放指定字幕文件的后端翻译会话。
     *
     * @param params 待释放的字幕文件哈希。
     */
    public async releaseSubtitleSession(params: { fileHash: string }): Promise<void> {
        this.subtitleTranslationService.releaseSession(params.fileHash);
    }

    /**
     * 注册IPC路由
     */
    registerRoutes(): void {
        registerRoute('ai-trans/word', (p) => this.youDaoTrans(p));

        registerRoute('ai-trans/update-subtitle-demand', (p) => this.updateSubtitleDemand(p));
        registerRoute('ai-trans/release-subtitle-session', (p) => this.releaseSubtitleSession(p));
    }
}
