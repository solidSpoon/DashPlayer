
import { ChapterParseResult } from '@/common/types/chapter-result';



export default interface SplitVideoService {
    previewSplit(str: string): Promise<ChapterParseResult[]>;

    split({
              videoPath,
              srtPath,
              chapters
          }: {
        videoPath: string,
        srtPath: string | null,
        chapters: ChapterParseResult[]
    }): Promise<string | undefined>;

    split2({
               videoPath,
               srtPath,
               chapters
           }: {
        videoPath: string,
        srtPath: string | null,
        chapters: ChapterParseResult[]
    }): Promise<string | undefined>;
}
