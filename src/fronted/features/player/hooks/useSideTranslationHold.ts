/**
 * 「侧栏译文」切换时保持阅读位置的 hold 意图。
 *
 * 老问题：切换译文后每一行的高度都变了，滚动位置却还是原来那个数字，
 * 于是正在读的那一行整体位移（实测 185 布局像素，滚得更深时上百到几百），用户得自己找回位置。
 * 以前在组件里散着写 scrollTop，会和 Virtuoso 的分批重测抢同一个位置，落点乱飞；
 * 现在的做法是：先等布局稳住，再用纯函数算目标，一轮一轮逼近，每轮重算残差（不累加 delta）。
 *
 * 分工（本文件只管「意图与策略」，DOM 测量在 sidebarAnchorProbe，换算在 scrollTarget）：
 * - 订阅 store 变更，在**同一个同步节拍**采切换前快照（`useEffect` 太晚会量到新行高，变化量变成 0）；
 * - 等布局稳定 → 读策略 → 逐轮逼近 → 记录结局（converged / not-converged / anchor-missing）；
 * - 与滚动状态机协作：hold 期间挂起自动跟随，避免两个写入方拉同一个 scrollTop。
 *
 * 硬约束：
 * - 锚点身份用 data index（虚拟列表会回收 DOM 节点，节点引用不可靠）；
 * - 只动用户正在读的那一行，不理会当前高亮句——这个意图的语义就是「别动用户的位置」；
 * - fail closed：拿不到锚点快照就一次都不滚，宁可不动也不能把用户顶到别处；
 * - 收敛不了就记 `not-converged`，不抛错、不阻塞界面。
 */
import { useEffect } from 'react';
import { usePlayerUi } from '@/fronted/features/player/playerUiStore';
import useSubtitleScroll from './useSubtitleScroll';
import { computeScrollTarget } from './scrollTarget';
import {
    beginHold,
    finishHold,
    recordScrollWrite,
    type HoldRecord,
} from '@/fronted/features/player/dev/scrollWriteLog';
import { readHoldPolicy } from '@/fronted/features/player/dev/playerDebug';
import {
    captureBefore,
    measureAnchorTop,
    waitForLayoutStable,
    waitFrames,
    type BeforeSnapshot,
} from './sidebarAnchorProbe';

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
        finish({ outcome: 'not-converged', rounds, anchorTopAfter: settledTop, residual });
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
