/**
 * 字幕可疑状态：当前视频的字幕“看起来不对”时收集原因，用于引导用户生成字幕。
 */
import { create } from 'zustand';
import StrUtil from '@/common/utils/str-util';
import { Sentence } from '@/common/types/SentenceC';

/** 字幕可疑原因。 */
export type SubtitleSuspicionReason =
    | 'no-subtitle'
    | 'name-mismatch'
    | 'chinese-only';

type SubtitleSuspicionState = {
    reasons: SubtitleSuspicionReason[];
};

type SubtitleSuspicionActions = {
    setReasons: (reasons: SubtitleSuspicionReason[]) => void;
};

export const useSubtitleSuspicion = create<SubtitleSuspicionState & SubtitleSuspicionActions>((set) => ({
    reasons: [],
    setReasons: (reasons) => set({ reasons }),
}));

/**
 * 把“纯中文字幕”的检测结论合并进当前可疑原因集合。
 *
 * 字幕解析完成晚于 player-subtitle 返回，chinese-only 只能事后增删合并，
 * 不能整体覆盖已写入的 no-subtitle / name-mismatch。
 *
 * @param detected 是否检测为纯中文字幕。
 */
export function mergeChineseOnlySuspicion(detected: boolean): void {
    const { reasons, setReasons } = useSubtitleSuspicion.getState();
    const has = reasons.includes('chinese-only');
    if (detected === has) {
        return;
    }
    setReasons(detected ? [...reasons, 'chinese-only'] : reasons.filter((r) => r !== 'chinese-only'));
}

/**
 * 检测解析出的字幕是否为纯中文字幕（英文字幕位基本全空）。
 *
 * 本应用的主字幕位是英文，纯中文 srt 会导致英文轨道没有可显示的内容。
 * 保守阈值：有内容的句子至少 5 条，且其中 80% 以上只有中文。
 *
 * @param sentences 解析出的字幕句子。
 * @returns 是否疑似纯中文字幕。
 */
export function detectChineseOnlySubtitle(sentences: Sentence[]): boolean {
    let withContent = 0;
    let chineseOnly = 0;
    for (const sentence of sentences) {
        const hasEnglish = StrUtil.isNotBlank(sentence.text);
        const hasChinese = StrUtil.isNotBlank(sentence.textZH);
        if (!hasEnglish && !hasChinese) {
            continue;
        }
        withContent += 1;
        if (!hasEnglish && hasChinese) {
            chineseOnly += 1;
        }
    }
    return withContent >= 5 && chineseOnly / withContent >= 0.8;
}
