/**
 * 「侧栏译文」切换时保持阅读位置的 hold 意图。
 *
 * 老问题：切换译文后每一行的高度都变了，滚动位置却还是原来那个数字，
 * 于是正在读的那一行整体位移（实测几十到几百像素），用户得自己找回原来的位置。
 * 以前在组件里散着写 scrollTop，会和 Virtuoso 的分批重测抢同一个位置，落点乱飞；
 * 现在的做法是：先等布局稳住，再用纯函数算目标，一轮一轮逼近，每轮重算残差（不累加 delta）。
 *
 * 关键约束：
 * - 快照在 store 变更的**同一个同步节拍**里采集（store 订阅回调），否则 React 重渲染之后
 *   再量「切换前」就已经量到了新行高，「变化量」直接变成 0；
 * - 锚点身份用 data index（虚拟列表会回收 DOM 节点，节点引用不可靠），
 *   逼近过程中每轮都按同一个下标重新测量，而不是重新取「最上面那一行」；
 * - 只动用户正在读的那一行，不理会当前高亮句——这个意图的语义就是「别动用户的位置」；
 * - fail closed：拿不到锚点快照就一次都不滚，宁可不动也不能把用户顶到别处；
 * - 收敛不了就记录 `not-converged`，不抛错、不阻塞界面。
 */
import { useEffect } from 'react';
import { usePlayerUi } from '@/fronted/features/player/playerUiStore';
import useSubtitleScroll from './useSubtitleScroll';
import { computeScrollTarget, type AnchorSample } from './scrollTarget';
import {
    SENTENCE_CARD_TESTID,
    beginHold,
    finishHold,
    recordScrollWrite,
    type HoldRecord,
} from '@/fronted/features/player/dev/scrollWriteLog';
import { readHoldPolicy } from '@/fronted/features/player/dev/playerDebug';

/** 判定「布局稳定」所需的连续不变帧数。 */
const STABLE_FRAMES = 6;

/** 等布局稳定的超时时间（毫秒）；超时按未收敛处理，一次都不写。 */
const STABILITY_TIMEOUT_MS = 1500;

/** 写完一次之后等待的帧数，给 Virtuoso 重测与浏览器重排留时间。 */
const SETTLE_FRAMES = 2;

/** 最多逼近几轮。 */
const MAX_ROUNDS = 3;

/** 收敛阈值（布局像素）。 */
const CONVERGE_EPSILON_PX = 1;

/** 单轮最大位移（布局像素）：一次跳变拆成多轮小步，避免一口气冲过头。 */
const MAX_STEP_PX = 400;

/** 写入来源标识，出现在 `__dpDebug.scrollWrites[].source` 里。 */
const HOLD_WRITE_SOURCE = 'side-translation-hold';

/** 切换前的快照。 */
interface BeforeSnapshot {
    /** 切换前的滚动位置（布局像素）。 */
    scrollTop: number;
    /** 切换前的内容高度（布局像素）。 */
    contentHeight: number;
    /** 切换前最上方可见行。 */
    anchor: NonNullable<AnchorSample>;
}

/**
 * 等待一帧。
 *
 * @returns 下一帧触发时结束的 Promise。
 */
const nextFrame = (): Promise<void> => new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
});

/**
 * 等待若干帧。
 *
 * @param frames 帧数。
 * @returns 全部帧过去后结束的 Promise。
 */
const waitFrames = async (frames: number): Promise<void> => {
    for (let i = 0; i < frames; i += 1) {
        await nextFrame();
    }
};

/**
 * 实测容器当前的缩放比例。
 *
 * `getBoundingClientRect()` 给视觉像素，`scrollTop` / `clientHeight` 是布局像素；
 * 容器被 CSS transform 缩放时两者不等，所以每次采样都重新实测，绝不写死为 1。
 *
 * @param scroller 滚动容器。
 * @returns 视觉像素 / 布局像素的比例；无法测量时按 1 处理。
 */
const measureScale = (scroller: HTMLElement): number => {
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
const findAnchorNode = (scroller: HTMLElement, index: number): HTMLElement | null => {
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
const measureRowTop = (scroller: HTMLElement, node: HTMLElement): number => {
    const scrollerRect = scroller.getBoundingClientRect();
    const scale = measureScale(scroller);
    return (node.getBoundingClientRect().top - scrollerRect.top) / scale;
};

/**
 * 按 data index 测量锚点行当前的位置。
 *
 * @param scroller 滚动容器。
 * @param index 锚点行的 data index。
 * @returns 行顶到容器顶的距离（布局像素）；行未被渲染时为 null。
 */
const measureAnchorTop = (scroller: HTMLElement, index: number): number | null => {
    const node = findAnchorNode(scroller, index);
    return node ? measureRowTop(scroller, node) : null;
};

/**
 * 采样切换前的状态：取滚定容器可视区内最靠上的那一行作为锚点。
 *
 * @param scroller 滚动容器。
 * @returns 快照；容器内没有任何可渲染行时为 null。
 */
const captureBefore = (scroller: HTMLElement): BeforeSnapshot | null => {
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
        return { scrollTop: scroller.scrollTop, contentHeight: scroller.scrollHeight, anchor: { index, top } };
    }
    return null;
};

/** 等待布局稳定的结果。 */
type StabilityResult = 'stable' | 'missing' | 'timeout';

/**
 * 等布局稳定：`scrollHeight` 与锚定行的位置同时连续若干帧不变。
 *
 * 只等 `scrollHeight` 不够——Virtuoso 会先给出新的总高，再逐行修正行高；
 * 只等锚定行不够——行高变化可能还没反映到容器高度上。两者都要静下来。
 *
 * @param scroller 滚动容器。
 * @param anchorIndex 锚定行的 data index。
 * @returns 稳定 / 锚定行消失 / 超时。
 */
const waitForLayoutStable = async (
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

/**
 * 执行一次 hold 意图。
 *
 * @param scroller 侧栏滚动容器。
 * @param before 切换瞬间采到的快照。
 * @returns 执行完成（含记录落盘）后结束。
 */
const runHold = async (scroller: HTMLElement, before: BeforeSnapshot): Promise<void> => {
    const policy = readHoldPolicy();
    const { anchor } = before;

    const hold: HoldRecord = beginHold({
        policy,
        anchorIndex: anchor.index,
        anchorTopBefore: anchor.top,
        scrollTopBefore: before.scrollTop,
        contentHeightBefore: before.contentHeight,
    });

    /** 结束记录的统一入口：把当前滚动位置与内容高度一并写回去。 */
    const finish = (result: Parameters<typeof finishHold>[1]): void => {
        finishHold(hold, {
            scrollTopAfter: scroller.scrollTop,
            contentHeightAfter: scroller.scrollHeight,
            ...result,
        });
    };

    const stability = await waitForLayoutStable(scroller, anchor.index);
    if (stability === 'missing') {
        // 锚定行已经被虚拟列表回收：量不到它就不可能把它钉回原处
        finish({ outcome: 'anchor-missing' });
        return;
    }
    if (stability === 'timeout') {
        // 布局一直没静下来：此时写入等于和重排抢位置，按 fail closed 处理
        finish({ outcome: 'not-converged' });
        return;
    }

    if (policy === 'b') {
        // 对照策略：只测量、不补偿
        const settledTop = measureAnchorTop(scroller, anchor.index);
        finish({
            outcome: 'no-compensation',
            anchorTopAfter: settledTop,
            residual: settledTop === null ? null : Math.abs(settledTop - anchor.top),
        });
        return;
    }

    // hold 期间暂停自动跟随，避免「保持位置」与「拉回当前句」两个写入方互相拉扯
    useSubtitleScroll.getState().setHoldActive(true);
    try {
        let rounds = 0;
        let previousResidual: number | null = null;
        let residual: number | null = null;

        while (rounds < MAX_ROUNDS) {
            rounds += 1;

            const currentTop = measureAnchorTop(scroller, anchor.index);
            if (currentTop === null) {
                finish({ outcome: 'anchor-missing', rounds, residual });
                return;
            }
            residual = Math.abs(currentTop - anchor.top);
            if (residual < CONVERGE_EPSILON_PX) {
                finish({ outcome: 'converged', rounds, anchorTopAfter: currentTop, residual });
                return;
            }

            // 每轮都拿「原始快照 + 当前实测」重新算，绝不把上一轮的 delta 累加进来
            const target = computeScrollTarget(
                {
                    before: { scrollTop: before.scrollTop, anchor },
                    after: { scrollTop: scroller.scrollTop, anchor: { index: anchor.index, top: currentTop } },
                },
                { maxStepPx: MAX_STEP_PX },
            );
            if (!target) {
                finish({ outcome: 'anchor-missing', rounds, residual });
                return;
            }

            const from = scroller.scrollTop;
            scroller.scrollTop = target.scrollTop;
            recordScrollWrite({
                source: HOLD_WRITE_SOURCE,
                from,
                to: scroller.scrollTop,
                kind: 'write',
            });

            await waitFrames(SETTLE_FRAMES);

            const settledTop = measureAnchorTop(scroller, anchor.index);
            if (settledTop === null) {
                finish({ outcome: 'anchor-missing', rounds, residual });
                return;
            }
            residual = Math.abs(settledTop - anchor.top);
            if (residual < CONVERGE_EPSILON_PX) {
                finish({ outcome: 'converged', rounds, anchorTopAfter: settledTop, residual });
                return;
            }
            // 残差不再变化说明已经推到能推的极限（写入被别的东西抵消），再算也是同一个数
            if (previousResidual !== null
                && Math.abs(residual - previousResidual) < CONVERGE_EPSILON_PX) {
                finish({ outcome: 'not-converged', rounds, anchorTopAfter: settledTop, residual });
                return;
            }
            previousResidual = residual;
        }

        const settledTop = measureAnchorTop(scroller, anchor.index);
        finish({
            outcome: 'not-converged',
            rounds,
            anchorTopAfter: settledTop,
            residual,
        });
    } finally {
        useSubtitleScroll.getState().setHoldActive(false);
    }
};

/**
 * 订阅「侧栏译文」开关，切换时执行一次 hold 意图。
 *
 * 用 store 订阅而不是 `useEffect` + 渲染：只有订阅回调能保证快照落在 React 重渲染之前，
 * 拿到的才是真正的「切换前」布局。
 *
 * @param getScroller 取当前侧栏滚动容器；容器未挂载时返回 null。
 */
export function useSideTranslationHold(getScroller: () => HTMLElement | null): void {
    useEffect(() => {
        const unsubscribe = usePlayerUi.subscribe(
            (state) => state.showSideTranslation,
            () => {
                const scroller = getScroller();
                if (!scroller) {
                    return;
                }
                const before = captureBefore(scroller);
                if (!before) {
                    return;
                }
                void runHold(scroller, before).catch(() => {
                    // hold 只是尽力而为的体验修正，失败不应该影响播放与其它面板
                });
            },
        );
        return unsubscribe;
    }, [getScroller]);
}
