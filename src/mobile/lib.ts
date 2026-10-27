/** 手机页偏好存储键；按浏览器 origin 隔离，换端口后需要重新设置。 */
export const PREF_KEYS = {
    showEnglish: 'dashplayer.mobile.showEnglish',
    showTranslation: 'dashplayer.mobile.showTranslation',
    speed: 'dashplayer.mobile.speed',
} as const;

/** 直接打开播放页时，临时交给列表页的待跳转视频 ID。 */
export const PENDING_WATCH_KEY = 'dashplayer.mobile.pendingWatch';

/** 可选的播放倍速。 */
export const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5] as const;

/**
 * 按手机语言选择中英文文案。
 *
 * @param zh 中文文案。
 * @param en 英文文案。
 * @returns 当前语言下的文案。
 */
export const t = (zh: string, en: string): string => {
    const language = (navigator.language || '').toLowerCase();
    return language.startsWith('zh') ? zh : en;
};

/**
 * 读取布尔偏好。
 *
 * @param key localStorage 键。
 * @param fallback 没有存过时的默认值。
 * @returns 偏好值。
 */
export const loadBoolPref = (key: string, fallback: boolean): boolean => {
    try {
        const value = localStorage.getItem(key);
        if (value === null) {
            return fallback;
        }
        return value === '1';
    } catch {
        return fallback;
    }
};

/**
 * 读取倍速偏好。
 *
 * @returns 合法的播放倍速。
 */
export const loadSpeedPref = (): number => {
    try {
        const value = Number(localStorage.getItem(PREF_KEYS.speed));
        return (SPEED_OPTIONS as readonly number[]).includes(value) ? value : 1;
    } catch {
        return 1;
    }
};

/**
 * 写入偏好；localStorage 不可用时静默跳过。
 *
 * @param key 键。
 * @param value 值。
 */
export const savePref = (key: string, value: string): void => {
    try {
        localStorage.setItem(key, value);
    } catch {
        // 隐私模式或存储被禁用时只影响下次打开，不影响当前播放。
    }
};

/**
 * 补零到两位。
 *
 * @param value 数字。
 * @returns 两位字符串。
 */
const pad2 = (value: number): string => (value < 10 ? `0${value}` : String(value));

/**
 * 把秒数格式化为 m:ss 或 h:mm:ss。
 *
 * @param seconds 秒数。
 * @returns 时间文本。
 */
export const formatClock = (seconds: number): string => {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const rest = total % 60;
    if (hours > 0) {
        return `${hours}:${pad2(minutes)}:${pad2(rest)}`;
    }
    return `${minutes}:${pad2(rest)}`;
};

/**
 * 格式化一天内的时间。
 *
 * @param date 日期。
 * @returns HH:mm。
 */
const formatDayTime = (date: Date): string => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

/**
 * 把 ISO 时间转成「刚刚 / 今天 / 昨天 / N 天前」。
 *
 * @param iso ISO 8601 时间。
 * @returns 相对时间文案。
 */
export const formatRelative = (iso: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60 * 1000) {
        return t('刚刚', 'just now');
    }
    if (diff < 60 * 60 * 1000) {
        const minutes = Math.floor(diff / (60 * 1000));
        return t(`${minutes} 分钟前`, `${minutes} min ago`);
    }
    if (date.toDateString() === now.toDateString()) {
        return t(`今天 ${formatDayTime(date)}`, `Today ${formatDayTime(date)}`);
    }
    const yesterday = new Date(now.getTime());
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return t(`昨天 ${formatDayTime(date)}`, `Yesterday ${formatDayTime(date)}`);
    }
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        return t(`${days} 天前`, `${days}d ago`);
    }
    return t(
        `${date.getMonth() + 1} 月 ${date.getDate()} 日`,
        date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    );
};

/** 字幕行里的一个片段：普通文本或可点击单词。 */
export interface SubtitleToken {
    type: 'text' | 'word';
    value: string;
}

/**
 * 把英文句子拆成可点击的单词和普通文本。
 *
 * @param text 句子原文。
 * @returns 片段数组。
 */
export const tokenizeSubtitle = (text: string): SubtitleToken[] => {
    const pattern = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;
    const tokens: SubtitleToken[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
            tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
        }
        tokens.push({ type: 'word', value: match[0] });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
        tokens.push({ type: 'text', value: text.slice(lastIndex) });
    }
    return tokens;
};

/**
 * 触发一次很短的震动反馈；iOS 不支持时静默跳过。
 */
export const tapFeedback = (): void => {
    if (typeof navigator.vibrate === 'function') {
        try {
            navigator.vibrate(8);
        } catch {
            // 部分浏览器在无用户手势时会拒绝，忽略即可。
        }
    }
};
