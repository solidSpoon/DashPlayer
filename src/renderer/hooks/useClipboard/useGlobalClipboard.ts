import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface ClipboardContent {
    id?: number;
    type: 'text' | 'image' | 'dp-excel' | 'none';
    content?: any;
}

export type GlobalClipboardState = {
    internal: {
        maxId: number;
    };
    content: ClipboardContent[];
    copyCallbacks: (() => ClipboardContent)[];
    pasteCallbacks: ((cs: ClipboardContent[]) => void)[];
    addContent: (content: ClipboardContent) => void;
};

type GlobalClipboardActions = {
    registerCopy: (callback: () => ClipboardContent) => () => void;
    registerPaste: (callback: (cs: ClipboardContent[]) => void) => () => void;
};

const useGlobalClipboard = create(
    subscribeWithSelector<GlobalClipboardState & GlobalClipboardActions>(
        (set) => ({
            internal: {
                maxId: 0,
            },
            content: [],
            copyCallbacks: [],
            pasteCallbacks: [],
            registerCopy: (callback: () => ClipboardContent) => {
                set((state) => ({
                    copyCallbacks: [...state.copyCallbacks, callback],
                }));
                return () => {
                    set((state) => ({
                        copyCallbacks: state.copyCallbacks.filter(
                            (cb) => cb !== callback
                        ),
                    }));
                };
            },
            registerPaste: (callback: (cs: ClipboardContent[]) => void) => {
                set((state) => ({
                    pasteCallbacks: [...state.pasteCallbacks, callback],
                }));
                return () => {
                    set((state) => ({
                        pasteCallbacks: state.pasteCallbacks.filter(
                            (cb) => cb !== callback
                        ),
                    }));
                };
            },
            addContent: (content: ClipboardContent) => {
                set((state) => {
                    const maxId = state.internal.maxId + 1;
                    return {
                        internal: {
                            maxId,
                        },
                        content: [
                            ...state.content,
                            {
                                ...content,
                                id: maxId,
                            },
                        ],
                    };
                });
            },
        })
    )
);
export default useGlobalClipboard;

window.addEventListener('copy', (e) => {
    console.log('copy', e);
    const cpCbs = useGlobalClipboard.getState().copyCallbacks;
    if (cpCbs.length === 0) {
        return;
    }
    e.preventDefault();
    const cpContents = cpCbs.map((cb) => cb());
    console.log('text', cpContents);
    cpContents.forEach((c) => {
        useGlobalClipboard.getState().addContent(c);
    });
});

window.addEventListener('paste', (e) => {
    const pasteCbs = useGlobalClipboard.getState().pasteCallbacks;
    if (pasteCbs.length === 0) {
        return;
    }
    e.preventDefault();
    console.log('paste', e);
    const text = useGlobalClipboard.getState().content;
    console.log('text', text);
    pasteCbs.forEach((cb) => cb(text));
});
