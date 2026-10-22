/**
 * 侧栏滚动锚定回归用例：切换「侧栏译文」后，正在读的那一行必须留在原处。
 *
 * 背景（为什么这条用例值得存在）：切换译文会让每一行的高度变化，滚动位置却还是原来那个数字，
 * 内容整体位移几十到几百像素，用户得自己找回位置。修法是「hold 意图」——
 * 先等布局稳定，再用锚点算出目标 scrollTop，逐轮逼近。这条用例就是那套逻辑的门：
 *
 * - 策略 a（默认）：补偿生效，末轮残差 < 1 布局像素，且请求类滚动写入 ≤ 3 次；
 * - 策略 b（对照）：整套补偿被关掉，请求类滚动写入必须为 0（证明残差归零确实是这套逻辑干的）；
 * - 锚点行被虚拟列表回收时：守卫不成立（用例记为红），并且一次都不许滚（fail closed）。
 *
 * 策略由进程环境变量 `DP_POLICY` 决定（a / b），进页面后注入 renderer 的
 * `window.__dpPolicy`；应用侧只认这个内存开关，不读环境变量、不落盘，因此不会变成产品开关。
 *
 * 说明：所有结果先 `console.log` 一段 JSON 再断言——断言失败会吞掉后续日志，
 * 先打印才能拿到失败现场（首轮 scrollTop、内容高变化、残差、请求数、是否收敛）。
 */
import { expect, type Page } from '@playwright/test';
import { test } from './fixtures';
import path from 'node:path';

/** 夹具：36 句双语字幕 + 同目录同名视频（由 scripts/make-qa-fixtures.mjs 生成）。 */
const FIXTURE_VIDEO = path.join(__dirname, 'fixtures', 'media', 'qa-bilingual.mp4');

/** 本轮使用的策略：a = hold，b = 对照。 */
const POLICY: 'a' | 'b' = process.env.DP_POLICY === 'b' ? 'b' : 'a';

/** 侧栏滚动容器的稳定 testid。 */
const SCROLLER_TESTID = 'player-sidebar-scroller';

/** 字幕行的稳定 testid。 */
const SENTENCE_CARD_TESTID = 'sentence-card';

/** 侧栏译文开关的稳定 testid。 */
const SIDE_TRANSLATION_TESTID = 'side-translation-toggle';

/** 起点滚动位置：固定写出，保证每轮起点一致（这是规格的一部分）。 */
const START_SCROLL_TOP = 900;

/** 起点必须真的落后于 850，否则测的是列表顶部而不是中段滚动。 */
const MIN_START_SCROLL_TOP = 850;

/**
 * 「锚点行被回收」场景里甩到的深度。
 *
 * 切换后立刻把列表甩到这个位置，渲染窗口整体搬到列表深处，切换瞬间捕获的锚点行必然已被回收。
 * 之所以不靠「行高收缩把它挤出去」：收缩量取决于窗口尺寸与行高缓存的时序，
 * 在渲染窗口边缘只在 1 行上上下下，用例会变成偶发。
 */
const FLING_SCROLL_TOP = 2800;

/** 内容高度至少要变化这么多，才算「切换真的影响了行高」。 */
const MIN_CONTENT_HEIGHT_DELTA = 20;

/** 每轮次数。 */
const ROUNDS = 3;

/** 一次采样：滚动位置、内容高度、最上方可见行。 */
interface ScrollSample {
    scrollTop: number;
    contentHeight: number;
    /** 最上方可见行的 data index 与其到容器顶的距离（布局像素）；没有可见行为 null。 */
    anchor: { index: number; top: number } | null;
    /** 当前渲染出来的字幕行数量。 */
    renderedCards: number;
    /** 容器可视高度（布局像素）。 */
    clientHeight: number;
}

/** 一轮的观测结果（会整段打印成 JSON）。 */
interface RoundObservation {
    policy: 'a' | 'b';
    round: number;
    case: string;
    instrumentation: 'present' | 'absent';
    startScrollTop: number;
    contentHeightBefore: number;
    contentHeightAfter: number;
    contentHeightDelta: number;
    anchorIndex: number | null;
    anchorTopBefore: number | null;
    anchorTopAfter: number | null;
    anchorRendered: boolean;
    residual: number | null;
    requestCount: number | null;
    writeCount: number | null;
    appReportedHold: unknown;
    guardHolds: boolean;
    verdict: 'green' | 'red';
}

/**
 * 采样当前滚动状态（全部按布局像素，跨 CSS 缩放可用）。
 *
 * @param page 播放页。
 * @returns 采样结果。
 */
async function sampleScroll(page: Page): Promise<ScrollSample> {
    return page.evaluate(({ scrollerTestId, cardTestId }) => {
        const scroller = document.querySelector<HTMLElement>(`[data-testid="${scrollerTestId}"]`);
        if (!scroller) {
            throw new Error('侧栏滚动容器不存在');
        }
        const scrollerRect = scroller.getBoundingClientRect();
        // 容器可能被 CSS transform 缩放：视觉像素 / 布局像素的比例每次实测
        const scale = scroller.clientHeight > 0 ? scrollerRect.height / scroller.clientHeight : 1;
        const cards = Array.from(
            scroller.querySelectorAll<HTMLElement>(`[data-testid="${cardTestId}"][data-index]`),
        );
        let anchor: { index: number; top: number } | null = null;
        for (const card of cards) {
            const rect = card.getBoundingClientRect();
            const top = (rect.top - scrollerRect.top) / scale;
            const bottom = (rect.bottom - scrollerRect.top) / scale;
            if (bottom <= 0) {
                continue;
            }
            anchor = { index: Number(card.dataset.index), top };
            break;
        }
        return {
            scrollTop: scroller.scrollTop,
            contentHeight: scroller.scrollHeight,
            anchor,
            renderedCards: cards.length,
            clientHeight: scroller.clientHeight,
        };
    }, { scrollerTestId: SCROLLER_TESTID, cardTestId: SENTENCE_CARD_TESTID });
}

/**
 * 按 data index 测量某一字幕行当前到容器顶的距离（布局像素）。
 *
 * 用下标而不是「最上面那一行」：重排之后最上面的一行往往已经换人了。
 *
 * @param page 播放页。
 * @param index 行的 data index。
 * @returns 布局像素距离；该行未被渲染时为 null。
 */
async function measureCardTop(page: Page, index: number): Promise<number | null> {
    return page.evaluate(({ cardIndex, scrollerTestId, cardTestId }) => {
        const scroller = document.querySelector<HTMLElement>(`[data-testid="${scrollerTestId}"]`);
        const card = document.querySelector<HTMLElement>(
            `[data-testid="${cardTestId}"][data-index="${cardIndex}"]`,
        );
        if (!scroller || !card) {
            return null;
        }
        const scrollerRect = scroller.getBoundingClientRect();
        const scale = scroller.clientHeight > 0 ? scrollerRect.height / scroller.clientHeight : 1;
        return (card.getBoundingClientRect().top - scrollerRect.top) / scale;
    }, { cardIndex: index, scrollerTestId: SCROLLER_TESTID, cardTestId: SENTENCE_CARD_TESTID });
}

/**
 * 读出当前 scrollTop（布局像素）。
 *
 * @param page 播放页。
 * @returns scrollTop。
 */
async function readScrollTop(page: Page): Promise<number> {
    return page.evaluate((scrollerTestId) => {
        const scroller = document.querySelector<HTMLElement>(`[data-testid="${scrollerTestId}"]`);
        return scroller?.scrollTop ?? 0;
    }, SCROLLER_TESTID);
}

/**
 * 把滚动位置钉在指定值，并确认它真的钉住了。
 *
 * 为什么不能写完就走：应用自身在切句/重排后有一整套「钉在边界 → 停歇后平滑归顶」的编排，
 * 它的定时器可能在我们写入之后再把位置拉走，起点于是变成 0 附近的二值分布（用例会时灵时不灵）。
 * 这里反复写入直到连续两次读数都停在目标值上，起点才真正钉死。
 *
 * @param page 播放页。
 * @param target 目标 scrollTop（布局像素）。
 * @returns 钉住后的实际 scrollTop。
 */
async function pinScrollTop(page: Page, target: number): Promise<number> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
        await page.evaluate(({ scrollTop, scrollerTestId }) => {
            const scroller = document.querySelector<HTMLElement>(`[data-testid="${scrollerTestId}"]`);
            if (!scroller) {
                throw new Error('侧栏滚动容器不存在');
            }
            scroller.scrollTop = scrollTop;
        }, { scrollTop: target, scrollerTestId: SCROLLER_TESTID });
        await page.waitForTimeout(220);
        const first = await readScrollTop(page);
        if (Math.abs(first - target) > 2) {
            continue;
        }
        await page.waitForTimeout(180);
        const second = await readScrollTop(page);
        if (Math.abs(second - target) <= 2) {
            return second;
        }
    }
    return readScrollTop(page);
}

/**
 * 判断调试埋点是否可用。
 *
 * @param page 播放页。
 * @returns 存在 `__dpDebug` 时为 true。
 */
async function hasInstrumentation(page: Page): Promise<boolean> {
    return page.evaluate(() => Boolean((window as { __dpDebug?: unknown }).__dpDebug));
}

/**
 * 读取「侧栏译文」开关状态。
 *
 * 只认 `aria-pressed`：class 会随皮肤变化，语义不会。
 *
 * @param page 播放页。
 * @returns 开关是否处于开启态。
 */
async function readSideTranslation(page: Page): Promise<boolean> {
    const pressed = await page.locator(`[data-testid="${SIDE_TRANSLATION_TESTID}"]`).getAttribute('aria-pressed');
    return pressed === 'true';
}

/**
 * 把「侧栏译文」开关设到指定状态（已经在目标状态时不点）。
 *
 * @param page 播放页。
 * @param on 目标状态。
 * @returns 切换完成后结束（含等待 hold 落地）。
 */
async function setSideTranslation(page: Page, on: boolean): Promise<void> {
    if (await readSideTranslation(page) === on) {
        return;
    }
    const seqBefore = await page.evaluate(
        () => (window as { __dpDebug?: { lastHold: () => { seq: number } | null } }).__dpDebug?.lastHold()?.seq ?? 0,
    );
    await page.locator(`[data-testid="${SIDE_TRANSLATION_TESTID}"]`).click();
    await waitForHold(page, seqBefore, 8000).catch(() => undefined);
    // 让 Virtuoso 把重测后的行高落定，避免把上一轮的余波算进本轮
    await page.waitForTimeout(300);
}

/**
 * 等待一次 hold 结束。
 *
 * @param page 播放页。
 * @param seqBefore 点击前的 hold 序号。
 * @param timeout 超时时间（毫秒）。
 * @returns hold 记录。
 */
async function waitForHold(page: Page, seqBefore: number, timeout: number): Promise<unknown> {
    await page.waitForFunction(
        (minSeq) => {
            const debug = (window as {
                __dpDebug?: { lastHold: () => { seq: number; done: boolean } | null };
            }).__dpDebug;
            const hold = debug?.lastHold();
            return Boolean(hold && hold.seq > minSeq && hold.done);
        },
        seqBefore,
        { timeout },
    );
    return page.evaluate(
        () => (window as { __dpDebug?: { lastHold: () => unknown } }).__dpDebug?.lastHold() ?? null,
    );
}

/**
 * 读取从某个时间点之后产生的滚动写入。
 *
 * 用时间戳划界而不是下标：环形缓冲会从头裁掉旧条目，下标会漂。
 *
 * @param page 播放页。
 * @param fromTimestamp 起始时间戳（performance.now()）。
 * @returns 请求类与直接写类的条数。
 */
async function countScrollWrites(
    page: Page,
    fromTimestamp: number,
): Promise<{ requests: number; writes: number; entries: unknown[] }> {
    return page.evaluate((from) => {
        const debug = (window as {
            __dpDebug?: { scrollWrites: Array<{ t: number; kind: 'request' | 'write' }> };
        }).__dpDebug;
        if (!debug) {
            return { requests: 0, writes: 0, entries: [] };
        }
        const recent = debug.scrollWrites.filter((entry) => entry.t >= from);
        return {
            requests: recent.filter((entry) => entry.kind === 'request').length,
            writes: recent.filter((entry) => entry.kind === 'write').length,
            entries: recent,
        };
    }, fromTimestamp);
}

/**
 * 打开播放页（dev/qa 入口：`?file=` 直接入库并进播放页）。
 *
 * @param page 播放页。
 * @returns 打开并等到字幕行渲染出来后结束。
 */
async function openPlayer(page: Page): Promise<void> {
    // 策略开关只存在于 renderer 内存里（hold 在点击时才读它），进页面后再注入就够了
    await page.evaluate((policy) => {
        (window as { __dpPolicy?: string }).__dpPolicy = policy;
    }, POLICY);
    const hash = `#/player/qa?file=${encodeURIComponent(FIXTURE_VIDEO)}&seek=0&lang=zh`;
    await page.evaluate((target) => {
        window.location.hash = target;
    }, hash);
    await page.waitForFunction(
        ({ cardTestId, scrollerTestId }) =>
            document.querySelectorAll(`[data-testid="${cardTestId}"]`).length > 0
            && Boolean(document.querySelector(`[data-testid="${scrollerTestId}"]`)),
        { cardTestId: SENTENCE_CARD_TESTID, scrollerTestId: SCROLLER_TESTID },
        { timeout: 30_000 },
    );
    // 等调试面挂上（main 进程的 devMode 查询是一次异步 IPC）
    await page.waitForFunction(
        () => Boolean((window as { __dpDebug?: unknown }).__dpDebug),
        undefined,
        { timeout: 5000 },
    ).catch(() => undefined);
    // 等播放器真正就绪：字幕与当前句都稳定后再动滚动，避免把首屏自动定位当成被测行为
    await page.waitForTimeout(800);
}

/**
 * 执行一轮观测：钉死起点 → 采样 → 切换译文 → 等 hold → 再采样。
 *
 * @param page 播放页。
 * @param params 本轮参数。
 * @returns 本轮观测结果。
 */
async function runRound(
    page: Page,
    params: {
        round: number;
        case: string;
        startScrollTop: number;
        /** 切换前的译文开关状态。 */
        startTranslation: boolean;
        /**
         * 不为 null 时：把滚动位置甩到这个深度，并在**同一拍**里切换开关。
         * 用来构造「锚点行在测量时已经不在渲染范围内」的场景。
         */
        flingBeforeToggle: number | null;
    },
): Promise<RoundObservation> {
    await setSideTranslation(page, params.startTranslation);

    const instrumentation = (await hasInstrumentation(page)) ? 'present' : 'absent';

    // 起点钉死：规格的一部分，删掉这条用例会变成双峰（有时测到列表顶部，有时测到中段）
    await pinScrollTop(page, params.startScrollTop);

    const before = await sampleScroll(page);
    const writesMark = await page.evaluate(() => performance.now());
    const seqBefore = await page.evaluate(
        () => (window as { __dpDebug?: { lastHold: () => { seq: number } | null } }).__dpDebug?.lastHold()?.seq ?? 0,
    );

    if (params.flingBeforeToggle === null) {
        await page.locator(`[data-testid="${SIDE_TRANSLATION_TESTID}"]`).click();
    } else {
        // 同一拍内「先切换、再甩走」：切换瞬间应用捕获的是当前那批行，
        // 紧接着列表被甩到深处，等它去重测时锚点行已经被虚拟列表回收了
        await page.evaluate(({ top, scrollerTestId, toggleTestId }) => {
            const scroller = document.querySelector<HTMLElement>(`[data-testid="${scrollerTestId}"]`);
            const toggle = document.querySelector<HTMLElement>(`[data-testid="${toggleTestId}"]`);
            if (!scroller || !toggle) {
                throw new Error('侧栏滚动容器或译文开关不存在');
            }
            toggle.click();
            scroller.scrollTop = top;
        }, { top: params.flingBeforeToggle, scrollerTestId: SCROLLER_TESTID, toggleTestId: SIDE_TRANSLATION_TESTID });
    }

    let appReportedHold: unknown = null;
    if (instrumentation === 'present') {
        appReportedHold = await waitForHold(page, seqBefore, 10_000).catch(() => null);
    } else {
        // 没有埋点就退化成定时等待：布局变化 + 收敛窗口给足时间
        await page.waitForTimeout(1500);
    }
    await page.waitForTimeout(150);

    const after = await sampleScroll(page);
    const counts = instrumentation === 'present'
        ? await countScrollWrites(page, writesMark)
        : { requests: null, writes: null, entries: [] };

    // 锚点行是否还在渲染范围内、此刻在什么位置，都只按 data index 认
    const anchorTopAfter = before.anchor === null
        ? null
        : await measureCardTop(page, before.anchor.index);
    const anchorRendered = anchorTopAfter !== null;
    const residual = before.anchor !== null && anchorTopAfter !== null
        ? Math.abs(anchorTopAfter - before.anchor.top)
        : null;
    const contentHeightDelta = after.contentHeight - before.contentHeight;

    // 守卫：起点在中段、切换确实改变了行高、锚点行切换后仍被渲染
    const guardHolds = before.scrollTop > MIN_START_SCROLL_TOP
        && Math.abs(contentHeightDelta) > MIN_CONTENT_HEIGHT_DELTA
        && anchorRendered;

    return {
        policy: POLICY,
        round: params.round,
        case: params.case,
        instrumentation,
        startScrollTop: before.scrollTop,
        contentHeightBefore: before.contentHeight,
        contentHeightAfter: after.contentHeight,
        contentHeightDelta,
        anchorIndex: before.anchor?.index ?? null,
        anchorTopBefore: before.anchor?.top ?? null,
        anchorTopAfter,
        anchorRendered,
        residual,
        requestCount: counts.requests,
        writeCount: counts.writes,
        appReportedHold,
        guardHolds,
        verdict: guardHolds ? 'green' : 'red',
    };
}

test.describe('侧栏译文切换后的阅读位置保持', () => {
    test('切换译文后，正在读的那一行留在原处', async ({ session }) => {
        const { page } = session;
        await openPlayer(page);

        for (let round = 1; round <= ROUNDS; round += 1) {
            // 起始态：译文关闭（单行），切换后行变高 —— 锚点行仍在渲染范围内，hold 有办法补偿
            const observation = await runRound(page, {
                round,
                case: 'grow',
                startScrollTop: START_SCROLL_TOP,
                startTranslation: false,
                flingBeforeToggle: null,
            });
            console.log(`[player-scroll-anchor] ${JSON.stringify(observation)}`);

            // 守卫：先证明这一轮确实测到了「中段 + 行高变化 + 锚点仍渲染」
            expect(observation.startScrollTop, '起点必须落在列表中部').toBeGreaterThan(MIN_START_SCROLL_TOP);
            expect(Math.abs(observation.contentHeightDelta), '切换必须真的改变内容高度').toBeGreaterThan(MIN_CONTENT_HEIGHT_DELTA);
            expect(observation.anchorRendered, '锚点行在切换后仍应被渲染').toBe(true);

            if (observation.instrumentation === 'absent') {
                // 埋点缺失：只记录，不判红，也不对请求数下结论
                continue;
            }

            if (POLICY === 'a') {
                expect(observation.residual, '末轮残差应小于 1 布局像素').not.toBeNull();
                expect(Math.abs(observation.residual ?? Infinity)).toBeLessThan(1);
                expect(observation.requestCount ?? Infinity, 'hold 不应该反复请求滚动').toBeLessThanOrEqual(3);
            } else {
                // 对照策略：一次补偿都不许发生
                expect(observation.requestCount, '对照策略不允许出现请求类滚动').toBe(0);
                expect(observation.writeCount, '对照策略不允许直接写 scrollTop').toBe(0);
            }
        }
    });

    test('锚点行被虚拟列表回收时一次都不滚（守卫不成立）', async ({ session }) => {
        const { page } = session;
        await openPlayer(page);

        for (let round = 1; round <= ROUNDS; round += 1) {
            // 起始态：译文开启（双行）；切换后立刻把列表甩到深处，让刚捕获的锚点行被虚拟列表回收
            const observation = await runRound(page, {
                round,
                case: 'shrink-anchor-unmounted',
                startScrollTop: START_SCROLL_TOP,
                startTranslation: true,
                flingBeforeToggle: FLING_SCROLL_TOP,
            });
            console.log(`[player-scroll-anchor] ${JSON.stringify(observation)}`);

            // 守卫不成立：锚点行已被回收，本轮记为红（这是规格里的已知失败场景）
            expect(observation.verdict, '锚点行被回收时守卫不成立').toBe('red');
            expect(observation.anchorRendered, '锚点行应已不在渲染范围内').toBe(false);

            if (observation.instrumentation === 'absent') {
                continue;
            }
            // fail closed：锚不住就一次都不许滚（不论策略，请求与直接写都必须为 0）
            expect(observation.requestCount, '锚点缺失时不允许请求滚动').toBe(0);
            expect(observation.writeCount, '锚点缺失时不允许直接写 scrollTop').toBe(0);
            expect(observation.appReportedHold, '应用应把这一轮记成 anchor-missing').toMatchObject({
                outcome: 'anchor-missing',
            });
        }
    });
});
