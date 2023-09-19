import { useEffect, useRef, useState } from 'react';
import * as turf from '@turf/turf';
import {
    autoPlacement,
    offset,
    shift,
    useDismiss,
    useFloating,
    useHover,
    useInteractions,
} from '@floating-ui/react';
import { Feature, Polygon } from '@turf/turf';

export interface WordSubParam {
    word: string;
    translation: string;
    onMoustOut: () => void;
}

/**
 * 以左上角为原点，顺时针旋转
 */
const getBox = (ele: HTMLDivElement): Feature<Polygon> => {
    const rect = ele.getBoundingClientRect();
    return turf.polygon([
        [
            [rect.left, rect.top],
            [rect.right, rect.top],
            [rect.right, rect.bottom],
            [rect.left, rect.bottom],
            [rect.left, rect.top],
        ],
    ]);
};

const WordSub = ({ word, translation, onMoustOut }: WordSubParam) => {
    const popperRef = useRef<HTMLDivElement | null>(null);
    const eleRef = useRef<HTMLDivElement | null>(null);
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

    const setPopperRef = (node: HTMLDivElement | null) => {
        refs.setReference(node);
        popperRef.current = node;
    };

    const setEleRef = (node: HTMLDivElement | null) => {
        refs.setFloating(node);
        eleRef.current = node;
    };

    useEffect(() => {
        // 如果鼠标移出了凸多边形，就关闭
        const event = (e: MouseEvent) => {
            if (popperRef.current === null || eleRef.current === null) {
                return;
            }
            const popper = getBox(popperRef.current);
            const ele = getBox(eleRef.current);
            // 凸多边形
            const hull = turf.convex(turf.featureCollection([popper, ele]));
            const point = turf.point([e.clientX, e.clientY]);
            if (!turf.booleanPointInPolygon(point, hull!)) {
                onMoustOut();
            }
        };
        document.addEventListener('mousemove', event);
        return () => document.removeEventListener('mousemove', event);
    }, [onMoustOut]);

    return (
        <>
            <div
                ref={setPopperRef}
                className="rounded  select-none hover:bg-zinc-600"
                role="button"
                tabIndex={0}
                {...getReferenceProps()}
            >
                {word}
            </div>

            <div
                {...getFloatingProps()}
                ref={setEleRef}
                style={floatingStyles}
                className="rounded-lg  z-50 bg-gray-900 p-10 text-xl"
            >
                {translation}
            </div>
        </>
    );
};

export default WordSub;
