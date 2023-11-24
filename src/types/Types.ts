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
        name: 'dark',
        type: 'dark',
        usingThemeName: 'dark',
    },
];
