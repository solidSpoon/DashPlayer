import { injectable } from 'inversify';
import CacheService from '@/backend/services/CacheService';

@injectable()
export class CacheServiceImpl implements CacheService {
    private cache: Map<string, string> = new Map();

    get<T>(key: string): T | undefined {
        const value = this.cache.get(key);
        if (value === undefined) {
            return undefined;
        }
        return JSON.parse(value) as T;
    }

    set<T>(key: string, value: T): void {
        if (value === undefined || value === null) {
            return;
        }
        this.cache.set(key, JSON.stringify(value));
    }

    delete(key: string): void {
        this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }
}
