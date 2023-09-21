import React, { useEffect, useRef } from 'react';
import * as turf from '@turf/turf';
import {
    autoPlacement,
    offset,
    useFloating,
    useInteractions,
} from '@floating-ui/react';
import { Feature, Polygon } from '@turf/turf';

export interface WordSubParam {
    word: string;
    translation: string;
}

const WordSub = React.forwardRef(
    (
        { word, translation }: WordSubParam,
        ref: React.ForwardedRef<HTMLDivElement | null>
    ) => {
        console.log('bbb render WordSub');

        const { refs, floatingStyles, context } = useFloating({
            middleware: [
                // autoPlacement({ allowedPlacements: ['bottom'] }),
                offset(50),
                autoPlacement({
                    allowedPlacements: [
                        'top',
                        'bottom',
                        'top-end',
                        'bottom-end',
                    ],
                }),
            ],
        });

        const { getReferenceProps, getFloatingProps } = useInteractions([]);

        return (
            <>
                <div
                    ref={refs.setReference}
                    className="rounded select-none bg-zinc-600 z-50"
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
                >
                    <div
                        className="rounded-lg  z-50 bg-gray-900 p-10 text-xl"
                        ref={ref}
                    >
                        {translation}
                    </div>
                </div>
            </>
        );
    }
);

export default WordSub;
