/**
 * 侧栏滚动的测量层：把 `getBoundingClientRect` 的视觉像素换成布局像素，并按 data index 认锚点行。
 *
 * 为什么单列一层：这些函数只跟 DOM 与坐标系打交道，一丁点业务意图都没有（不决定滚不滚、滚多少）。
 * 把它们和「hold 意图」放在一个文件里，会让缩换算、取样、等稳定的细节淹没策略本身；
 * 分开之后，策略文件里只剩下「什么时候等、算多少、写几次、怎么收尾」。
 *
 * 坐标约定：`getBoundingClientRect()` 是视觉像素，`scrollTop` / `clientHeight` / `offsetTop` 是布局像素；
 * 容器被 CSS transform 缩放时两者不等，因此缩放比例必须**每次实测**，不能写死为 1。
 */
import { SENTENCE_CARD_TESTID } from '@/fronted/features/player/dev/scrollWriteLog';
import type { AnchorSample } from './scrollTarget';

/** 判定「布局稳定」所需的连续不变帧数。 */
const STABLE_FRAMES = 6;

/** 等布局稳定的超时时间（毫秒）；超时由调用方按 fail closed 处理。 */
const STABILITY_TIMEOUT_MS = 1500;

/** 切换前的快照。 */
export interface BeforeSnapshot {
    /** 切换前的滚动位置（布局像素）。 */
    scrollTop: number;
    /** 切换前的内容高度（布局像素）。 */
    contentHeight: number;
    /** 切换前最上方可见行。 */
    anchor: NonNullable<AnchorSample>;
}

/** 等待布局稳定的结果。 */
export type StabilityResult = 'stable' | 'missing' | 'timeout';

/**
 * 等待一帧。
 *
 * @returns 下一帧触发时结束的 Promise。
 */
export const nextFrame = (): Promise<void> => new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
});

/**
 * 等待若干帧。
 *
 * @param frames 帧数。
 * @returns 全部帧过去后结束的 Promise。
 */
export const waitFrames = async (frames: number): Promise<void> => {
    for (let i = 0; i < frames; i += 1) {
        await nextFrame();
    }
};

/**
 * 实测容器当前的缩放比例。
 *
 * @param scroller 滚动容器。
 * @returns 视觉像素 / 布局像素的比例；无法测量时按 1 处理。
 */
export const measureScale = (scroller: HTMLElement): number => {
    const rect = scroller.getBoundingClientRect();
    if (scroller.clientHeight <= 0) {
        return 1;
    }
    const scale = rect.height / scroller.clientHeight;
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
};

/**
 * 找到指定 data index 的字幕行节点。
 *
 * @param scroller 滚动容器。
 * @param index 行下标（data index）。
 * @returns 已渲染的节点；不在渲染范围内时为 null。
 */
export const findAnchorNode = (scroller: HTMLElement, index: number): HTMLElement | null => {
    const nodes = scroller.querySelectorAll<HTMLElement>(
        `[data-testid="${SENTENCE_CARD_TESTID}"][data-index]`,
    );
    for (const node of nodes) {
        if (Number(node.dataset.index) === index) {
            return node;
        }
    }
    return null;
};

/**
 * 测量指定行到容器顶的距离（布局像素）。
 *
 * @param scroller 滚动容器。
 * @param node 行节点。
 * @returns 布局像素距离；可为负（行顶部在容器上方）。
 */
export const measureRowTop = (scroller: HTMLElement, node: HTMLElement): number => {
    const scrollerRect = scroller.getBoundingClientRect();
    const scale = measureScale(scroller);
    return (node.getBoundingClientRect().top - scrollerRect.top) / scale;
};

/**
 * 按 data index 测量锚点行当前的位置。
 *
 * 逼近过程中每轮都要按同一下标复测：重排之后「最上面那一行」往往已经换人了。
 *
 * @param scroller 滚动容器。
 * @param index 锚点行的 data index。
 * @returns 行顶到容器顶的距离（布局像素）；行未被渲染时为 null。
 */
export const measureAnchorTop = (scroller: HTMLElement, index: number): number | null => {
    const node = findAnchorNode(scroller, index);
    return node ? measureRowTop(scroller, node) : null;
};

/**
 * 采样切换前的状态：取滚动容器可视区内最靠上的那一行作为锚点。
 *
 * 必须在 store 变更的同一个同步节拍里调用，否则 React 重渲染后量到的已经是新行高。
 *
 * @param scroller 滚动容器。
 * @returns 快照；容器内没有任何可渲染行时为 null。
 */
export const captureBefore = (scroller: HTMLElement): BeforeSnapshot | null => {
    const scrollerRect = scroller.getBoundingClientRect();
    const scale = measureScale(scroller);
    const nodes = scroller.querySelectorAll<HTMLElement>(
        `[data-testid="${SENTENCE_CARD_TESTID}"][data-index]`,
    );
    for (const node of nodes) {
        const index = Number(node.dataset.index);
        if (!Number.isFinite(index)) {
            continue;
        }
        const rect = node.getBoundingClientRect();
        const top = (rect.top - scrollerRect.top) / scale;
        const bottom = (rect.bottom - scrollerRect.top) / scale;
        // 完全在可视区上方的行不算锚点
        if (bottom <= 0) {
            continue;
        }
        return {
            scrollTop: scroller.scrollTop,
            contentHeight: scroller.scrollHeight,
            anchor: { index, top },
        };
    }
    return null;
};

/**
 * 等布局稳定：`scrollHeight` 与锚定行的位置同时连续若干帧不变。
 *
 * 只等 `scrollHeight` 不够——Virtuoso 会先给出新的总高，再逐行修正行高；
 * 只等锚定行不够——行高变化可能还没反映到容器高度上。两者都要静下来才允许写入。
 *
 * @param scroller 滚动容器。
 * @param anchorIndex 锚定行的 data index。
 * @returns 稳定 / 锚定行消失 / 超时。
 */
export const waitForLayoutStable = async (
    scroller: HTMLElement,
    anchorIndex: number,
): Promise<StabilityResult> => {
    const deadline = performance.now() + STABILITY_TIMEOUT_MS;
    let stableFrames = 0;
    let lastContentHeight = -1;
    let lastAnchorTop: number | null = null;
    let missingFrames = 0;

    while (performance.now() < deadline) {
        await nextFrame();
        const contentHeight = scroller.scrollHeight;
        const anchorTop = measureAnchorTop(scroller, anchorIndex);
        if (anchorTop === null) {
            missingFrames += 1;
            // 连续多帧都找不到：锚定行确实被虚拟列表回收了，不必再等
            if (missingFrames >= STABLE_FRAMES) {
                return 'missing';
            }
            stableFrames = 0;
            lastAnchorTop = null;
            lastContentHeight = contentHeight;
            continue;
        }
        missingFrames = 0;

        if (contentHeight === lastContentHeight && anchorTop === lastAnchorTop) {
            stableFrames += 1;
        } else {
            stableFrames = 0;
        }
        lastContentHeight = contentHeight;
        lastAnchorTop = anchorTop;

        if (stableFrames >= STABLE_FRAMES - 1) {
            return 'stable';
        }
    }
    return 'timeout';
};
