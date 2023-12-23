export class FontSize {
    public static readonly mainSubtitleOne = {
        small: 'text-xl',
        medium: 'text-2xl',
        large: 'text-3xl',
    };

    public static readonly mainSubtitleTwo = {
        small: 'text-xl',
        medium: 'text-2xl',
        large: 'text-3xl',
    };

    public static readonly mainSubtitleThree = {
        small: 'text-xl',
        medium: 'text-lg',
        large: 'text-2xl',
    };
}

export type ColorType =
    | 'bg-background'
    | 'bg-sentenceBackground'
    | 'bg-wordHoverBackground'
    | 'bg-sentenceHoverBackground'
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

const lightColor: {
    [key in ColorType]: string;
} = {
    'bg-background': 'bg-gray-300',
    'bg-sentenceBackground': 'bg-stone-200',
    'bg-wordHoverBackground': 'bg-stone-100',
    'bg-sentenceHoverBackground': 'bg-stone-100',
    'bg-sentenceInnerShadow': 'bg-stone-100',
    'text-textColor': 'text-stone-600',
    'text-mainSubtitleOneColor': 'text-stone-700',
    'text-mainSubtitleTwoColor': 'text-stone-600',
    'bg-scrollbarTrack': 'bg-sky-100',
    'bg-scrollbarThumb': 'bg-zinc-400',
    'bg-scrollbarThumbHover': 'bg-zinc-500',
    'bg-progressbarComplete': 'bg-purple-600',
    'bg-gutterBackground': 'bg-zinc-200',
    'bg-titlebar': 'bg-sky-100',
    'bg-titlebarHover': 'bg-sky-200',
    'text-titlebarText': 'text-stone-900',
    'bg-uploadButton': 'bg-lime-600',
    'bg-playIcon': 'bg-red-500',
    'bg-settingButton': 'bg-yellow-600',
    'bg-settingButtonHover': 'bg-yellow-700',
};

const darkColor: {
    [key in ColorType]: string;
} = {
    'bg-background': 'bg-gray-800',
    'bg-sentenceBackground': 'bg-neutral-700',
    'bg-wordHoverBackground': 'bg-neutral-600',
    'bg-sentenceHoverBackground': 'bg-neutral-600',
    'bg-sentenceInnerShadow': 'bg-neutral-600',
    'text-textColor': 'text-neutral-200',
    'text-mainSubtitleOneColor': 'text-neutral-100',
    'text-mainSubtitleTwoColor': 'text-neutral-300',
    'bg-scrollbarTrack': 'bg-stone-600',
    'bg-scrollbarThumb': 'bg-stone-400',
    'bg-scrollbarThumbHover': 'bg-stone-300',
    'bg-progressbarComplete': 'bg-purple-900',
    'bg-gutterBackground': 'bg-zinc-700',
    'bg-titlebar': 'bg-stone-600',
    'bg-titlebarHover': 'bg-stone-500',
    'text-titlebarText': 'text-stone-100',
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
