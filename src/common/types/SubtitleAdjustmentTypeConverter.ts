import SentenceC from './SentenceC';
import { InsertSubtitleTimestampAdjustment } from '@/backend/db/tables/subtitleTimestampAdjustment';
import FileT from './FileT';
export default class SubtitleAdjustmentTypeConverter {
    public static fromSentence(
        s: SentenceC,
        f: FileT
    ): InsertSubtitleTimestampAdjustment {
        return {
            key: s.key,
            subtitle_path: f.path,
            start_at: s.currentBegin,
            end_at: s.currentEnd,
        };
    }
}
