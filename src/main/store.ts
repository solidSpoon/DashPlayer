import Store, { Schema } from 'electron-store';

const schema: Schema<any> = {
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
            previousTheme: {
                type: 'string',
                default: 'y',
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
};

const store = new Store({ schema });
