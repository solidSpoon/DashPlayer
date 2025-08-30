/**
 * Translation Controller - 处理翻译相关的后端回调
 */

import { BaseRendererController } from './BaseRendererController';
import useTranslation from '../hooks/useTranslation';

export class TranslationController extends BaseRendererController {
    readonly name = 'TranslationController';

    protected setupApis(): void {
        this.batchRegisterApis({
            // 单个翻译结果回调
            'translation/result': async (params) => {
                console.log('翻译结果:', params);
                
                const { key, translation, isComplete = true } = params;
                useTranslation.getState().updateTranslation(key, translation, isComplete);
            },

            // 批量翻译结果回调 (流式返回数组)
            'translation/batch-result': async (params) => {
                console.log('批量翻译结果:', params);
                
                const { translations } = params;
                useTranslation.getState().updateTranslations(translations);
            }
        });
    }
}