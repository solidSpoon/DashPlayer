import { useEffect, useState } from 'react';
import {
    autoPlacement,
    offset,
    shift,
    useDismiss,
    useFloating,
    useHover,
    useInteractions,
} from '@floating-ui/react';
import callApi from '../lib/apis/ApiWrapper';
import { YdRes } from '../lib/param/yd/a';

export interface WordSubParam {
    word: string;
    translation: string;
}
const WordSub = ({ word, translation }: WordSubParam) => {
    const { refs, floatingStyles, context } = useFloating({
        middleware: [
            // autoPlacement({ allowedPlacements: ['bottom'] }),
            offset(50),
            autoPlacement({
                allowedPlacements: ['top', 'bottom', 'top-end', 'bottom-end'],
            }),
        ],
    });

    const { getReferenceProps, getFloatingProps } = useInteractions([]);

    return (
        <>
            <div
                ref={refs.setReference}
                className="rounded  select-none hover:bg-zinc-600"
                role="button"
                tabIndex={0}
                {...getReferenceProps()}
            >
                {word}
            </div>

            <div
                {...getFloatingProps()}
                ref={refs.setFloating}
                style={floatingStyles}
                className="rounded-lg  z-50 bg-gray-900 p-10 text-xl"
            >
                {translation}
            </div>
        </>
    );
};

export default WordSub;
