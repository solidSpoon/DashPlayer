/**
 * 快捷键设置详情 VO。
 *
 * 每个字段的值为快捷键字符串，多个快捷键使用英文逗号分隔。
 */
export interface ShortcutSettingDetailVO {
    /** 上一句快捷键。 */
    previousSentence: string;
    /** 下一句快捷键。 */
    nextSentence: string;
    /** 重复当前句快捷键。 */
    repeatSentence: string;
    /** 播放/暂停快捷键。 */
    playPause: string;
    /** 单句循环快捷键。 */
    repeatSingleSentence: string;
    /** 自动暂停快捷键。 */
    autoPause: string;
    /** 切换英文显示快捷键。 */
    toggleEnglishDisplay: string;
    /** 切换中文显示快捷键。 */
    toggleChineseDisplay: string;
    /** 切换中英双语显示快捷键。 */
    toggleBilingualDisplay: string;
    /** 切换词级显示快捷键。 */
    toggleWordLevelDisplay: string;
    /** 切换主题快捷键。 */
    nextTheme: string;
    /** 字幕起始时间左移快捷键。 */
    adjustBeginMinus: string;
    /** 字幕起始时间右移快捷键。 */
    adjustBeginPlus: string;
    /** 字幕结束时间左移快捷键。 */
    adjustEndMinus: string;
    /** 字幕结束时间右移快捷键。 */
    adjustEndPlus: string;
    /** 清除时间偏移快捷键。 */
    clearAdjust: string;
    /** 切换下一个播放速度快捷键。 */
    nextPlaybackRate: string;
    /** 打开 AI 对话快捷键。 */
    aiChat: string;
    /** 添加片段快捷键。 */
    addClip: string;
    /** 打开控制面板快捷键。 */
    openControlPanel: string;
    /** 配音录音快捷键（点按开始/再按停止，长按松手即停）。 */
    dubbingRecord: string;
}

/**
 * 快捷键设置保存 VO。
 *
 * 当前与详情结构一致，单独导出是为了保持接口语义清晰。
 */
export type ShortcutSettingSaveVO = ShortcutSettingDetailVO;
