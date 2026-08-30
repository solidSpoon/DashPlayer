import { ObjUtil } from '@/backend/utils/ObjUtil';
import { Sentence } from '@/common/types/SentenceC';
import { p } from '@/common/utils/Util';

/**
 * 字幕翻译缓存键的派生规则。
 *
 * 判据：缓存键必须覆盖"译文的实际输入"。译文只依赖句子内容与参与请求的邻居，
 * 不依赖字幕文件身份与句子位置，因此这里一律按内容派生，不使用 `fileHash:index`。
 */

/** 前后文键前缀；用于与单句键（原文明文）在同一列内区分形态。 */
const CONTEXT_KEY_PREFIX = 'tri:';

/**
 * 判断字幕文本是否包含值得送往翻译服务的文字或数字。
 *
 * @param text 字幕原文。
 * @returns 包含文字或数字时返回 true。
 */
export const shouldTranslateSubtitleText = (text: string): boolean =>
    text.trim().length > 0 && /[\p{L}\p{N}]/u.test(text);

/**
 * 解析可作为翻译上下文邻居的字幕文本。
 *
 * 键计算与提示词组装必须共用该判据，否则会出现"键认为有邻居、请求里没带邻居"
 * 的错配：缓存会命中一份上下文条件并不相同的译文。
 * @param sentence 邻居句子；增量转录的分片边界处查不到句子。
 * @returns 邻居原文；句子缺失或无文字时返回 null。
 */
export const resolvePromptNeighbor = (sentence: Sentence | undefined): string | null => {
    if (!sentence || !shouldTranslateSubtitleText(sentence.text)) {
        return null;
    }
    return sentence.text;
};

/**
 * 构建不依赖上下文的单句存储键。
 *
 * 适用于一次请求只包含单句文本的场景（腾讯批量翻译、收藏片段直翻）。
 * 与收藏片段路径既有的键形态一致，因此两条链路天然共享同一行缓存。
 * @param text 字幕原文。
 * @returns 归一化后的原文；重复出现的同一句会收敛到同一行。
 */
export const buildSentenceStorageKey = (text: string): string => p(text);

/**
 * 构建带前后文邻居的字幕批存储键。
 *
 * 该键是**刻意的近似**：字幕批一次请求实际还包含同批其他句子与批首尾上下文，
 * 键只覆盖本句及其相邻两句。代价是同文本不同批组合之间会互相复用译文，
 * 换来的是与批次划分无关——窗口移动、批次重新对齐都不会改变键，从而可跨会话复用。
 *
 * 邻居缺失（分片边界、句子无文字）必须编码为 null 参与哈希而不是省略，
 * 否则"前句缺失的本句"会与"前句恰好等于本句"之类的组合塌成同一个键。
 * @param previous 前句文本；无邻居时传 null。
 * @param current 本句文本。
 * @param next 后句文本；无邻居时传 null。
 * @returns 带 `tri:` 前缀的内容派生键。
 */
export const buildContextStorageKey = (
    previous: string | null,
    current: string,
    next: string | null
): string => `${CONTEXT_KEY_PREFIX}${ObjUtil.hash([previous, current, next])}`;

/**
 * 按句子坐标从字幕快照中取其邻居并构建该句的字幕批存储键。
 *
 * 邻居一律按句子自身坐标 `index-1` / `index+1` 查询，不按批次首尾查询：
 * 键要绑定句子自身的语义邻域，才与批次划分和窗口位置无关。
 * @param sentence 目标句子。
 * @param sentencesByIndex 当前批次可见的字幕快照；必须与组装提示词使用同一份。
 * @returns 该句的字幕批存储键。
 */
export const buildContextStorageKeyForSentence = (
    sentence: Sentence,
    sentencesByIndex: Map<number, Sentence>
): string => buildContextStorageKey(
    resolvePromptNeighbor(sentencesByIndex.get(sentence.index - 1)),
    sentence.text,
    resolvePromptNeighbor(sentencesByIndex.get(sentence.index + 1))
);
