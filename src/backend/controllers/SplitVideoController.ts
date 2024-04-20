import Controller from "@/backend/interfaces/controller";
import SplitVideoService from "@/backend/services/SplitVideoService";
import {ChapterParseResult} from "@/common/types/chapter-result";
import registerRoute from "@/common/api/register";
import DpTaskService from "@/backend/services/DpTaskService";

export default class SplitVideoController implements Controller {

    public async previewSplit(str: string): Promise<ChapterParseResult[]> {
        return SplitVideoService.previewSplit(str);
    }

    public async splitOne({filePath, param}: { filePath: string, param: ChapterParseResult }): Promise<number> {
        const taskId = await DpTaskService.create();
        await SplitVideoService.split(taskId,filePath, param);
        return taskId;
    }

    public async splitSrtOne({filePath, param}: { filePath: string, param: ChapterParseResult }): Promise<string> {
        return SplitVideoService.splitSrt(filePath, param);
    }

    registerRoutes(): void {
        registerRoute('split-video/preview', this.previewSplit);
        registerRoute('split-video/split-one', this.splitOne);
        registerRoute('split-video/split-srt-one', this.splitSrtOne);
    }
}
