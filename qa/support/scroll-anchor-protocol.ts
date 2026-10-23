/**
 * 播放器滚动锚定用例的协议常量。
 *
 * 这些数字是**用例与产品之间的规格**，不是随便挑的魔数：
 * - 起点必须落在列表中部（> 850），否则测的是「列表顶部没什么可动」的平凡情形；
 * - 起点固定写 900 并确认钉住，是为了让每轮起点一致——不钉会变成双峰
 *   （实测 5 轮里出现两种结果：有时停在 900，有时被应用自己的「归顶编排」拉回 0 附近）；
 * - 甩动位置要深到让刚捕获的锚点行一定被虚拟列表回收。
 *
 * 数值集中在这里而不是散在 spec 里：QA 调整场景时只动这一个文件，看代码的人也能一眼看到规格。
 */

/** 起点滚动位置（布局像素）。 */
export const START_SCROLL_TOP = 900;

/** 起点必须真的超过这个值，否则守卫不成立（用例判红）。 */
export const MIN_START_SCROLL_TOP = 850;

/** 「锚点行被回收」场景里甩到的深度（布局像素）。 */
export const FLING_SCROLL_TOP = 2800;

/** 每轮次数量：同一场景连跑三次，用来暴露时序抖动。 */
export const ROUNDS = 3;

/** 内容高度至少要变化这么多（布局像素），才算「切换真的影响了行高」。 */
export const MIN_CONTENT_HEIGHT_DELTA = 20;

/** 收敛阈值（布局像素）：末轮残差小于它才算收敛。 */
export const CONVERGE_EPSILON_PX = 1;

/** 侧栏滚动容器的稳定 testid。 */
export const SCROLLER_TESTID = 'player-sidebar-scroller';

/** 字幕行的稳定 testid（行上带 data-index / data-current）。 */
export const SENTENCE_CARD_TESTID = 'sentence-card';

/** 「侧栏译文」开关的稳定 testid（状态只认 aria-pressed）。 */
export const SIDE_TRANSLATION_TESTID = 'side-translation-toggle';

/** 诊断日志前缀：机读出口（tools/check-player-scroll.mjs）按它切观测行。 */
export const OBSERVATION_PREFIX = '[player-scroll-anchor] ';
