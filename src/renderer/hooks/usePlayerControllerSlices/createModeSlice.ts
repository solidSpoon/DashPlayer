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
    singleRepeat: false,
    changeShowEn: () => set((state) => ({ showEn: !state.showEn })),
    changeShowCn: () => set((state) => ({ showCn: !state.showCn })),
    changeShowEnCn: () =>
        set((state) => ({
            showEn: !state.showEn,
            showCn: !state.showEn,
        })),
    changeSingleRepeat: () =>
        set((state) => ({ singleRepeat: !state.singleRepeat })),
});

export default createModeSlice;
