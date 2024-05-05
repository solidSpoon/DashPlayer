import * as base32 from 'hi-base32';

export const DP = 'dp';
export const DP_FILE = 'dp-file';

export default class UrlUtil {
    public static dp(url: string) {
        return `${DP}://${base32.encode(url)}`
    }
    public static file(url: string) {
        return `${DP_FILE}://${url}`
    }
}
