import { create } from 'zustand';
import usePlayerToaster from './usePlayerToaster';
import usePlayerController from './usePlayerController';

export type UseCopyModeState = {
    isCopyMode: boolean,
    copyContent: string,
};

export type UseCopyModeActions = {
    enterCopyMode: () => void;
    exitCopyMode: () => void;
    setCopyContent: (content: string) => void;

};

const Toaster = usePlayerToaster.getState();
const { pause } = usePlayerController.getState();


const useCopyModeController = create<UseCopyModeState & UseCopyModeActions>(
    (set,get) => ({
        isCopyMode: false,
        copyContent: '',
        enterCopyMode: () => {
            // pause the video
            pause();
            Toaster.setNotification({ type: 'info', text: 'open copy mode' });
            set({ isCopyMode: true })
        },
        exitCopyMode: () => {
            navigator.clipboard.writeText((get().copyContent));
            Toaster.setNotification({ type: 'info', text: 'close copy mode' });
            // Toaster.setNotification({ type: 'info', text: 'copy success' });
            set({ isCopyMode: false, copyContent: '' })

        },
        setCopyContent: (content: string) => {
            set({copyContent:content})
            Toaster.setNotification({ type: 'info', text: `copy: ${content} ` });
        },
    })
);


export default useCopyModeController;
