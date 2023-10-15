import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const THEME = ['dark', 'light'];

type ThemeState = {
    theme: string;
};

type ThemeAction = {
    nextTheme: () => void;
};

// const useTheme = create<ThemeState & ThemeAction>((set) => ({
//     theme: THEME[0],
//     nextTheme: () =>
//         set((state) => ({
//             theme: THEME[(THEME.indexOf(state.theme) + 1) % THEME.length],
//         })),
// }));

const useTheme = create(
    persist<ThemeState & ThemeAction>(
        (set) => ({
            theme: THEME[0],
            nextTheme: () =>
                set((state) => ({
                    theme: THEME[
                        (THEME.indexOf(state.theme) + 1) % THEME.length
                    ],
                })),
        }),
        {
            name: 'theme',
            storage: createJSONStorage(() => localStorage),
        }
    )
);

export default useTheme;
