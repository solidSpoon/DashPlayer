import { SrtSentence } from '@/common/types/SentenceC';
import { YdRes } from '@/common/types/YdRes';

export type CacheType = {
    'cache:srt': SrtSentence;
    'cache:translation': YdRes;
}

export default interface CacheService {
    get<T extends keyof CacheType>(type: T, key: string): CacheType[T] | null;
    set<T extends keyof CacheType>(type: T, key: string, value: CacheType[T]): void;
    delete<T extends keyof CacheType>(type: T, key: string): void;
    clear(): void;
}
