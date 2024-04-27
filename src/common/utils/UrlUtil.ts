export const DP = 'dp';
export const DP_FILE = 'dp-file';

export default class UrlUtil {
    public static dp(url: string) {
        // url 编码
        return `${DP}://${url}`
    }
    public static file(url: string) {
        // url 编码
        return `${DP_FILE}://${url}`
    }
}
