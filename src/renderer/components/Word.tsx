import { useState } from 'react';
import {
    autoPlacement,
    offset,
    shift,
    useFloating,
    useHover,
    useInteractions,
} from '@floating-ui/react';

export interface WordParam {
    word: string;
    translation: string;
}
const Word = ({ word, translation }: WordParam) => {
    const [isOpen, setIsOpen] = useState(false);

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        middleware: [
            // autoPlacement({ allowedPlacements: ['bottom'] }),
            offset(50),
            autoPlacement({
                allowedPlacements: ['top', 'bottom', 'top-end', 'bottom-end'],
            }),
        ],
    });

    const hover = useHover(context);

    const { getReferenceProps, getFloatingProps } = useInteractions([hover]);
    const trans = (str: string): void => {
        console.log('click');
        window.electron.ipcRenderer.sendMessage('trans-word', [str]);
        window.electron.ipcRenderer.once('trans-word', () => {
            console.log('trans word success');
        });
    };
    const t = () => trans(word);

    // 并没有用到，只是为了让 eslint 不报错
    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            t();
        }
    };
    return (
        <>
            <span
                ref={refs.setReference}
                className="rounded  select-none hover:bg-zinc-600"
                role="button"
                tabIndex={0}
                onClick={t}
                onKeyDown={handleKeyDown}
                {...getReferenceProps()}
            >
                {word}
            </span>
            {isOpen && (
                <div
                    {...getFloatingProps()}
                    ref={refs.setFloating}
                    style={floatingStyles}
                    className="rounded-lg  bg-gray-900 p-10 text-xl"
                >
                    {word}
                </div>
            )}
        </>
    );
};

export default Word;
