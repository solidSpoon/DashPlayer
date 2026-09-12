/**
 * 预置词典音标的展示格式。
 *
 * 说明：ECDICT 的词条音标是 `wɒ:lts` 这种不带斜杠的写法，界面统一补上斜杠展示；
 * 单词弹窗与整句学习页共用同一套格式，避免同一份数据两处写法不一致。
 *
 * @param value 词典原始音标。
 * @returns 形如 `/wɒ:lts/` 的展示文本；为空时返回空字符串。
 */
export const formatPhonetic = (value: string | undefined | null): string => {
    if (!value) {
        return '';
    }
    const trimmed = value.trim().replace(/^\/+/, '').replace(/\/+$/, '');
    return trimmed ? `/${trimmed}/` : '';
};
