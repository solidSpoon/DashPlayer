export default class CollUtil {
    public static isEmpty<T>(coll: T[] | null | undefined): coll is null | undefined | [] {
        return !coll || coll.length === 0;
    }

    public static isNotEmpty<T>(coll: T[] | null | undefined): boolean {
        return !this.isEmpty(coll);
    }

    public static emptyIfNull<T>(coll: T[] | null | undefined): T[] {
        return coll || [];
    }

    public static safeGet<T>(coll: T[] | null | undefined, index: number): T | null {
        if (this.isEmpty(coll)) {
            return null;
        }
        if (index < 0 || index >= coll.length) {
            return null;
        }
        return coll[index];
    }
    public static validGet<T>(coll: T[], index: number): T {
        if (this.isEmpty(coll)) {
            throw new Error('coll is empty');
        }
        let targetIndex = index;
        if (targetIndex < 0) {
            targetIndex = 0;
        }
        if (targetIndex >= coll.length) {
            targetIndex = coll.length - 1;
        }
        return coll[targetIndex];
    }

    public static getFirst<T>(coll: T[] | null | undefined): T | null {
        return this.safeGet(coll, 0);
    }

    static toMap<E, K>(entities: E[], keyFunc: (e: E) => K): Map<K, E> {
        const result = new Map<K, E>();
        for (const e of entities) {
            result.set(keyFunc(e), e);
        }
        return result;
    }
}
