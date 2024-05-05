import Controller from "@/backend/interfaces/controller";
import registerRoute from "@/common/api/register";
import {YdRes} from "@/common/types/YdRes";
import AiTransService, {youDao} from "@/backend/services/AiTransService";

export default class AiTransController implements Controller {
    public async batchTranslate(
        sentences: string[]
    ): Promise<Map<string, string>> {
        return AiTransService.batchTranslate(sentences);
    }

    public async youDaoTrans(str: string): Promise<YdRes | null> {
        return AiTransService.youDaoTrans(str);
    }

    registerRoutes(): void {
        registerRoute('ai-trans/batch-translate', this.batchTranslate);
        registerRoute('ai-trans/word', this.youDaoTrans);
    }

}
