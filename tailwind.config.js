const colors = require('tailwindcss/colors');
const themer = require('tailwindcss-themer');
const scrollbar = require('tailwind-scrollbar');
const { fontSize } = require('tailwindcss/defaultTheme');

module.exports = {
    content: ['./src/renderer/**/*.{js,jsx,ts,tsx,ejs}'],
    darkMode: false, // or 'media' or 'class'
    theme: {
        extend: {
            colors: {
                sky: colors.sky,
                cyan: colors.cyan,
            },
        },
    },
    variants: {
        extend: {},
    },
    plugins: [
        scrollbar({ nocompatible: true }),
        themer({
            defaultTheme: {
                name: 'dark',
                extend: {
                    colors: {
                        /**
                         * 背景色
                         */
                        background: colors.neutral['800'],
                        /**
                         * 句子背景色
                         */
                        sentenceBackground: colors.neutral['700'],
                        /**
                         * 单词 hover 背景色
                         */
                        wordHoverBackground: colors.neutral['600'],
                        /**
                         * 句子 hover 背景色
                         */
                        sentenceHoverBackground: colors.neutral['600'],
                        /**
                         * 句子 inner shadow
                         */
                        sentenceInnerShadow: colors.neutral['600'],
                        /**
                         * 文字色
                         */
                        textColor: colors.neutral['200'],
                        /**
                         * main subtitle 1
                         */
                        mainSubtitleOneColor: colors.neutral['100'],
                        /**
                         * main subtitle 2
                         */
                        mainSubtitleTwoColor: colors.neutral['300'],
                        /**
                         * 滚动条背景色
                         */
                        scrollbarTrack: colors.stone['600'],
                        /**
                         * 滚动条把手色
                         */
                        scrollbarThumb: colors.stone['400'],
                        /**
                         * 滚动条把手色 hover
                         */
                        scrollbarThumbHover: colors.stone['300'],
                        /**
                         * 进度条完成色
                         */
                        progressbarComplete: colors.purple['900'],
                        /**
                         * gutter 背景色
                         */
                        gutterBackground: colors.zinc['700'],
                        /**
                         * 标题栏色
                         */
                        titlebar: colors.stone['600'],
                        /**
                         * 标题栏色 hover
                         */
                        titlebarHover: colors.stone['500'],
                        /**
                         * 标题栏文字色
                         */
                        titlebarText: colors.stone['100'],
                        /**
                         * upload button color
                         */
                        uploadButton: colors.lime['700'],
                        /**
                         * play icon color
                         */
                        playIcon: colors.red['600'],
                        settingButton: colors.yellow['600'],
                        settingButtonHover: colors.yellow['300'],
                    },
                    fontSize: {
                        mainSubtitleOne: fontSize['3xl'],
                        mainSubtitleTwo: fontSize['3xl'],
                        mainSubtitleThree: fontSize['2xl'],
                        subtitle: fontSize.lg,
                    },
                },
            },
            themes: [
                {
                    name: 'light',
                    extend: {
                        colors: {
                            /**
                             * 背景色
                             */
                            background: colors.gray['300'],
                            /**
                             * 句子背景色
                             */
                            sentenceBackground: colors.stone['200'],
                            /**
                             * 句子 hover 背景色
                             */
                            sentenceHoverBackground: colors.stone['100'],
                            /**
                             * 单词 hover 背景色
                             */
                            wordHoverBackground: colors.stone['100'],
                            /**
                             * 句子 inner shadow
                             */
                            sentenceInnerShadow: colors.stone['100'],
                            /**
                             * 文字色
                             */
                            textColor: colors.stone['600'],
                            /**
                             * main subtitle 1
                             */
                            mainSubtitleOneColor: colors.stone['700'],
                            /**
                             * main subtitle 2
                             */
                            mainSubtitleTwoColor: colors.stone['600'],
                            /**
                             * 滚动条背景色
                             */
                            scrollbarTrack: colors.sky['100'],
                            /**
                             * 滚动条把手色
                             */
                            scrollbarThumb: colors.zinc['400'],
                            /**
                             * 滚动条把手色 hover
                             */
                            scrollbarThumbHover: colors.zinc['500'],
                            /**
                             * 进度条完成色
                             */
                            progressbarComplete: colors.purple['600'],
                            /**
                             * gutter 背景色
                             */
                            gutterBackground: colors.zinc['200'],
                            /**
                             * 标题栏色
                             */
                            titlebar: colors.sky['100'],
                            /**
                             * 标题栏色 hover
                             */
                            titlebarHover: colors.sky['200'],
                            /**
                             * 标题栏文字色
                             */
                            titlebarText: colors.stone['900'],
                            /**
                             * upload button color
                             */
                            uploadButton: colors.lime['600'],
                            /**
                             * play icon color
                             */
                            playIcon: colors.red['500'],
                            settingButton: colors.yellow['600'],
                            settingButtonHover: colors.yellow['700'],
                        },
                    },
                },
                {
                    name: 'bright',
                    extend: {
                        colors: {
                            /**
                             * 背景色
                             */
                            background: colors.zinc['400'],
                            /**
                             * 句子背景色
                             */
                            sentenceBackground: colors.neutral['300'],
                            /**
                             * 句子 hover 背景色
                             */
                            sentenceHoverBackground: colors.stone['200'],
                            /**
                             * 单词 hover 背景色
                             */
                            wordHoverBackground: colors.stone['200'],
                            /**
                             * 句子 inner shadow
                             */
                            sentenceInnerShadow: colors.stone['200'],
                            /**
                             * 文字色
                             */
                            textColor: colors.stone['900'],
                            /**
                             * main subtitle 1
                             */
                            mainSubtitleOneColor: colors.stone['900'],
                            /**
                             * main subtitle 2
                             */
                            mainSubtitleTwoColor: colors.stone['800'],
                            /**
                             * 滚动条背景色
                             */
                            scrollbarTrack: colors.zinc['200'],
                            /**
                             * 滚动条把手色
                             */
                            scrollbarThumb: colors.zinc['400'],
                            /**
                             * 滚动条把手色 hover
                             */
                            scrollbarThumbHover: colors.zinc['500'],
                            /**
                             * 进度条完成色
                             */
                            progressbarComplete: colors.purple['600'],
                            /**
                             * gutter 背景色
                             */
                            gutterBackground: colors.zinc['300'],
                            /**
                             * 标题栏色
                             */
                            titlebar: colors.zinc['200'],
                            /**
                             * 标题栏色 hover
                             */
                            titlebarHover: colors.zinc['300'],
                            /**
                             * 标题栏文字色
                             */
                            titlebarText: colors.stone['900'],
                            /**
                             * upload button color
                             */
                            uploadButton: colors.lime['600'],
                            /**
                             * play icon color
                             */
                            playIcon: colors.red['500'],
                            settingButton: colors.yellow['600'],
                            settingButtonHover: colors.yellow['700'],
                        },
                    },
                },
                {
                    name: 'deep',
                    extend: {
                        colors: {
                            /**
                             * 背景色
                             */
                            background: colors.stone['700'],
                            /**
                             * 句子背景色
                             */
                            sentenceBackground: colors.neutral['600'],
                            /**
                             * 单词 hover 背景色
                             */
                            wordHoverBackground: colors.neutral['500'],
                            /**
                             * 句子 hover 背景色
                             */
                            sentenceHoverBackground: colors.neutral['500'],
                            /**
                             * 句子 inner shadow
                             */
                            sentenceInnerShadow: colors.neutral['500'],
                            /**
                             * 文字色
                             */
                            textColor: colors.stone['100'],
                            /**
                             * main subtitle 1
                             */
                            mainSubtitleOneColor: colors.stone['200'],
                            /**
                             * main subtitle 2
                             */
                            mainSubtitleTwoColor: colors.stone['100'],
                            /**
                             * 滚动条背景色
                             */
                            scrollbarTrack: colors.stone['600'],
                            /**
                             * 滚动条把手色
                             */
                            scrollbarThumb: colors.stone['400'],
                            /**
                             * 滚动条把手色 hover
                             */
                            scrollbarThumbHover: colors.stone['300'],
                            /**
                             * 进度条完成色
                             */
                            progressbarComplete: colors.purple['900'],
                            /**
                             * gutter 背景色
                             */
                            gutterBackground: colors.neutral['600'],
                            /**
                             * 标题栏色
                             */
                            titlebar: colors.stone['600'],
                            /**
                             * 标题栏色 hover
                             */
                            titlebarHover: colors.stone['500'],
                            /**
                             * 标题栏文字色
                             */
                            titlebarText: colors.stone['100'],
                            /**
                             * upload button color
                             */
                            uploadButton: colors.lime['700'],
                            /**
                             * play icon color
                             */
                            playIcon: colors.red['600'],
                            settingButton: colors.yellow['600'],
                            settingButtonHover: colors.yellow['300'],
                        },
                    },
                },
                {
                    name: 'fontSizeSmall',
                    extend: {
                        fontSize: {
                            mainSubtitleOne: fontSize.xl,
                            mainSubtitleTwo: fontSize.xl,
                            mainSubtitleThree: fontSize.lg,
                            subtitle: fontSize.base,
                        },
                    },
                },
                {
                    name: 'fontSizeMedium',
                    extend: {
                        fontSize: {
                            mainSubtitleOne: fontSize['2xl'],
                            mainSubtitleTwo: fontSize['2xl'],
                            mainSubtitleThree: fontSize.xl,
                            subtitle: fontSize.lg,
                        },
                    },
                },
            ],
        }),
    ],
};
