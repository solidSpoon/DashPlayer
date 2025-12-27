// src/backend/controllers/AiTransController.ts

import registerRoute from '@/common/api/register';

import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types'; // 使用接口定义
import { YdRes, OpenAIDictionaryResult } from '@/common/types/YdRes';
import Controller from "@/backend/interfaces/controller";
import TranslateService from "@/backend/services/AiTransServiceImpl";

@injectable()
export default class AiTransController implements Controller {
    @inject(TYPES.TranslateService)
    private translateService!: TranslateService;

    /**
     * @deprecated 旧版批量翻译接口，建议使用新的 group-translation
     */
    public async batchTranslate(sentences: string[]): Promise<Map<string, string>> {
        return this.translateService.transSentences(sentences);
    }

    /**
     * 单独的单词翻译（有道）
     */
    public async youDaoTrans(params: { word: string; forceRefresh?: boolean; requestId?: string }): Promise<YdRes | OpenAIDictionaryResult | null> {
        return this.translateService.transWord(params.word, params.forceRefresh, params.requestId);
    }

    /**
     * 新版：请求批量翻译一组字幕
     * @param params - 包含引擎、文件哈希和句子索引的请求参数
     */
    public async requestGroupTranslation(params: {
        fileHash: string,
        indices: number[],
        useCache?: boolean
    }): Promise<void> {
        // 控制器只做转发，所有逻辑都在 Service 中处理
        await this.translateService.groupTranslate(params);
    }

    /**
     * 注册IPC路由
     */
    registerRoutes(): void {
        registerRoute('ai-trans/batch-translate', (p) => this.batchTranslate(p));
        registerRoute('ai-trans/word', (p) => this.youDaoTrans(p));

        // 注册新的核心翻译接口
        registerRoute('ai-trans/request-group-translation', (p) => this.requestGroupTranslation(p));
    }
}
