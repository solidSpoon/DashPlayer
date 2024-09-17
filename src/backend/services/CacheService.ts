import { SrtSentence } from '@/common/types/SentenceC';

export type CacheType ={
    'cache:srt': SrtSentence;
}

export default interface CacheService {
    get<T extends keyof CacheType>(type: T, key: string): CacheType[T] | null;
    set<T extends keyof CacheType>(type: T, key: string, value: CacheType[T]): void;
    delete<T extends keyof CacheType>(type: T, key: string): void;
    clear(): void;
}
