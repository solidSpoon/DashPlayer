export const SettingKeyObj = {
    'shortcut.previousSentence': 'left,a',
    'shortcut.nextSentence': 'right,d',
    'shortcut.repeatSentence': 'down,s',
    'shortcut.playPause': 'space,up,w',
    'shortcut.repeatSingleSentence': 'r',
    'shortcut.toggleEnglishDisplay': 'e',
    'shortcut.toggleChineseDisplay': 'c',
    'shortcut.toggleWordLevelDisplay': 'l',
    'shortcut.toggleBilingualDisplay': 'b',
    'shortcut.nextTheme': 't',
    'apiKeys.youdao.secretId': '',
    'apiKeys.youdao.secretKey': '',
    'apiKeys.tencent.secretId': '',
    'apiKeys.tencent.secretKey': '',
    'appearance.theme': 'light',
    'appearance.fontSize': 'fontSizeLarge',
}
export type SettingKey = keyof typeof SettingKeyObj;
