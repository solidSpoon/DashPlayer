import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface Theme {
    name: string;
    type: 'dark' | 'light';
}

const THEME: Theme[] = [
    {
        name: 'dark',
        type: 'dark',
    },
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
];

type ThemeState = {
    index: number;
    theme: string;
    type: 'dark' | 'light';
};

type ThemeAction = {
    nextTheme: () => void;
    prevTheme: () => void;
};

const useTheme = create(
    persist<ThemeState & ThemeAction>(
        (set) => ({
            index: 0,
            theme: THEME[0].name,
            type: THEME[0].type,
            nextTheme: () =>
                set((state) => {
                    const index = (state.index + 1) % THEME.length;
                    return {
                        index,
                        theme: THEME[index].name,
                        type: THEME[index].type,
                    };
                }),
            prevTheme: () =>
                set((state) => {
                    const index =
                        (state.index - 1 + THEME.length) % THEME.length;
                    return {
                        index,
                        theme: THEME[index].name,
                        type: THEME[index].type,
                    };
                }),
        }),
        {
            name: 'theme',
            storage: createJSONStorage(() => localStorage),
        }
    )
);

export default useTheme;
