import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';

import { cn } from '@/fronted/lib/utils';
import { DEFAULT_HARDSUB_MASK_RECT, usePlayerUi, type HardsubMaskRect } from '@/fronted/features/player/playerUiStore';

/** 画面矩形：视频按 `object-fit: contain` 缩放居中后，真正有像素的那块区域，单位与容器一致。 */
interface PictureRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

/** 贴片的拖动形态：整体移动，或拉动某条边/某个角缩放。 */
type DragKind = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface HardsubMaskProps {
    /**
     * 承载画面的 `<video>` 元素。
     *
     * 只用于读取固有尺寸，据此把贴片坐标换算到真实画面而不是容器：
     * 宽高比不匹配时上下会留黑边，按容器算会让贴片整体偏移、盖不准字幕。
     * 未传或元数据还没加载时退化为按容器计算。
     */
    video: HTMLVideoElement | null;
}

/** 贴片最小尺寸（画面内像素）：再小就既盖不住字也抓不住了。 */
const MIN_PATCH_WIDTH = 48;
const MIN_PATCH_HEIGHT = 16;

/** 边与角上拖拽热区的厚度（像素）。 */
const HANDLE_THICKNESS = 12;

/**
 * 计算视频在容器内实际渲染的画面矩形（等价于 `object-fit: contain` 的居中留黑）。
 *
 * @param containerWidth 容器宽度（像素）。
 * @param containerHeight 容器高度（像素）。
 * @param videoWidth 视频固有宽度（像素），0 表示元数据未就绪。
 * @param videoHeight 视频固有高度（像素），0 表示元数据未就绪。
 * @returns 画面矩形；任一维度不可用时退化为整个容器。
 */
function computePictureRect(
    containerWidth: number,
    containerHeight: number,
    videoWidth: number,
    videoHeight: number
): PictureRect {
    if (containerWidth <= 0 || containerHeight <= 0) {
        return { left: 0, top: 0, width: 0, height: 0 };
    }
    if (videoWidth <= 0 || videoHeight <= 0) {
        return { left: 0, top: 0, width: containerWidth, height: containerHeight };
    }
    const scale = Math.min(containerWidth / videoWidth, containerHeight / videoHeight);
    const width = videoWidth * scale;
    const height = videoHeight * scale;
    return {
        left: (containerWidth - width) / 2,
        top: (containerHeight - height) / 2,
        width,
        height,
    };
}

/**
 * 把一次拖拽换算成新的贴片矩形，并夹在画面内、保证不小于最小尺寸。
 *
 * @param start 拖拽开始时的矩形（画面内像素）。
 * @param kind 拖动形态。
 * @param dx 指针水平位移（像素）。
 * @param dy 指针垂直位移（像素）。
 * @param picture 画面矩形：宽高用于夹紧边界。
 * @returns 新的矩形（画面内像素）。
 */
function applyDrag(
    start: { left: number; top: number; width: number; height: number },
    kind: DragKind,
    dx: number,
    dy: number,
    picture: PictureRect
): { left: number; top: number; width: number; height: number } {
    let { left, top, width, height } = start;

    if (kind === 'move') {
        left = Math.min(Math.max(0, start.left + dx), Math.max(0, picture.width - width));
        top = Math.min(Math.max(0, start.top + dy), Math.max(0, picture.height - height));
        return { left, top, width, height };
    }

    const movesLeft = kind === 'w' || kind === 'nw' || kind === 'sw';
    const movesRight = kind === 'e' || kind === 'ne' || kind === 'se';
    const movesTop = kind === 'n' || kind === 'ne' || kind === 'nw';
    const movesBottom = kind === 's' || kind === 'se' || kind === 'sw';

    if (movesLeft) {
        const nextLeft = Math.min(Math.max(0, start.left + dx), start.left + start.width - MIN_PATCH_WIDTH);
        width = start.width + (start.left - nextLeft);
        left = nextLeft;
    }
    if (movesRight) {
        width = Math.min(Math.max(MIN_PATCH_WIDTH, start.width + dx), picture.width - start.left);
    }
    if (movesTop) {
        const nextTop = Math.min(Math.max(0, start.top + dy), start.top + start.height - MIN_PATCH_HEIGHT);
        height = start.height + (start.top - nextTop);
        top = nextTop;
    }
    if (movesBottom) {
        height = Math.min(Math.max(MIN_PATCH_HEIGHT, start.height + dy), picture.height - start.top);
    }
    return { left, top, width, height };
}

/**
 * 遮挡画面内嵌字幕（硬字幕）的悬浮贴片。
 *
 * 有些视频的字幕直接烧进画面，关掉字幕轨道也去不掉，跟读时仍会忍不住看。
 * 这里在画面上盖一块纯黑贴片：拖贴片本体挪到字幕所在位置，拖它的边或角改大小。
 * 存的是「画面内比例」，所以换窗口尺寸、进全屏后贴片仍停在同一块画面区域。
 *
 * 交互约定：
 * - 鼠标只有贴片自己接管，画面其余区域点/拖照常（外层容器 `pointer-events-none`）；
 * - 悬停时贴片浮出虚线描边与边/角热区，平时就是一块干净黑块；拖动中描边与热区常显；
 * - 双击贴片恢复默认（画面底部通栏），拖飞了能找回来；
 * - 开与关只由「播放控制」面板里的「挡字幕」开关负责，贴片上不挂任何按钮或提示。
 *
 * @returns 遮挡贴片；未开启遮挡时不渲染任何内容。
 */
export default function HardsubMask({ video }: HardsubMaskProps) {
    const { t } = useI18nTranslation('player');
    const maskOn = usePlayerUi((s) => s.hardsubMaskOn);
    const maskRect = usePlayerUi((s) => s.hardsubMaskRect);
    const setMaskRect = usePlayerUi((s) => s.setHardsubMaskRect);
    const setMaskHovering = usePlayerUi((s) => s.setHardsubMaskHovering);
    const setPatchTopInset = usePlayerUi((s) => s.setHardsubMaskPatchTopInset);
    const setPatchBottomInset = usePlayerUi((s) => s.setHardsubMaskPatchBottomInset);
    const setMaskDragging = usePlayerUi((s) => s.setHardsubMaskDragging);
    const setStageHeight = usePlayerUi((s) => s.setHardsubMaskStageHeight);

    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
    // 拖动期间用本地草稿渲染，松手才写回 store：避免每帧都往 localStorage 落一份
    const [draft, setDraft] = useState<HardsubMaskRect | null>(null);
    const draftRef = useRef<HardsubMaskRect | null>(null);
    const [dragging, setDragging] = useState(false);
    const dragRef = useRef<{
        kind: DragKind;
        pointerX: number;
        pointerY: number;
        start: { left: number; top: number; width: number; height: number };
    } | null>(null);

    // 容器尺寸与视频固有尺寸都可能在播放期间变化（窗口缩放、切换源），两者都要跟踪
    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return undefined;
        }
        const sync = () => {
            const nextContainer = { width: container.clientWidth, height: container.clientHeight };
            const nextVideo = { width: video?.videoWidth ?? 0, height: video?.videoHeight ?? 0 };
            setContainerSize((prev) =>
                prev.width === nextContainer.width && prev.height === nextContainer.height ? prev : nextContainer
            );
            setVideoSize((prev) =>
                prev.width === nextVideo.width && prev.height === nextVideo.height ? prev : nextVideo
            );
        };
        sync();
        const observer = new ResizeObserver(sync);
        observer.observe(container);
        video?.addEventListener('loadedmetadata', sync);
        video?.addEventListener('resize', sync);
        return () => {
            observer.disconnect();
            video?.removeEventListener('loadedmetadata', sync);
            video?.removeEventListener('resize', sync);
        };
    }, [video]);

    const picture = useMemo(
        () => computePictureRect(containerSize.width, containerSize.height, videoSize.width, videoSize.height),
        [containerSize, videoSize]
    );

    /** 结束一次拖拽：把本地草稿落盘、清掉拖拽态。 */
    const finishDrag = useCallback(() => {
        if (draftRef.current) {
            setMaskRect(draftRef.current);
        }
        draftRef.current = null;
        dragRef.current = null;
        setDraft(null);
        setDragging(false);
        setMaskDragging(false);
        setMaskHovering(false);
    }, [setMaskRect, setMaskHovering, setMaskDragging]);

    const beginDrag = useCallback((kind: DragKind) => (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
            kind,
            pointerX: event.clientX,
            pointerY: event.clientY,
            start: {
                left: maskRect.x * picture.width,
                top: maskRect.y * picture.height,
                width: maskRect.w * picture.width,
                height: maskRect.h * picture.height,
            },
        };
        setDragging(true);
        setMaskDragging(true);
        setMaskHovering(true);
    }, [maskRect, picture.height, picture.width, setMaskHovering, setMaskDragging]);

    const moveDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag || picture.width <= 0 || picture.height <= 0) {
            return;
        }
        const next = applyDrag(
            drag.start,
            drag.kind,
            event.clientX - drag.pointerX,
            event.clientY - drag.pointerY,
            picture
        );
        const normalized: HardsubMaskRect = {
            x: next.left / picture.width,
            y: next.top / picture.height,
            w: next.width / picture.width,
            h: next.height / picture.height,
        };
        draftRef.current = normalized;
        setDraft(normalized);
    }, [picture]);

    // 贴片卸载（关掉遮挡/切走）时复位，别让控制条一直以为鼠标还压在贴片上
    useEffect(() => () => {
        setMaskHovering(false);
        setMaskDragging(false);
    }, [setMaskHovering, setMaskDragging]);

    const showMask = maskOn && picture.width > 0 && picture.height > 0;
    const rectNow = draft ?? maskRect;
    // 播报贴片上沿位置：控制条据此抬高，避免与贴片叠在一起互相抢事件
    // 贴片上沿 / 下沿到舞台底部的距离：控制条只看下沿判断要不要让位，看下沿决定抬多高
    const patchTopInset = showMask
        ? Math.max(0, containerSize.height - (picture.top + rectNow.y * picture.height))
        : 0;
    const patchBottomInset = showMask
        ? Math.max(0, containerSize.height - (picture.top + (rectNow.y + rectNow.h) * picture.height))
        : 0;
    useEffect(() => {
        setPatchTopInset(patchTopInset);
        setPatchBottomInset(patchBottomInset);
        setStageHeight(showMask ? containerSize.height : 0);
    }, [patchTopInset, patchBottomInset, showMask, containerSize.height, setPatchTopInset, setPatchBottomInset, setStageHeight]);
    useEffect(() => () => {
        setPatchTopInset(0);
        setPatchBottomInset(0);
        setStageHeight(0);
    }, [setPatchTopInset, setPatchBottomInset, setStageHeight]);
    const rect = rectNow;

    /** 边/角热区：平时不可见也不拦截指针，悬停或拖动时才浮出来接管缩放。 */
    const handles: Array<{ kind: DragKind; className: string; grip: 'dot' | 'horizontal' | 'vertical' }> = [
        { kind: 'nw', className: 'left-0 top-0 cursor-nwse-resize', grip: 'dot' },
        { kind: 'ne', className: 'right-0 top-0 cursor-nesw-resize', grip: 'dot' },
        { kind: 'sw', className: 'left-0 bottom-0 cursor-nesw-resize', grip: 'dot' },
        { kind: 'se', className: 'right-0 bottom-0 cursor-nwse-resize', grip: 'dot' },
        { kind: 'n', className: 'left-1/2 top-0 -translate-x-1/2 cursor-ns-resize', grip: 'horizontal' },
        { kind: 's', className: 'left-1/2 bottom-0 -translate-x-1/2 cursor-ns-resize', grip: 'horizontal' },
        { kind: 'w', className: 'left-0 top-1/2 -translate-y-1/2 cursor-ew-resize', grip: 'vertical' },
        { kind: 'e', className: 'right-0 top-1/2 -translate-y-1/2 cursor-ew-resize', grip: 'vertical' },
    ];

    return (
        <div ref={containerRef} data-hardsub-mask="root" className="absolute inset-0 z-[15] pointer-events-none select-none">
            {showMask && (
                <div
                    className="absolute"
                    style={{
                        left: picture.left,
                        top: picture.top,
                        width: picture.width,
                        height: picture.height,
                    }}
                >
                    {/* 遮挡贴片：本体拖动移动，边/角拖拽缩放 */}
                    <div
                        data-hardsub-mask="patch"
                        aria-label={t('hardsubMask.patchAria')}
                        className={cn(
                            // 轻盈的磨砂：靠模糊把字幕糊掉，只叠一层很淡的暗色，不描边、不投影；
                            // 悬停/拖动只把底色略微加深并浮出抓手，避免一块「板子」压在画面上
                            'group absolute rounded-lg pointer-events-auto touch-none',
                            'bg-neutral-950/28 backdrop-blur-xl transition-colors duration-200',
                            'hover:bg-neutral-950/38',
                            dragging ? 'cursor-grabbing bg-neutral-950/45' : 'cursor-grab'
                        )}
                        style={{
                            left: rect.x * picture.width,
                            top: rect.y * picture.height,
                            width: rect.w * picture.width,
                            height: rect.h * picture.height,
                        }}
                        onPointerDown={beginDrag('move')}
                        onPointerMove={moveDrag}
                        onPointerUp={finishDrag}
                        onPointerCancel={finishDrag}
                        onLostPointerCapture={finishDrag}
                        onPointerEnter={() => setMaskHovering(true)}
                        onPointerLeave={() => {
                            if (!dragRef.current) {
                                setMaskHovering(false);
                            }
                        }}
                        onDoubleClick={() => setMaskRect({ ...DEFAULT_HARDSUB_MASK_RECT })}
                    >
                        {handles.map((handle) => (
                            <div
                                key={handle.kind}
                                data-hardsub-mask-handle={handle.kind}
                                className={cn(
                                    'absolute flex items-center justify-center',
                                    'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 transition-opacity duration-150',
                                    dragging && 'pointer-events-auto opacity-100',
                                    handle.className
                                )}
                                style={{ width: HANDLE_THICKNESS, height: HANDLE_THICKNESS }}
                                onPointerDown={beginDrag(handle.kind)}
                                onPointerMove={moveDrag}
                                onPointerUp={finishDrag}
                                onPointerCancel={finishDrag}
                                onLostPointerCapture={finishDrag}
                            >
                                <span
                                    className={cn(
                                        'bg-white/70',
                                        handle.grip === 'dot' && 'w-1 h-1 rounded-full',
                                        handle.grip === 'horizontal' && 'w-3.5 h-0.5 rounded-full',
                                        handle.grip === 'vertical' && 'w-0.5 h-3.5 rounded-full'
                                    )}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
