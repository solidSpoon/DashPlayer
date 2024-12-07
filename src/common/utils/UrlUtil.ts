import * as base32 from 'hi-base32';
import PathUtil from '@/common/utils/PathUtil';

export const DP = 'dp';
export const DP_FILE = 'dp-file';

export default class UrlUtil {
    public static dp(...paths: string[]) {
        const url = PathUtil.join(...paths);
        return `${DP}://${base32.encode(url)}`;
    }

    public static file(...paths: string[]) {
        const url = PathUtil.join(...paths);
        return `${DP_FILE}://${url}`;
    }

    public static joinWebUrl(...paths: string[]): string {
        // 移除空字符串
        const cleanPaths = paths.filter(path => path !== '');

        // 处理第一个部分（可能包含协议）
        let result = cleanPaths[0] || '';

        // 处理剩余部分
        for (let i = 1; i < cleanPaths.length; i++) {
            const segment = cleanPaths[i];

            if (result.endsWith('/')) {
                result += segment.startsWith('/') ? segment.slice(1) : segment;
            } else {
                result += segment.startsWith('/') ? segment : '/' + segment;
            }
        }

        // 处理协议后的双斜杠
        result = result.replace(/^(https?:)\/+/, '$1//');

        // 移除URL参数和锚点之前的多余斜杠
        result = result.replace(/\/+([?#])/, '$1');

        // 移除中间的多余斜杠
        result = result.replace(/([^:]\/)\/+/g, '$1');

        return result;
    }
}
