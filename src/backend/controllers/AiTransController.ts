import registerRoute from '@/common/api/register';
import { YdRes } from '@/common/types/YdRes';
import Controller from '@/backend/interfaces/controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import TranslateService from '@/backend/services/AiTransServiceImpl';

@injectable()
export default class AiTransController implements Controller {
    @inject(TYPES.TranslateService)
    private translateService!: TranslateService;

    public async batchTranslate(sentences: string[]): Promise<Map<string, string>> {
        return this.translateService.transSentences(sentences);
    }

    public async youDaoTrans(str: string): Promise<YdRes | null> {
        return this.translateService.transWord(str);
    }

    registerRoutes(): void {
        registerRoute('ai-trans/batch-translate', (p) => this.batchTranslate(p));
        registerRoute('ai-trans/word', (p) => this.youDaoTrans(p));
    }

}
