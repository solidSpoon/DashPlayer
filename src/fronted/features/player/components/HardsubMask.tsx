import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';

import { cn } from '@/fronted/lib/utils';
import { DEFAULT_HARDSUB_MASK_RECT, usePlayerUi, type HardsubMaskRect } from '@/fronted/features/player/playerUiStore';
import {
    applyDrag,
    computePictureRect,
    fromPatchBox,
    HARDSUB_MASK_HANDLES,
    HANDLE_THICKNESS,
    toPatchBox,
    type DragKind,
    type PatchBox,
} from '@/fronted/features/player/components/hardsubMaskGeometry';

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

/** 判断指针是否落在某元素的可视矩形内（松手后重算悬停态用）。 */
function isPointerInside(element: HTMLElement | null, clientX: number, clientY: number): boolean {
    if (!element) {
        return false;
    }
    const box = element.getBoundingClientRect();
    return clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom;
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
 * - 悬停时贴片浮出边/角热区，平时就是一块干净黑块；拖动中热区常显；
 * - 双击贴片恢复默认（画面底部通栏），拖飞了能找回来；
 * - 开与关只由控制条与「播放控制」面板里的「挡字幕」开关负责，贴片上不挂任何按钮或提示。
 *
 * 几何换算在 `hardsubMaskGeometry.ts`，控制条让位在 `hardsubMaskBarLayout.ts`，这里只管交互与渲染。
 *
 * @returns 遮挡贴片；未开启遮挡时不渲染任何内容。
 */
export default function HardsubMask({ video }: HardsubMaskProps) {
    const { t } = useI18nTranslation('player');
    const maskOn = usePlayerUi((s) => s.hardsubMaskOn);
    const maskRect = usePlayerUi((s) => s.hardsubMaskRect);
    const dragging = usePlayerUi((s) => s.hardsubMaskDragging);
    const setMaskRect = usePlayerUi((s) => s.setHardsubMaskRect);
    const setMaskHovering = usePlayerUi((s) => s.setHardsubMaskHovering);
    const setMaskDragging = usePlayerUi((s) => s.setHardsubMaskDragging);
    const setPatchTopInset = usePlayerUi((s) => s.setHardsubMaskPatchTopInset);
    const setPatchBottomInset = usePlayerUi((s) => s.setHardsubMaskPatchBottomInset);
    const setStageHeight = usePlayerUi((s) => s.setHardsubMaskStageHeight);

    const containerRef = useRef<HTMLDivElement>(null);
    const patchRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
    // 拖动期间用本地草稿渲染，松手才写回 store：避免每帧都往 localStorage 落一份
    const [draft, setDraft] = useState<HardsubMaskRect | null>(null);
    const draftRef = useRef<HardsubMaskRect | null>(null);
    const dragRef = useRef<{
        kind: DragKind;
        pointerX: number;
        pointerY: number;
        start: PatchBox;
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

    /**
     * 结束一次拖拽：本地草稿落盘、清掉拖拽态，并按指针当前位置重算悬停态。
     *
     * 这里不能直接把悬停态置 false：松手时指针通常还压在贴片上，DOM 不会再补发
     * pointerenter，控制条就会立刻跑回贴片上方，得把鼠标移出再移入才恢复。
     */
    const finishDrag = useCallback(
        (event?: ReactPointerEvent<HTMLDivElement>) => {
            if (draftRef.current) {
                setMaskRect(draftRef.current);
            }
            draftRef.current = null;
            dragRef.current = null;
            setDraft(null);
            setMaskDragging(false);
            setMaskHovering(
                event ? isPointerInside(patchRef.current, event.clientX, event.clientY) : false
            );
        },
        [setMaskRect, setMaskDragging, setMaskHovering]
    );

    const beginDrag = useCallback(
        (kind: DragKind) => (event: ReactPointerEvent<HTMLDivElement>) => {
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
                start: toPatchBox(maskRect, picture),
            };
            setMaskDragging(true);
            setMaskHovering(true);
        },
        [maskRect, picture, setMaskDragging, setMaskHovering]
    );

    const moveDrag = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
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
            const normalized = fromPatchBox(next, picture);
            draftRef.current = normalized;
            setDraft(normalized);
        },
        [picture]
    );

    // 贴片卸载（关掉遮挡/切走）时复位，别让控制条一直以为鼠标还压在贴片上
    useEffect(
        () => () => {
            setMaskHovering(false);
            setMaskDragging(false);
        },
        [setMaskHovering, setMaskDragging]
    );

    const showMask = maskOn && picture.width > 0 && picture.height > 0;
    const rectNow = draft ?? maskRect;
    const patchWidth = rectNow.w * picture.width;
    const patchHeight = rectNow.h * picture.height;
    // 贴片上沿 / 下沿到舞台底部的距离：控制条按下沿判断要不要让位，按上沿决定抬多高
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
    }, [
        patchTopInset,
        patchBottomInset,
        showMask,
        containerSize.height,
        setPatchTopInset,
        setPatchBottomInset,
        setStageHeight,
    ]);
    useEffect(
        () => () => {
            setPatchTopInset(0);
            setPatchBottomInset(0);
            setStageHeight(0);
        },
        [setPatchTopInset, setPatchBottomInset, setStageHeight]
    );

    return (
        <div
            ref={containerRef}
            data-hardsub-mask="root"
            className="absolute inset-0 z-[15] pointer-events-none select-none"
        >
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
                    {/* 遮挡贴片：本体拖动移动，边/角拖拽缩放。
                        视觉上就是一块直角纯色块，不做模糊、渐变和羽化 */}
                    <div
                        ref={patchRef}
                        data-hardsub-mask="patch"
                        role="group"
                        aria-label={t('hardsubMask.patchAria')}
                        className={cn(
                            'group absolute pointer-events-auto touch-none',
                            dragging ? 'cursor-grabbing' : 'cursor-grab'
                        )}
                        style={{
                            left: rectNow.x * picture.width,
                            top: rectNow.y * picture.height,
                            width: patchWidth,
                            height: patchHeight,
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
                        {/* 纯黑块：不拖拽时完全不透明（不透明才真能挡住字幕）；
                            拖动时透一点，方便边拖边对位；不加圆角，四个边保持直角 */}
                        <div
                            className={cn(
                                'pointer-events-none absolute inset-0 transition-colors duration-200',
                                dragging ? 'bg-black/85' : 'bg-black'
                            )}
                        />
                        {/* 悬停/拖动时一层很淡的白雾：让它能被找到，又不改变画面明暗 */}
                        <div
                            className={cn(
                                'pointer-events-none absolute inset-0 transition-colors duration-200',
                                dragging ? 'bg-white/[0.09]' : 'bg-transparent group-hover:bg-white/[0.05]'
                            )}
                        />

                        {HARDSUB_MASK_HANDLES.map((handle) => (
                            <div
                                key={handle.kind}
                                data-hardsub-mask-handle={handle.kind}
                                className={cn(
                                    'absolute flex items-center justify-center touch-none',
                                    'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100',
                                    'transition-opacity duration-150',
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
