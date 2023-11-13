import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

const api = window.electron;

export type GlobalClipboardState = {
    copyCallback: (() => string) | null;
    pasteCallback: ((cs: string) => void) | null;
};

type GlobalClipboardActions = {
    registerCopy: (callback: () => string) => () => void;
    registerPaste: (callback: (cs: string) => void) => () => void;
};

const useGlobalClipboard = create(
    subscribeWithSelector<GlobalClipboardState & GlobalClipboardActions>(
        (set) => ({
            copyCallback: null,
            pasteCallback: null,
            registerCopy: (callback: () => string) => {
                set((state) => ({
                    copyCallback: callback,
                }));
                return () => {
                    set((state) => ({
                        copyCallback: null,
                    }));
                };
            },
            registerPaste: (callback: (cs: string) => void) => {
                set((state) => ({
                    pasteCallback: callback,
                }));
                return () => {
                    set((state) => ({
                        pasteCallback: null,
                    }));
                };
            },
        })
    )
);
export default useGlobalClipboard;

window.addEventListener('copy', (e) => {
    console.log('copy', e);
    const cpCb = useGlobalClipboard.getState().copyCallback;
    if (cpCb === null) {
        return;
    }
    e.preventDefault();
    const cpContent = cpCb();
    api.writeToClipboard(cpContent);
});

window.addEventListener('paste', async (e) => {
    const pasteCb = useGlobalClipboard.getState().pasteCallback;
    if (pasteCb === null) {
        return;
    }
    e.preventDefault();
    const text = await api.readFromClipboard();
    pasteCb(text);
});
