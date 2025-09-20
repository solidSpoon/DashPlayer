import { injectable } from 'inversify';
import CacheService, { CacheType } from '@/backend/services/CacheService';


@injectable()
export class CacheServiceImpl implements CacheService {
    private cache: Map<string, { value: string; expires?: number }> = new Map();

    get<T extends keyof CacheType>(type: T, key: string): CacheType[T] | null {
        const item = this.cache.get(this.mapKey(type, key));
        if (!item) {
            return null;
        }

        // 检查是否过期
        if (item.expires && Date.now() > item.expires) {
            this.cache.delete(this.mapKey(type, key));
            return null;
        }

        return JSON.parse(item.value) as CacheType[T];
    }

    set<T extends keyof CacheType>(type: T, key: string, value: CacheType[T], ttl?: number): void {
        if (value === null) {
            return;
        }
        const value1: string = JSON.stringify(value);
        const expires = ttl ? Date.now() + ttl : undefined;
        this.cache.set(this.mapKey(type, key), { value: value1, expires });
    }


    delete<T extends keyof CacheType>(type: T, key: string): void {
        this.cache.delete(this.mapKey(type, key));
    }

    clear(): void {
        this.cache.clear();
    }

    private mapKey(type: string, key: string) {
        return type + '::=::' + key;
    }
}
