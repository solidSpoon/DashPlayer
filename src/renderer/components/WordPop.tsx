import React, { useEffect, useRef } from 'react';
import * as turf from '@turf/turf';
import {
    autoPlacement,
    offset,
    useFloating,
    useInteractions,
} from '@floating-ui/react';
import { Feature, Polygon } from '@turf/turf';
import { AiOutlineSound } from 'react-icons/ai';
import { YdRes } from '../lib/param/yd/a';

export interface WordSubParam {
    word: string;
    translation: YdRes | undefined;
}

const WordPop = React.forwardRef(
    (
        { word, translation }: WordSubParam,
        ref: React.ForwardedRef<HTMLDivElement | null>
    ) => {
        console.log('popper', translation);

        const { refs, floatingStyles, context } = useFloating({
            middleware: [
                // autoPlacement({ allowedPlacements: ['bottom'] }),
                offset(50),
                autoPlacement({
                    allowedPlacements: [
                        'top',
                        'bottom',
                        'top-start',
                        'top-end',
                        'bottom-start',
                        'bottom-end',
                    ],
                }),
            ],
        });

        const { getReferenceProps, getFloatingProps } = useInteractions([]);
        const audio = useRef<HTMLAudioElement | null>(null);

        const play = async (type: 'us' | 'uk') => {
            audio.current?.pause();
            try {
                if (type === 'us' && translation?.basic['us-speech']) {
                    audio.current = new Audio(translation?.basic['us-speech']);
                    audio.current.volume = 0.3;
                    await audio.current.play();
                }
                if (type === 'uk' && translation?.basic['uk-speech']) {
                    audio.current = new Audio(translation?.basic['uk-speech']);
                    audio.current.volume = 0.3;
                    await audio.current.play();
                }
            } catch (e) {
                return false;
            }
            return true;
        };

        const clickPlay = async () => {
            if (await play('us')) {
                return;
            }
            await play('uk');
        };

        const popper = () => {
            if (!translation) {
                return <div className="text-2xl">loading</div>;
            }
            return (
                <div className="max-w-sm max-h-96 overflow-y-auto flex flex-col items-start bg-gray-900 rounded-lg pt-4 px-4">
                    <div className="text-2xl mb-2 flex justify-start items-center gap-4">
                        {translation.query}
                        <div>{translation.translation}</div>
                    </div>
                    <div className="pl-2 text-base flex justify-start items-center gap-2">
                        {`美 [${translation.basic['us-phonetic']}]`}
                        <AiOutlineSound
                            onClick={() => play('us')}
                            className="cursor-pointer hover:text-gray-400 text-2xl"
                        />
                    </div>
                    <div className="pl-2 text-base flex justify-start items-start gap-2">
                        {`英 [${translation.basic['uk-phonetic']}]`}
                        <AiOutlineSound
                            onClick={() => play('uk')}
                            className="cursor-pointer hover:text-gray-400 text-2xl"
                        />
                    </div>
                    <div className="text-base mt-2 flex flex-col gap-2 items-start">
                        {translation.basic.explains.map((e) => {
                            return (
                                <div className="p-2 rounded text-left w-full bg-gray-800">
                                    {e}
                                </div>
                            );
                        })}
                    </div>
                    {translation.basic.exam_type && (
                        <>
                            <div className="text-sm text-gray-400 mt-2 mb-1">
                                标签
                            </div>
                            <div className="text-sm">
                                {translation.basic.exam_type.join('/')}
                            </div>
                        </>
                    )}
                    <div className="sticky bottom-0 text-cyan-100 text-lg text-center bg-gray-900/95 w-full pt-1 mt-1 pb-2">
                        {translation.translation}
                    </div>
                </div>
            );
        };

        return (
            <>
                <div
                    ref={refs.setReference}
                    className="rounded select-none bg-zinc-600 z-50"
                    role="button"
                    tabIndex={0}
                    onClick={clickPlay}
                    {...getReferenceProps()}
                >
                    {word}
                </div>

                <div
                    {...getFloatingProps()}
                    ref={refs.setFloating}
                    style={floatingStyles}
                >
                    <div className="z-50" ref={ref}>
                        {popper()}
                    </div>
                </div>
            </>
        );
    }
);

export default WordPop;
