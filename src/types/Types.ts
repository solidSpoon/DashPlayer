export type WindowState =
    | 'normal'
    | 'maximized'
    | 'minimized'
    | 'fullscreen'
    | 'closed';
interface Theme {
    name: string;
    type: 'dark' | 'light';
}
export const THEME: Theme[] = [
    {
        name: 'light',
        type: 'light',
    },
    {
        name: 'bright',
        type: 'light',
    },
    {
        name: 'deep',
        type: 'dark',
    },
    {
        name: 'dark',
        type: 'dark',
    },
];
