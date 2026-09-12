/**
 * ECDICT 考试标签与界面文案的映射。
 *
 * 说明：构建脚本 scripts/build-dictionary.mjs 保证只会产出这些取值，
 * 单词弹窗与整句学习页共用同一份映射，避免同一标签两处名称不一致。
 */
export const DICT_TAG_I18N_KEYS: Record<string, string> = {
    zk: 'dictTagZk',
    gk: 'dictTagGk',
    cet4: 'dictTagCet4',
    cet6: 'dictTagCet6',
    ky: 'dictTagKy',
    toefl: 'dictTagToefl',
    ielts: 'dictTagIelts',
    gre: 'dictTagGre',
};

/**
 * 把词典考试标签转换成界面文案。
 *
 * @param tag ECDICT 考试标签。
 * @param t 翻译函数（common 命名空间）。
 * @returns 展示文案；未知标签返回 null。
 */
export const formatDictTag = (tag: string, t: (key: string) => string): string | null => {
    const key = DICT_TAG_I18N_KEYS[tag];
    return key ? t(key) : null;
};
