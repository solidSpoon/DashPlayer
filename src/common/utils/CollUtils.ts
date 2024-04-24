
export default class CollUtils {
    public static isEmpty<T>(coll: T[] | null | undefined): boolean {
        return !coll || coll.length === 0;
    }

    public static isNotEmpty<T>(coll: T[] | null | undefined): boolean {
        return !this.isEmpty(coll);
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
}
