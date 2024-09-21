export default class PathUtil {
    // 系统启动后会有代码初始化分割符，这里使用常量做默认值
    public static SEPARATOR = '/';

    public static join(...paths: string[]): string {
        if (paths.length === 0) {
            return '';
        }

        const cleanPaths = paths.map((path, index) => {
            // 移除开头和结尾的分隔符，除非是第一个路径且以分隔符开头
            if (index === 0) {
                return path.replace(new RegExp(`${PathUtil.SEPARATOR}+$`), '');
            } else {
                return path.replace(new RegExp(`^${PathUtil.SEPARATOR}+|${PathUtil.SEPARATOR}+$`, 'g'), '');
            }
        });

        // 过滤掉空字符串
        const filteredPaths = cleanPaths.filter(path => path !== '');

        // 使用单个分隔符连接路径
        return filteredPaths.join(PathUtil.SEPARATOR);
    }
}
