import StrUtil from '@/common/utils/str-util';
import { Nullable } from '@/common/types/Types';

export interface ParsedPath {
    /**
     * 文件夹路径，例如 '/usr/local/bin' 或 'src/components'
     */
    dir: string;
    /**
     * 包含扩展名的文件名，例如 'index.html'
     */
    base: string;
    /**
     * 文件扩展名，例如 '.html'
     */
    ext: string;
    /**
     * 不包含扩展名的文件名，例如 'index'
     */
    name: string;
}


export default class PathUtil {
    // 系统启动后会有代码初始化分割符，这里使用常量做默认值
    public static SEPARATOR = '/';

    public static join(...paths: Nullable<string>[]): string {
        // 过滤掉空字符串
        const filteredPaths:string[] = (paths
            .filter(path => StrUtil.isNotBlank(path)) as string[]);

        if (filteredPaths.length === 0) {
            return '';
        }

        // 判断第一个路径是否为绝对路径（以分隔符开头）
        const isAbsolutePath = filteredPaths[0].startsWith(PathUtil.SEPARATOR);

        // 去除所有路径段的首尾分隔符
        const processedPaths = filteredPaths.map(path =>
            path.replace(new RegExp(`^${PathUtil.SEPARATOR}+|${PathUtil.SEPARATOR}+$`, 'g'), '')
        );

        // 使用分隔符连接所有处理过的路径段
        let joinedPath = processedPaths.join(PathUtil.SEPARATOR);

        // 如果第一个路径是绝对路径，确保结果以分隔符开头
        if (isAbsolutePath) {
            joinedPath = PathUtil.SEPARATOR + joinedPath;
        }

        return joinedPath;
    }

    /**
     * 解析一个路径字符串，返回包含目录、文件名、扩展名的信息
     * @param filePath 要解析的文件路径
     * @returns 解析后的路径对象
     */
    public static parse(filePath: string): ParsedPath {
        if (!StrUtil.isNotBlank(filePath)) {
            return {
                dir: '',
                base: '',
                ext: '',
                name: '',
            }
        }

        const isAbsolute = filePath.startsWith(PathUtil.SEPARATOR);
        let dir = '';
        let base = '';
        let ext = '';
        let name = '';

        // 找到最后一个分隔符的位置
        const lastSeparatorIndex = filePath.lastIndexOf(PathUtil.SEPARATOR);

        if (lastSeparatorIndex !== -1) {
            dir = filePath.substring(0, lastSeparatorIndex);
            base = filePath.substring(lastSeparatorIndex + 1);
        } else {
            base = filePath;
            dir = isAbsolute ? PathUtil.SEPARATOR : '';
        }

        // 找到最后一个点的位置来分割扩展名
        const lastDotIndex = base.lastIndexOf('.');
        if (lastDotIndex > 0 && lastDotIndex < base.length - 1) {
            ext = base.substring(lastDotIndex);
            name = base.substring(0, lastDotIndex);
        } else {
            ext = '';
            name = base;
        }

        return {
            dir,
            base,
            ext,
            name,
        };
    }
}
