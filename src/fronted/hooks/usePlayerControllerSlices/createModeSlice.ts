import { StateCreator } from 'zustand/esm';
import { ModeSlice, PlayerSlice, SentenceSlice } from './SliceTypes';
import toast from 'react-hot-toast';
import usePlayerToaster from '@/fronted/hooks/usePlayerToaster';

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
            usePlayerToaster.getState().setNotification({ type: 'info', text: get().autoPause ? 'Auto pause off' : 'Auto pause on' });
            set((state) => ({ autoPause: !state.autoPause }));
        } else {
            if (target !== get().autoPause) {
                usePlayerToaster.getState().setNotification({ type: 'info', text: get().autoPause ? 'Auto pause off' : 'Auto pause on' });
                set({
                    autoPause: target
                });
            }
        }
    }
});

export default createModeSlice;
