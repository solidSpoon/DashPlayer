import StrUtil from '@/common/utils/str-util';

export default class PathUtil {
    // 系统启动后会有代码初始化分割符，这里使用常量做默认值
    public static SEPARATOR = '/';

    public static join(...paths: string[]): string {
        // 过滤掉空字符串
        const filteredPaths = paths.filter(path => StrUtil.isNotBlank(path));

        if (filteredPaths.length === 0) {
            return '';
        }

        // 处理每个路径段
        const processedPaths = filteredPaths.map((path, index) => {
            // 去除首尾的分隔符
            path = path.replace(new RegExp(`^${PathUtil.SEPARATOR}+|${PathUtil.SEPARATOR}+$`, 'g'), '');

            // 如果不是第一个路径段，在开头添加分隔符
            if (index > 0) {
                path = PathUtil.SEPARATOR + path;
            }

            return path;
        });

        // 连接所有处理过的路径段
        return processedPaths.join('');
    }
}
