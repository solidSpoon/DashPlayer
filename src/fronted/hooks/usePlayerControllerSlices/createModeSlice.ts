import { StateCreator } from 'zustand/esm';
import { ModeSlice, PlayerSlice, SentenceSlice } from './SliceTypes';

const createModeSlice: StateCreator<
    PlayerSlice & SentenceSlice & ModeSlice,
    [],
    [],
    ModeSlice
> = (set, get) => ({
    showEn: true,
    showCn: true,
    syncSide: false,
    singleRepeat: false,
    autoPause: false,
    showWordLevel: false,
    changeShowEn: () => set((state) => ({ showEn: !state.showEn })),
    changeShowCn: () => set((state) => ({ showCn: !state.showCn })),
    changeShowEnCn: () =>
        set((state) => ({
            showEn: !state.showEn,
            showCn: !state.showEn
        })),
    changeSyncSide: () => set((state) => ({ syncSide: !state.syncSide })),
    changeSingleRepeat: (target) => {
        if (target === undefined ) {
            set((state) => ({ singleRepeat: !state.singleRepeat }));
        } else {
            if (target !== get().singleRepeat) {
                set({
                    singleRepeat: target
                });
            }
        }
    },
    changeShowWordLevel: () =>
        set((state) => ({ showWordLevel: !state.showWordLevel })),
    changeAutoPause: (target) => {
        if (target === undefined) {
            set((state) => ({ autoPause: !state.autoPause }));
        } else {
            if (target !== get().autoPause) {
                set({
                    autoPause: target
                });
            }
        }
    }
});

export default createModeSlice;
