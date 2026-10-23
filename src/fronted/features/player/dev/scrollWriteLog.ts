/**
 * 播放器滚动写入的埋点缓冲（dev/qa 专用）。
 *
 * 为什么需要它：侧栏的 scrollTop 有多个写入方——本仓库的「保持阅读位置」直接写 scrollTop，
 * Virtuoso 的 scrollToIndex / scrollBy 则是「应用发起、库内部写 scrollTop」。
 * 只看最终位置无法区分「谁写的、写了几次」，会让端到端断言彻底失明，
 * 所以这里把两类调用都记成同一种条目：`kind: 'request'`（请求）与 `kind: 'write'`（直接写）。
 *
 * dev 判定复用 `lib/devMode` 的缓存（不在这里重新问主进程），因此本模块可以被滚动实现直接引用，
 * 不会和 `playerDebug.ts` 形成循环依赖；生产构建里所有写入都只返回一次性对象、不入缓冲。
 */
import { isDevMode } from '@/fronted/lib/devMode';

/** 滚动写入的来源类型。 */
export type ScrollWriteKind =
    /** 应用发起的间接写入（Virtuoso scrollToIndex / scrollBy），落点由库决定 */
    | 'request'
    /** 应用直接写 scrollTop */
    | 'write';

/** 一条滚动写入记录。 */
export interface ScrollWriteEntry {
    /** 记录时间（performance.now()，毫秒）。 */
    t: number;
    /** 写入来源标识，便于定位是哪条代码路径。 */
    source: string;
    /** 写入前的 scrollTop（布局像素）。 */
    from: number;
    /**
     * 写入后的 scrollTop（布局像素）。
     * 直接写时是写入值；请求类写入无法预知落点，取请求后下一帧实测的位置做近似。
     */
    to: number;
    /** 写入类型。 */
    kind: ScrollWriteKind;
}

/** 「保持阅读位置」的执行结果。 */
export type HoldOutcome =
    /** 残差收敛到 1 布局像素以内 */
    | 'converged'
    /** 跑满轮次或残差不再变化，仍没到位（不抛错，只是记下来） */
    | 'not-converged'
    /** 锚点行不在渲染范围内（虚拟列表已回收），按 fail closed 拒绝滚动 */
    | 'anchor-missing'
    /** 找不到滚动容器 */
    | 'no-scroller'
    /** 对照策略：只测量、不补偿 */
    | 'no-compensation';

/** 一次「保持阅读位置」的完整记录。 */
export interface HoldRecord {
    /** 递增序号：测试用它区分前后两次切换。 */
    seq: number;
    /** 策略：a = hold（默认），b = 对照（不补偿）。 */
    policy: 'a' | 'b';
    /** 是否已经跑完（测试靠它判断可以读结果了）。 */
    done: boolean;
    /** 锚点行的 data index；采样失败为 null。 */
    anchorIndex: number | null;
    /** 变化前锚点行到容器顶的距离（布局像素）。 */
    anchorTopBefore: number | null;
    /** 最后一轮采样时锚点行到容器顶的距离（布局像素）。 */
    anchorTopAfter: number | null;
    /** 最后一轮残差（布局像素）；未采到为 null。 */
    residual: number | null;
    /** 实际执行的轮次。 */
    rounds: number;
    /** 是否收敛（残差 < 1 布局像素）。 */
    converged: boolean;
    /** 结束原因。 */
    outcome: HoldOutcome;
    /** 变化前的滚动位置（布局像素）。 */
    scrollTopBefore: number;
    /** 结束时的滚动位置（布局像素）。 */
    scrollTopAfter: number;
    /** 变化前的 scrollHeight（布局像素）。 */
    contentHeightBefore: number;
    /** 结束时的 scrollHeight（布局像素）。 */
    contentHeightAfter: number;
    /** 开始时间（performance.now()）。 */
    startedAt: number;
    /** 结束时间（performance.now()）。 */
    endedAt: number | null;
}

/** 环形缓冲上限：够看清一次点击的前后文，又不会无限增长。 */
const MAX_SCROLL_WRITES = 200;

/** 保留的 hold 记录条数上限。 */
const MAX_HOLD_RECORDS = 50;

/** 侧栏滚动容器的稳定 testid（与 Subtitle.tsx 上的挂载保持一致）。 */
export const PLAYER_SIDEBAR_SCROLLER_TESTID = 'player-sidebar-scroller';

/** 字幕行的稳定 testid。 */
export const SENTENCE_CARD_TESTID = 'sentence-card';

/** 滚动写入的环形缓冲；对外的引用恒为同一个数组，调用方可以按下标切片比较前后差异。 */
const scrollWrites: ScrollWriteEntry[] = [];

/** hold 记录（只保留最近若干条）。 */
const holdRecords: HoldRecord[] = [];

/** hold 序号。 */
let holdSeq = 0;

/**
 * 读取滚动写入缓冲（返回的是同一个数组引用）。
 *
 * @returns 滚动写入记录数组。
 */
export function getScrollWrites(): ScrollWriteEntry[] {
    return scrollWrites;
}

/**
 * 读取全部 hold 记录。
 *
 * @returns hold 记录数组。
 */
export function getHoldRecords(): HoldRecord[] {
    return holdRecords;
}

/**
 * 记录一条滚动写入。
 *
 * @param entry 写入条目（不含时间戳）。
 * @returns 写入到缓冲里的条目（请求类写入会在下一帧补写 `to`）。
 */
export function recordScrollWrite(entry: Omit<ScrollWriteEntry, 't'>): ScrollWriteEntry {
    const record: ScrollWriteEntry = { ...entry, t: performance.now() };
    if (!isDevMode()) {
        // 生产构建不记流水：一次性对象返回给调用方，不占内存也不暴露内部状态
        return record;
    }
    scrollWrites.push(record);
    if (scrollWrites.length > MAX_SCROLL_WRITES) {
        scrollWrites.splice(0, scrollWrites.length - MAX_SCROLL_WRITES);
    }
    return record;
}

/**
 * 查找侧栏滚动容器。
 *
 * @returns 滚动容器；不在播放页或尚未挂载时为 null。
 */
export function findPlayerSidebarScroller(): HTMLElement | null {
    return document.querySelector<HTMLElement>(`[data-testid="${PLAYER_SIDEBAR_SCROLLER_TESTID}"]`);
}

/**
 * 记录一次「应用发起但由库内部写 scrollTop」的请求（如 Virtuoso scrollToIndex）。
 *
 * 请求的落点不在调用方可控范围内，所以这里先记下当前 scrollTop，
 * 再在下一帧把实测位置补进 `to`——这样断言既能数清请求次数，也能看到实际效果。
 *
 * @param source 来源标识。
 */
export function recordScrollRequest(source: string): void {
    const scroller = findPlayerSidebarScroller();
    const from = scroller?.scrollTop ?? 0;
    const record = recordScrollWrite({ source, from, to: from, kind: 'request' });
    requestAnimationFrame(() => {
        const latest = findPlayerSidebarScroller();
        if (latest) {
            record.to = latest.scrollTop;
        }
    });
}

/**
 * 开始一次 hold 记录。
 *
 * @param params 策略与起始位置。
 * @returns 可继续补写的记录对象。
 */
export function beginHold(params: {
    policy: 'a' | 'b';
    anchorIndex: number | null;
    anchorTopBefore: number | null;
    scrollTopBefore: number;
    contentHeightBefore: number;
}): HoldRecord {
    holdSeq += 1;
    const record: HoldRecord = {
        seq: holdSeq,
        policy: params.policy,
        done: false,
        anchorIndex: params.anchorIndex,
        anchorTopBefore: params.anchorTopBefore,
        anchorTopAfter: null,
        residual: null,
        rounds: 0,
        converged: false,
        outcome: 'not-converged',
        scrollTopBefore: params.scrollTopBefore,
        scrollTopAfter: params.scrollTopBefore,
        contentHeightBefore: params.contentHeightBefore,
        contentHeightAfter: params.contentHeightBefore,
        startedAt: performance.now(),
        endedAt: null,
    };
    if (!isDevMode()) {
        return record;
    }
    holdRecords.push(record);
    if (holdRecords.length > MAX_HOLD_RECORDS) {
        holdRecords.splice(0, holdRecords.length - MAX_HOLD_RECORDS);
    }
    return record;
}

/**
 * 结束一次 hold 记录。
 *
 * @param record 待补写的记录。
 * @param result 结果字段。
 */
export function finishHold(record: HoldRecord, result: {
    outcome: HoldOutcome;
    rounds?: number;
    anchorTopAfter?: number | null;
    residual?: number | null;
    scrollTopAfter?: number;
    contentHeightAfter?: number;
}): void {
    record.done = true;
    record.endedAt = performance.now();
    record.outcome = result.outcome;
    if (result.rounds !== undefined) {
        record.rounds = result.rounds;
    }
    if (result.anchorTopAfter !== undefined) {
        record.anchorTopAfter = result.anchorTopAfter;
    }
    if (result.residual !== undefined) {
        record.residual = result.residual;
    }
    if (result.scrollTopAfter !== undefined) {
        record.scrollTopAfter = result.scrollTopAfter;
    }
    if (result.contentHeightAfter !== undefined) {
        record.contentHeightAfter = result.contentHeightAfter;
    }
    record.converged = record.outcome === 'converged';
}

/**
 * 读取最近一次 hold 记录。
 *
 * @returns 最近一次记录；还没发生过为 null。
 */
export function getLastHold(): HoldRecord | null {
    return holdRecords.length > 0 ? holdRecords[holdRecords.length - 1] : null;
}
