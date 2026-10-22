/**
 * 播放器 dev/qa 可观测面：把滚动写入日志、滚动状态快照与最近一次「保持阅读位置」的记录
 * 挂到 `window.__dpDebug` 上，供自动化用例断言。
 *
 * 只在开发/未打包运行时暴露（判据是 main 进程下发的 `devMode`），生产构建里
 * `window.__dpDebug` 恒为 undefined，不会把内部状态泄漏给终端用户。
 *
 * 另外支持一个只由测试注入的策略开关 `window.__dpPolicy`：
 * - `a`（默认）：真正执行「保持阅读位置」补偿；
 * - `b`：对照策略，只采样不补偿，用来证明「补偿确实来自这套逻辑」而不是别的副作用。
 * 该开关不读环境变量、不落盘，只认 renderer 内存里的显式赋值，因此不会变成产品开关。
 */
import useSubtitleScroll from '@/fronted/features/player/hooks/useSubtitleScroll';
import {
    findPlayerSidebarScroller,
    getLastHold,
    getScrollWrites,
    type HoldRecord,
    type ScrollWriteEntry,
} from '@/fronted/features/player/dev/scrollWriteLog';
import { resolveDevMode } from '@/fronted/lib/devMode';

/** 「保持阅读位置」策略：a = 补偿（默认），b = 对照（不补偿）。 */
export type HoldPolicy = 'a' | 'b';

/** `window.__dpDebug.snapshot()` 的返回结构。 */
export interface PlayerDebugSnapshot {
    /** 侧栏滚动容器的 scrollTop（布局像素）；容器不在时为 0。 */
    scrollTop: number;
    /** 当前高亮句在字幕列表中的下标；未就绪为 -1。 */
    currentIndex: number;
    /** Virtuoso 当前渲染的列表范围 [start, end]。 */
    visibleRange: [number, number];
    /** 侧栏滚动容器的 scrollHeight（布局像素）；容器不在时为 0。 */
    contentHeight: number;
}

/** 挂到 window 上的调试面。 */
export interface PlayerDebugApi {
    /** 滚动写入环形缓冲（上限 200 条），按时间升序。 */
    scrollWrites: ScrollWriteEntry[];
    /** 采集一次滚动状态快照。 */
    snapshot: () => PlayerDebugSnapshot;
    /** 最近一次「保持阅读位置」的完整记录；还没发生过为 null。 */
    lastHold: () => HoldRecord | null;
}

declare global {
    interface Window {
        /** dev/qa 调试面；仅开发态存在。 */
        __dpDebug?: PlayerDebugApi;
        /** dev/qa 注入的策略开关；缺省按 'a' 处理。 */
        __dpPolicy?: HoldPolicy;
    }
}

/**
 * 读取当前生效的 hold 策略。
 *
 * @returns 'a'（补偿）或 'b'（对照）；非法值一律按默认 'a'。
 */
export function readHoldPolicy(): HoldPolicy {
    return window.__dpPolicy === 'b' ? 'b' : 'a';
}

/**
 * 采集一次滚动状态快照。
 *
 * @returns 滚动位置、当前句下标、渲染范围与内容高度。
 */
function snapshot(): PlayerDebugSnapshot {
    const scroller = findPlayerSidebarScroller();
    const internal = useSubtitleScroll.getState().internal;
    return {
        scrollTop: scroller?.scrollTop ?? 0,
        currentIndex: internal.currentListPosition,
        visibleRange: internal.visibleRange,
        contentHeight: scroller?.scrollHeight ?? 0,
    };
}

/** 是否已经挂载过，避免重复初始化覆盖掉测试持有的数组引用。 */
let installed = false;

/**
 * 在开发态挂载 `window.__dpDebug`。
 *
 * @returns 挂载完成（或判定为非开发态）后结束的 Promise。
 */
export function initPlayerDebug(): Promise<void> {
    return resolveDevMode().then((dev) => {
        if (!dev || installed) {
            return;
        }
        installed = true;
        window.__dpDebug = {
            // 恒为同一个数组引用：测试按下标切片即可只看到自己关心的那一段
            scrollWrites: getScrollWrites(),
            snapshot,
            lastHold: getLastHold,
        };
    });
}
