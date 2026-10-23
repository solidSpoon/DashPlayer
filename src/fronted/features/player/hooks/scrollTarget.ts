/**
 * 侧栏「保持阅读位置」的纯换算：根据布局变化前后的两份快照，算出该把滚动位置写到哪。
 *
 * 为什么单独抽成纯函数：这套换算以前写在组件里，一边读 DOM 一边改 scrollTop，
 * 与 Virtuoso 的分批重测抢同一个位置，实测落点从偏 36px 到偏 428px 都有。
 * 现在换算与写入彻底分离——纯函数只回答「目标是多少」，写不写、写几轮由调用方决定。
 *
 * 坐标约定（务必分清）：
 * - `top` 是**布局像素**，基准是滚动容器可视区顶边（不是视口、不是内容顶部）；
 * - `scrollTop` 也是布局像素（Chromium 下 `scrollTop` 与 `offsetTop` 同为单位）；
 * - `getBoundingClientRect()` 给的是**视觉像素**，容器被 CSS transform 缩放时必须先换算。
 */

/**
 * 锚点快照：靠 data index 标识一行字幕，而不是 DOM 节点（虚拟列表会回收节点）。
 *
 * `top` 为该行顶边到滚动容器可视区顶边的距离（布局像素，可为负）。
 */
export type AnchorSample = { index: number; top: number } | null;

/** 换算所需的两份快照：布局变化前 / 布局变化后。 */
export interface ScrollTargetInput {
    /** 变化前的快照：滚动位置与锚点行位置。 */
    before: { scrollTop: number; anchor: AnchorSample };
    /**
     * 变化后的快照：滚动位置与锚点行位置。
     * 换算基准永远是 `before.scrollTop`（每轮重算残差，禁止累加上一轮 delta），
     * 这里的位置只留给调用方记录与断言使用。
     */
    after: { scrollTop: number; anchor: AnchorSample };
}

/** 换算选项。 */
export interface ScrollTargetOptions {
    /** 单步允许的最大位移（布局像素），默认 400；用于把一次跳变拆成多轮小步。 */
    maxStepPx?: number;
}

/** 单步位移的默认上限（布局像素）。 */
export const DEFAULT_MAX_STEP_PX = 400;

/**
 * 计算「让锚点行保持原位置」所需的滚动位置。
 *
 * 判定与失败语义：
 * - 任一快照的锚点缺失，或两次锚点不是同一行（index 不同）→ 返回 null，
 *   调用方**不许滚**（fail closed）：锚不住就别乱动，宁可不调也不能把用户顶到别处；
 * - `maxStepPx` 夹住单步幅度，正负两侧都夹；
 * - 结果不会为负（滚动位置下限为 0）。
 *
 * @param input 变化前后的两份快照。
 * @param opts 换算选项。
 * @returns 目标滚动位置；无法锚定时返回 null。
 */
export function computeScrollTarget(
    input: ScrollTargetInput,
    opts?: ScrollTargetOptions,
): { scrollTop: number } | null {
    const { before, after } = input;
    const beforeAnchor = before.anchor;
    const afterAnchor = after.anchor;

    if (!beforeAnchor || !afterAnchor) {
        return null;
    }
    if (beforeAnchor.index !== afterAnchor.index) {
        return null;
    }
    if (!Number.isFinite(before.scrollTop)
        || !Number.isFinite(beforeAnchor.top)
        || !Number.isFinite(afterAnchor.top)) {
        return null;
    }

    const maxStepPx = opts?.maxStepPx ?? DEFAULT_MAX_STEP_PX;
    if (!Number.isFinite(maxStepPx) || maxStepPx <= 0) {
        return null;
    }

    // 行在布局像素坐标里向下移动了多少，滚动位置就要跟进多少，锚点才会停在原处
    const shiftPx = afterAnchor.top - beforeAnchor.top;
    const clampedShift = Math.max(-maxStepPx, Math.min(maxStepPx, shiftPx));

    return { scrollTop: Math.max(0, before.scrollTop + clampedShift) };
}
