import { Schema } from 'electron-store';

export const schema: Schema<any> = {
    shortcut: {
        type: 'object',
        properties: {
            previousSentence: {
                type: 'string',
                default: 'left,a',
            },
            nextSentence: {
                type: 'string',
                default: 'right,d',
            },
            repeatSentence: {
                type: 'string',
                default: 'down,s',
            },
            playPause: {
                type: 'string',
                default: 'space,up,w',
            },
            repeatSingleSentence: {
                type: 'string',
                default: 'r',
            },
            toggleEnglishDisplay: {
                type: 'string',
                default: 'e',
            },
            toggleChineseDisplay: {
                type: 'string',
                default: 'c',
            },
            toggleWordLevelDisplay: {
                type: 'string',
                default: 'l',
            },
            toggleBilingualDisplay: {
                type: 'string',
                default: 'b',
            },
            nextTheme: {
                type: 'string',
                default: 't',
            },
        },
    },
    apiKeys: {
        type: 'object',
        properties: {
            youdao: {
                type: 'object',
                properties: {
                    secretId: {
                        type: 'string',
                        default: '',
                    },
                    secretKey: {
                        type: 'string',
                        default: '',
                    },
                },
            },
            tencent: {
                type: 'object',
                properties: {
                    secretId: {
                        type: 'string',
                        default: '',
                    },
                    secretKey: {
                        type: 'string',
                        default: '',
                    },
                },
            },
        },
    },
    appearance: {
        type: 'object',
        properties: {
            theme: {
                type: 'string',
                default: 'dark',
            },
            fontSize: {
                type: 'string',
                default: 'fontSizeLarge',
            },
        },
    }
};
export const SettingKeyObj = {
    'shortcut.previousSentence': '',
    'shortcut.nextSentence': '',
    'shortcut.repeatSentence': '',
    'shortcut.playPause': '',
    'shortcut.repeatSingleSentence': '',
    'shortcut.toggleEnglishDisplay': '',
    'shortcut.toggleChineseDisplay': '',
    'shortcut.toggleWordLevelDisplay': '',
    'shortcut.toggleBilingualDisplay': '',
    'shortcut.nextTheme': '',
    'apiKeys.youdao.secretId': '',
    'apiKeys.youdao.secretKey': '',
    'apiKeys.tencent.secretId': '',
    'apiKeys.tencent.secretKey': '',
    'appearance.theme': '',
    'appearance.fontSize': '',
}
export type SettingKey = keyof typeof SettingKeyObj;
