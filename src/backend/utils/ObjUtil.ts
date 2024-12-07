import objectHash from 'object-hash';
import StrUtil from '@/common/utils/str-util';
import { Nullable } from '@/common/types/Types';

export class ObjUtil {
    public static hash(obj: objectHash.NotUndefined): string {
        return objectHash(obj);
    }

    public static isNull<T>(obj: T | null | undefined): obj is null | undefined {
        return obj === null || obj === undefined;
    }

    public static isHash(str: Nullable<string>) {
        if (StrUtil.isBlank(str)) {
            return false;
        }
        // 假设 key 是一个固定长度的十六进制字符串（如 SHA-1）
        return /^[a-f0-9]{40}$/i.test(str);
    }
}
