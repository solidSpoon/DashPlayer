import Controller from "@/backend/interfaces/controller";
import SplitVideoService from "@/backend/services/SplitVideoService";
import {ParseResult} from "@/common/types/chapter-result";
import registerRoute from "@/common/api/register";

export default class SplitVideoController implements Controller {

    public async previewSplit(str: string): Promise<ParseResult[]> {
        return SplitVideoService.previewSplit(str);
    }

    registerRoutes(): void {
        registerRoute('split-video/preview', this.previewSplit);
    }
}
