import SentenceT from './SentenceT';
import { InsertSubtitleTimestampAdjustment } from '../../main/tables/subtitleTimestampAdjustment';
import FileT from './FileT';
import hash from '../utils/hash';

export class SubtitleAdjustmentTypeConverter {
    public static fromSentence(s: SentenceT, f: FileT): InsertSubtitleTimestampAdjustment {
        return {
            id: s.index,
            key: hash(`${f.path}-${s.index}-${s.text}`),
            subtitle_path: f.path,
            start_at: s.currentBegin,
            end_at: s.currentEnd,
        };
    }
}
