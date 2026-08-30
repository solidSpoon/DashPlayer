export type FontSizeType =
    | 'ms1-small'
    | 'ms1-medium'
    | 'ms1-large'
    | 'ms2-small'
    | 'ms2-medium'
    | 'ms2-large'
    | 'ms3-small'
    | 'ms3-medium'
    | 'ms3-large';

export const FONT_SIZE: {
    [key in FontSizeType]: string;
} = {
    'ms1-small': 'text-xl',
    'ms1-medium': 'text-2xl',
    'ms1-large': 'text-3xl',
    'ms2-small': 'text-lg',
    'ms2-medium': 'text-xl',
    'ms2-large': 'text-2xl',
    'ms3-small': 'text-base',
    'ms3-medium': 'text-lg',
    'ms3-large': 'text-xl',
};
export type ColorType =
    | 'bg-background'
    | 'bg-wordHoverBackground'
    | 'bg-sentenceInnerShadow'
    | 'text-textColor'
    | 'text-mainSubtitleOneColor'
    | 'text-mainSubtitleTwoColor'
    | 'bg-scrollbarTrack'
    | 'bg-scrollbarThumb'
    | 'bg-scrollbarThumbHover'
    | 'bg-progressbarComplete'
    | 'bg-gutterBackground'
    | 'bg-titlebar'
    | 'bg-titlebarHover'
    | 'text-titlebarText'
    | 'bg-uploadButton'
    | 'bg-playIcon'
    | 'bg-settingButton'
    | 'bg-settingButtonHover';

export const lightColor: {
    [key in ColorType]: string;
} = {
    'bg-background': 'bg-stone-200',
    'bg-wordHoverBackground': 'bg-stone-100',
    'bg-sentenceInnerShadow': 'bg-stone-100',
    'text-textColor': 'text-stone-700',
    'text-mainSubtitleOneColor': 'text-stone-800',
    'text-mainSubtitleTwoColor': 'text-stone-600',
    'bg-scrollbarTrack': 'bg-stone-100',
    'bg-scrollbarThumb': 'bg-stone-400',
    'bg-scrollbarThumbHover': 'bg-stone-500',
    'bg-progressbarComplete': 'bg-indigo-600',
    'bg-gutterBackground': 'bg-stone-200',
    'bg-titlebar': 'bg-stone-100',
    'bg-titlebarHover': 'bg-stone-200',
    'text-titlebarText': 'text-stone-800',
    'bg-uploadButton': 'bg-lime-600',
    'bg-playIcon': 'bg-red-500',
    'bg-settingButton': 'bg-yellow-600',
    'bg-settingButtonHover': 'bg-yellow-700',
};

export const darkColor: {
    [key in ColorType]: string;
} = {
    'bg-background': 'bg-neutral-850',
    'bg-wordHoverBackground': 'bg-neutral-700',
    'bg-sentenceInnerShadow': 'bg-neutral-700',
    'text-textColor': 'text-neutral-300',
    'text-mainSubtitleOneColor': 'text-neutral-200',
    'text-mainSubtitleTwoColor': 'text-neutral-400',
    'bg-scrollbarTrack': 'bg-neutral-800',
    'bg-scrollbarThumb': 'bg-neutral-600',
    'bg-scrollbarThumbHover': 'bg-neutral-500',
    'bg-progressbarComplete': 'bg-indigo-500',
    'bg-gutterBackground': 'bg-neutral-800',
    'bg-titlebar': 'bg-neutral-800',
    'bg-titlebarHover': 'bg-neutral-700',
    'text-titlebarText': 'text-neutral-200',
    'bg-uploadButton': 'bg-lime-700',
    'bg-playIcon': 'bg-red-600',
    'bg-settingButton': 'bg-yellow-600',
    'bg-settingButtonHover': 'bg-yellow-300',
};

export const themeProvider = (
    theme: string
): ((style: ColorType) => string) => {
    return (style: ColorType): string => {
        if (theme === 'light') {
            return lightColor[style];
        }
        return darkColor[style];
    };
};

export default class Style {
    public static file_browser_icon = 'w-4 h-4 text-yellow-700/90 flex-shrink-0';
    // 隐藏英文字幕时的单词占位：纯透明占位保留排版，通过整行磨砂遮罩或整行 hover 优雅显现
    public static word_hover_bg = 'select-none';
}


