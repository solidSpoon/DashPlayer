import objectHash from 'object-hash';

export class ObjUtil {
    public static hash(obj: objectHash.NotUndefined): string {
        return objectHash(obj);
    }

    public static isNull<T>(obj: T | null | undefined): obj is null | undefined {
        return obj === null || obj === undefined;
    }

}
