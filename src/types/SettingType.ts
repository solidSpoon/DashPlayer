import { Appearance, SettingState } from '../renderer/hooks/useSetting';

export const defaultShortcut: ShortCutValue = {
    last: 'left,a',
    next: 'right,d',
    repeat: 'down,s',
    space: 'space,up,w',
    singleRepeat: 'r',
    showEn: 'e',
    showCn: 'c',
    showWordLevel: 'l',
    sowEnCn: 'b',
    nextTheme: 't',
    prevTheme: 'y',
};
export interface ShortCutValue {
    /**
     * 上一句
     */
    last: string;
    /**
     * 下一句
     */
    next: string;
    /**
     * 重复
     */
    repeat: string;
    /**
     * 播放/暂停
     */
    space: string;
    /**
     * 单句重复
     */
    singleRepeat: string;
    /**
     * 显示/隐藏英文
     */
    showEn: string;
    /**
     * 显示/隐藏中文
     */
    showCn: string;
    /**
     * 显示/隐藏中英
     */
    sowEnCn: string;
    /**
     * 显示/隐藏单词等级
     */
    showWordLevel: string;
    /**
     * next theme
     */
    nextTheme: string;
    /**
     * previous theme
     */
    prevTheme: string;
}
export const DEFAULT_SETTING: SettingState = {
    keyBinds: defaultShortcut,
    tencentSecret: {
        secretId: '',
        secretKey: '',
    },
    youdaoSecret: {
        secretId: '',
        secretKey: '',
    },
    appearance: {
        theme: 'light',
        fontSize: 'fontSizeLarge',
    },
};
