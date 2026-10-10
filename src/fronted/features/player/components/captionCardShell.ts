/**
 * 主字幕区右下角与学习界面右下角共用的卡片外壳样式。
 *
 * 同一排的卡片（当前句操作胶囊、配音录音卡片）必须完全同形：高度、内边距、圆角、
 * 底色与毛玻璃只在这里定义一份。各卡片的状态色（试听中、录音中、处理中）
 * 在 cn() 里追加覆盖即可，tailwind-merge 会以追加的那份为准。
 *
 * 内边距刻意取 3px（不是常见的左右大、上下小）：卡片高 = 图标格 24 + 3×2 = 30，
 * 端帽半径 15，按钮半径 12，按钮圆心正好落在端帽圆心上，两者同心，四周留出的环
 * 处处等宽。按钮之间用 2 倍环宽（6px），整排的留白节奏才一致。
 * 改图标格尺寸时必须同步改这里，否则同心关系会被破坏。
 *
 * 刻意不加边框与阴影：叠在视频上时描边和投影会让卡片显得厚重，改由半透明底色区分。
 */
export const CAPTION_CARD_CLASS =
    'inline-flex items-center gap-1.5 p-[3px] rounded-full bg-stone-200/70 dark:bg-neutral-700/70 backdrop-blur-sm';

/**
 * 卡片悬浮区在画面右下角的锚点：离右边框与下边框等距，视觉上才不偏。
 * 播放画面的卡片区与学习界面的单独胶囊必须共用这一份，否则切换视图时
 * 开关按钮会跳位。
 */
export const CAPTION_CARD_ANCHOR_CLASS = 'absolute right-3 bottom-3';

/**
 * 卡片内图标格：24px 见方，卡片里所有图标（按钮或纯展示）都占这一格。
 *
 * 同一排的图标大小与落点因此完全一致：录音中的状态点与秒数、保存后接替它们的
 * 播放键与波形都落在同一位置，切换时不跳。卡片外壳的内边距由这一尺寸反推
 * （见 CAPTION_CARD_CLASS），两者必须一起改。
 */
export const CAPTION_ICON_SLOT_CLASS = 'w-6 h-6 shrink-0 flex items-center justify-center';

/**
 * 卡片内图标按钮：在图标格基础上补一个正圆悬停底，使悬停反馈也是同样的圆。
 * 常态用 CAPTION_CARD_IDLE_CLASS，已生效用 captionCardActiveClass()。
 */
export const CAPTION_CARD_BUTTON_CLASS = `${CAPTION_ICON_SLOT_CLASS} rounded-full transition-colors`;

/**
 * 卡片内图标按钮的常态外观：灰阶文字 + 悬停浅底。
 * 胶囊里的按钮共用这一份，避免各写一份后慢慢漂移。
 */
export const CAPTION_CARD_IDLE_CLASS =
    'text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-300/60 dark:hover:bg-neutral-600/60';

/** 卡片内按钮「已生效」的色相：琥珀=收藏/微调，翠绿=整句学习，红=录音中。 */
export type CaptionCardAccent = 'amber' | 'emerald' | 'red';

const ACCENT_ACTIVE_CLASS: Record<CaptionCardAccent, string> = {
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60',
    red: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/60',
};

/**
 * 卡片内图标按钮「已生效」的统一外观：同一份淡底色与文字色浓度，只换色相；
 * 刻意不描边、不投影（与卡片本身一致，靠底色区分深浅）。
 * 收藏、微调、整句学习、录音中四个状态因此形状完全一致，只有颜色不同。
 *
 * @param accent 语义色相
 */
export const captionCardActiveClass = (accent: CaptionCardAccent): string =>
    ACCENT_ACTIVE_CLASS[accent];
