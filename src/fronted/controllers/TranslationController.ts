/**
 * Translation Controller - 处理翻译相关的后端回调
 */

import { BaseRendererController } from './BaseRendererController';
import useTranslation from '../hooks/useTranslation';
import { RendererTranslationItem } from '@/common/types/TranslationResult';

export class TranslationController extends BaseRendererController {
    readonly name = 'TranslationController';

    protected setupApis(): void {
        this.batchRegisterApis({
            // 单个翻译结果回调
            'translation/result': async (params: RendererTranslationItem) => {
                this.logger.debug('Translation result', { params });
                
                useTranslation.getState().updateTranslation(params);
            },

            // 批量翻译结果回调 (流式返回数组)
            'translation/batch-result': async (params) => {
                this.logger.debug('Batch translation result', { params });
                
                const { translations } = params;
                useTranslation.getState().updateTranslations(translations);
            }
        });
    }
}
