import { describe, it, expect } from 'vitest';
import { computeScrollTarget } from '../scrollTarget';

/**
 * 构造一份快照。
 *
 * @param scrollTop 滚动位置（布局像素）。
 * @param anchor 锚点快照；null 表示该次采样里锚点行没被渲染。
 */
const snapshot = (scrollTop: number, anchor: { index: number; top: number } | null) => ({
    scrollTop,
    anchor,
});

describe('布局变化后的滚动目标换算', () => {
    it('行在布局里下移多少，滚动位置就跟进多少，让锚点停在原处', () => {
        // 译文打开后每行变高：锚点行从距容器顶 100px 变成 260px
        const target = computeScrollTarget({
            before: snapshot(900, { index: 12, top: 100 }),
            after: snapshot(900, { index: 12, top: 260 }),
        });
        expect(target).toEqual({ scrollTop: 1060 });
    });

    it('行在布局里上移时反向回滚，位置不会被推到负数以下', () => {
        // 译文关闭后行变矮：锚点行从 100px 变成 -40px
        expect(computeScrollTarget({
            before: snapshot(900, { index: 12, top: 100 }),
            after: snapshot(900, { index: 12, top: -40 }),
        })).toEqual({ scrollTop: 760 });

        // 本来就在顶部附近时，回滚量被 0 挡住
        expect(computeScrollTarget({
            before: snapshot(30, { index: 1, top: 10 }),
            after: snapshot(30, { index: 1, top: -50 }),
        })).toEqual({ scrollTop: 0 });
    });

    it('变化后的锚点行没被渲染时拒绝滚动', () => {
        expect(computeScrollTarget({
            before: snapshot(900, { index: 12, top: 100 }),
            after: snapshot(900, null),
        })).toBeNull();
    });

    it('变化前的锚点行就缺失时同样拒绝滚动', () => {
        expect(computeScrollTarget({
            before: snapshot(900, null),
            after: snapshot(900, { index: 12, top: 260 }),
        })).toBeNull();
    });

    it('两次锚点不是同一行时拒绝滚动', () => {
        expect(computeScrollTarget({
            before: snapshot(900, { index: 12, top: 100 }),
            after: snapshot(900, { index: 13, top: 260 }),
        })).toBeNull();
    });

    it('单步位移被 maxStepPx 双向夹住', () => {
        expect(computeScrollTarget({
            before: snapshot(900, { index: 12, top: 100 }),
            after: snapshot(900, { index: 12, top: 900 }),
        }, { maxStepPx: 240 })).toEqual({ scrollTop: 1140 });

        expect(computeScrollTarget({
            before: snapshot(900, { index: 12, top: 100 }),
            after: snapshot(900, { index: 12, top: -900 }),
        }, { maxStepPx: 240 })).toEqual({ scrollTop: 660 });
    });

    it('锚点没动时目标就是原位置，不会产生多余的写入', () => {
        expect(computeScrollTarget({
            before: snapshot(900, { index: 12, top: 100 }),
            after: snapshot(920, { index: 12, top: 100 }),
        })).toEqual({ scrollTop: 900 });
    });
});
