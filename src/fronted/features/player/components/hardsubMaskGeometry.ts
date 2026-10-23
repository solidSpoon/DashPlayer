import type { HardsubMaskRect } from '@/fronted/features/player/playerUiStore';

/**
 * 遮挡贴片的几何换算：画面矩形、拖拽换算、手柄布局。
 *
 * 这里只有纯函数与常量，不碰 React、不碰 store，便于单独验证，也让组件只留交互与渲染。
 */

/** 画面矩形：视频按 `object-fit: contain` 缩放居中后，真正有像素的那块区域，单位与容器一致。 */
export interface PictureRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

/** 贴片矩形（画面内像素）：拖拽过程中的中间量，与持久化的比例矩形相互换算。 */
export interface PatchBox {
    left: number;
    top: number;
    width: number;
    height: number;
}

/** 贴片的拖动形态：整体移动，或拉动某条边/某个角缩放。 */
export type DragKind = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** 贴片最小尺寸（画面内像素）：再小就既盖不住字也抓不住了。 */
export const MIN_PATCH_WIDTH = 48;
export const MIN_PATCH_HEIGHT = 16;

/** 边与角上拖拽热区的厚度（像素）。 */
export const HANDLE_THICKNESS = 12;

/** 手柄的静态布局：位置类名、对应光标、中心抓手的形状。 */
export const HARDSUB_MASK_HANDLES: ReadonlyArray<{
    kind: DragKind;
    className: string;
    grip: 'dot' | 'horizontal' | 'vertical';
}> = [
    { kind: 'nw', className: 'left-0 top-0 cursor-nwse-resize', grip: 'dot' },
    { kind: 'ne', className: 'right-0 top-0 cursor-nesw-resize', grip: 'dot' },
    { kind: 'sw', className: 'left-0 bottom-0 cursor-nesw-resize', grip: 'dot' },
    { kind: 'se', className: 'right-0 bottom-0 cursor-nwse-resize', grip: 'dot' },
    { kind: 'n', className: 'left-1/2 top-0 -translate-x-1/2 cursor-ns-resize', grip: 'horizontal' },
    { kind: 's', className: 'left-1/2 bottom-0 -translate-x-1/2 cursor-ns-resize', grip: 'horizontal' },
    { kind: 'w', className: 'left-0 top-1/2 -translate-y-1/2 cursor-ew-resize', grip: 'vertical' },
    { kind: 'e', className: 'right-0 top-1/2 -translate-y-1/2 cursor-ew-resize', grip: 'vertical' },
];

/** 数值夹紧到 `[min, max]`。 */
function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * 计算视频在容器内实际渲染的画面矩形（等价于 `object-fit: contain` 的居中留黑）。
 *
 * @param containerWidth 容器宽度（像素）。
 * @param containerHeight 容器高度（像素）。
 * @param videoWidth 视频固有宽度（像素），0 表示元数据未就绪。
 * @param videoHeight 视频固有高度（像素），0 表示元数据未就绪。
 * @returns 画面矩形；任一维度不可用时退化为整个容器。
 */
export function computePictureRect(
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
 * 比例矩形 → 画面内像素矩形。
 *
 * @param rect 贴片的比例矩形（0~1）。
 * @param picture 画面矩形。
 * @returns 画面内像素矩形。
 */
export function toPatchBox(rect: HardsubMaskRect, picture: PictureRect): PatchBox {
    return {
        left: rect.x * picture.width,
        top: rect.y * picture.height,
        width: rect.w * picture.width,
        height: rect.h * picture.height,
    };
}

/**
 * 画面内像素矩形 → 比例矩形。
 *
 * @param box 画面内像素矩形。
 * @param picture 画面矩形，宽高须为正（调用方已挡掉未就绪的情况）。
 * @returns 比例矩形；画面尺寸不可用时返回全 0，避免把 NaN 写进 store。
 */
export function fromPatchBox(box: PatchBox, picture: PictureRect): HardsubMaskRect {
    if (picture.width <= 0 || picture.height <= 0) {
        return { x: 0, y: 0, w: 0, h: 0 };
    }
    return {
        x: box.left / picture.width,
        y: box.top / picture.height,
        w: box.width / picture.width,
        h: box.height / picture.height,
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
export function applyDrag(start: PatchBox, kind: DragKind, dx: number, dy: number, picture: PictureRect): PatchBox {
    if (kind === 'move') {
        return {
            left: clamp(start.left + dx, 0, Math.max(0, picture.width - start.width)),
            top: clamp(start.top + dy, 0, Math.max(0, picture.height - start.height)),
            width: start.width,
            height: start.height,
        };
    }

    let { left, top, width, height } = start;
    const movesLeft = kind === 'w' || kind === 'nw' || kind === 'sw';
    const movesRight = kind === 'e' || kind === 'ne' || kind === 'se';
    const movesTop = kind === 'n' || kind === 'ne' || kind === 'nw';
    const movesBottom = kind === 's' || kind === 'se' || kind === 'sw';

    if (movesLeft) {
        // 右下角钉住，左沿最多推到只剩最小宽度
        const nextLeft = clamp(start.left + dx, 0, start.left + start.width - Math.min(MIN_PATCH_WIDTH, start.width));
        width = start.width + (start.left - nextLeft);
        left = nextLeft;
    }
    if (movesRight) {
        const maxWidth = Math.max(1, picture.width - start.left);
        width = clamp(start.width + dx, Math.min(MIN_PATCH_WIDTH, maxWidth), maxWidth);
    }
    if (movesTop) {
        const nextTop = clamp(start.top + dy, 0, start.top + start.height - Math.min(MIN_PATCH_HEIGHT, start.height));
        height = start.height + (start.top - nextTop);
        top = nextTop;
    }
    if (movesBottom) {
        const maxHeight = Math.max(1, picture.height - start.top);
        height = clamp(start.height + dy, Math.min(MIN_PATCH_HEIGHT, maxHeight), maxHeight);
    }
    return { left, top, width, height };
}
