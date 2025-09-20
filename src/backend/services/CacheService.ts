import { SrtSentence } from '@/common/types/SentenceC';
import { VideoLearningClipStatusVO } from '@/common/types/vo/VideoLearningClipStatusVO';

export type CacheType ={
    'cache:srt': SrtSentence;
    'cache:clip-status': VideoLearningClipStatusVO;
}

export default interface CacheService {
    get<T extends keyof CacheType>(type: T, key: string): CacheType[T] | null;
    set<T extends keyof CacheType>(type: T, key: string, value: CacheType[T], ttl?: number): void;
    delete<T extends keyof CacheType>(type: T, key: string): void;
    clear(): void;
}
