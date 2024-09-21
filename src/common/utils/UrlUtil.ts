import * as base32 from 'hi-base32';
import PathUtil from '@/fronted/lib/PathUtil';

export const DP = 'dp';
export const DP_FILE = 'dp-file';

export default class UrlUtil {
    public static dp(...paths: string[]) {
        const url = PathUtil.join(...paths);
        return `${DP}://${base32.encode(url)}`
    }
    public static file(...paths: string[]) {
        const url = PathUtil.join(...paths);
        return `${DP_FILE}://${url}`
    }

}
