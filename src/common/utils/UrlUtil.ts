import PathUtil from '@/common/utils/PathUtil';
import { pathToFileURL } from 'node:url';

export const DP = 'dp';
export const DP_FILE = 'dp-file';

export default class UrlUtil {
    public static dp(...paths: string[]) {
        const url = PathUtil.join(...paths);
        if (!url) {
            return '';
        }
        if (/^https?:\/\//i.test(url)) {
            return url;
        }
        return UrlUtil.file(url);
    }

    public static file(...paths: string[]) {
        if (paths.length === 1 && /^file:\/\//i.test(paths[0])) {
            return paths[0];
        }
        const rawPath = PathUtil.join(...paths);
        if (!rawPath) {
            return '';
        }
        // Use Node's canonical conversion to avoid Windows drive/path encoding pitfalls.
        return pathToFileURL(rawPath).toString();
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
