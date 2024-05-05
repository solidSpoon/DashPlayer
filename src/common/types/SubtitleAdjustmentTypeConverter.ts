import SentenceC from './SentenceC';
import { InsertSubtitleTimestampAdjustment } from '@/backend/db/tables/subtitleTimestampAdjustment';

export default class SubtitleAdjustmentTypeConverter {
    public static fromSentence(
        s: SentenceC,
        ph: string
    ): InsertSubtitleTimestampAdjustment {
        return {
            key: s.key,
            subtitle_path: ph,
            start_at: s.currentBegin,
            end_at: s.currentEnd
        };
    }
}
