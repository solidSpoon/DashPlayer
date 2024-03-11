import SentenceT from './SentenceT';
import { InsertSubtitleTimestampAdjustment } from '@/backend/db/tables/subtitleTimestampAdjustment';
import FileT from './FileT';
import { sentenceKey } from '../utils/hash';

export default class SubtitleAdjustmentTypeConverter {
    public static fromSentence(
        s: SentenceT,
        f: FileT
    ): InsertSubtitleTimestampAdjustment {
        return {
            key: sentenceKey(f.path ?? '', s.index, s.text ?? ''),
            subtitle_path: f.path,
            start_at: s.currentBegin,
            end_at: s.currentEnd,
        };
    }
}
