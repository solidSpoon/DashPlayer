import { injectable } from 'inversify';
import CacheService, { CacheType } from '@/backend/services/CacheService';


@injectable()
export class CacheServiceImpl implements CacheService {
    private cache: Map<string, string> = new Map();

    get<T extends keyof CacheType>(type: T, key: string): CacheType[T] | null {
        const value = this.cache.get(this.mapKey(type, key));
        if (value === undefined || value === null) {
            return null;
        }
        return JSON.parse(value) as CacheType[T];
    }

    set<T extends keyof CacheType>(type: T, key: string, value: CacheType[T]): void {
        if (value === null) {
            return;
        }
        const value1: string = JSON.stringify(value);
        this.cache.set(this.mapKey(type, key), value1);
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
