const colors = require('tailwindcss/colors');
const scrollbar = require('tailwind-scrollbar');
const { fontSize } = require('tailwindcss/defaultTheme');

module.exports = {
    content: ['./src/renderer/**/*.{js,jsx,ts,tsx,ejs}'],
    darkMode: false, // or 'media' or 'class'
    theme: {
        extend: {
            colors: {
                /**
                 * 背景色
                 */
                background: colors.neutral['800'],
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
                progressbarComplete: colors.purple['800'],
                /**
                 * gutter 背景色
                 */
                gutterBackground: colors.stone['100'],
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
            },
            fontSize: {
                mainSubtitleOne: fontSize['3xl'],
                mainSubtitleTwo: fontSize['3xl'],
                mainSubtitleThree: fontSize['2xl'],
                subtitle: fontSize.lg,
            },
        },
    },
    variants: {
        extend: {},
    },
    plugins: [scrollbar({ nocompatible: true })],
};
