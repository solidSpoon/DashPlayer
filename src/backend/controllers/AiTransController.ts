import registerRoute from '@/common/api/register';
import { YdRes } from '@/common/types/YdRes';
import AiTransService from '@/backend/services/AiTransService';
import Controller from '@/backend/interfaces/controller';
import { injectable } from 'inversify';

@injectable()
export default class AiTransController implements Controller {
    public async batchTranslate(sentences: string[]): Promise<Map<string, string>> {
        return AiTransService.batchTranslate(sentences);
    }

    public async youDaoTrans(str: string): Promise<YdRes | null> {
        return AiTransService.youDaoTrans(str);
    }

    registerRoutes(): void {
        registerRoute('ai-trans/batch-translate', (p) => this.batchTranslate(p));
        registerRoute('ai-trans/word', (p) => this.youDaoTrans(p));
    }

}
