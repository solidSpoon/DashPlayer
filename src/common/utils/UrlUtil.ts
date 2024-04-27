export const DP_LOCAL = 'dp-local';
export const DP_NET = 'dp-net';


export default class UrlUtil {
    public static local(url: string) {
        // url 编码
        url = encodeURI(url)
        return `${DP_LOCAL}://${url}`
    }

    public static net(url: string) {
        return `${DP_NET}://${url}`
    }
}
