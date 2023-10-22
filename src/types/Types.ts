export type WindowState =
    | 'normal'
    | 'maximized'
    | 'minimized'
    | 'fullscreen'
    | 'closed';
export interface ThemeType {
    name: string;
    type: 'dark' | 'light';
    usingThemeName: string;
}
export const THEME: ThemeType[] = [
    {
        name: 'light',
        type: 'light',
        usingThemeName: 'light',
    },
    {
        name: 'bright',
        type: 'light',
        usingThemeName: 'bright',
    },
    {
        name: 'deep',
        type: 'dark',
        usingThemeName: 'deep',
    },
    {
        name: 'dark',
        type: 'dark',
        usingThemeName: 'dark',
    },
    {
        name: 'colorful one',
        type: 'light',
        usingThemeName: 'colorful',
    },
    {
        name: 'colorful two',
        type: 'light',
        usingThemeName: 'colorful',
    },
    {
        name: 'colorful three',
        type: 'light',
        usingThemeName: 'colorful',
    },
];
