import React from 'react';
import type { VirtuosoHandle } from 'react-virtuoso';
import type { MobileSubtitleLine, MobileWatchDetail } from '@/common/contracts/mobile-web';
import type { OpenAIDictionaryResult } from '@/common/types/DictionaryResult';
import { mobileApi } from './api';
import SubtitleTender from './subtitleTender';
import { type AppTheme, applyTheme, readTheme, saveTheme } from './theme';
import {
    PREF_KEYS,
    loadBoolPref,
    loadSpeedPref,
    savePref,
    t,
    tapFeedback,
} from './lib';

/** 顶部查词条的数据。 */
export interface DictionaryState {
    /** 查询词。 */
    word: string;
    /** 词典结果；加载中或失败时为 null。 */
    data: OpenAIDictionaryResult | null;
    /** 是否仍在查询。 */
    loading: boolean;
    /** 查询失败信息。 */
    error: string | null;
}

/** 播放页 hook 暴露给视图的状态和操作。 */
export interface WatchPlayerApi {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    virtuosoRef: React.RefObject<VirtuosoHandle | null>;
    handleScrollerRef: (ref: HTMLElement | Window | null) => void;
    dictRef: React.RefObject<HTMLDivElement | null>;
    currentIndex: number;
    currentLine: MobileSubtitleLine | null;
    currentTranslation: string;
    controlText: string;
    showEnglish: boolean;
    showTranslation: boolean;
    /** 列表滚离当前句时显示“回到当前”。 */
    showFollow: boolean;
    repeatOn: boolean;
    autoPauseOn: boolean;
    speed: number;
    theme: AppTheme;
    settingsOpen: boolean;
    dict: DictionaryState | null;
    videoError: boolean;
    openSettings: () => void;
    closeSettings: () => void;
    toggleEnglish: () => void;
    toggleTranslation: () => void;
    /** 滚回当前句并恢复跟随。 */
    followCurrent: () => void;
    toggleRepeat: () => void;
    toggleAutoPause: () => void;
    changeSpeed: (rate: number) => void;
    changeTheme: (theme: AppTheme) => void;
    seekLine: (index: number, play?: boolean) => void;
    stepLine: (delta: number) => void;
    replayCurrent: () => void;
    lookupWord: (word: string) => void;
    closeDict: () => void;
    handleScroll: () => void;
    handleLoadedMetadata: () => void;
    handleTimeUpdate: () => void;
    handleSeeking: () => void;
    handleSeeked: () => void;
    handlePause: () => void;
    handleEnded: () => void;
    handleError: () => void;
    handleLoadedData: () => void;
}

/** seek 期间暂停循环判定的时间窗口（毫秒）。 */
const LOOP_EPSILON = 0.1;

/** 跳句时提前多少秒起播，避免把第一个音切掉。 */
const SEEK_PREROLL = 0.2;

/**
 * 把播放页的播放、字幕、循环和查词逻辑收在一个 hook 里。
 *
 * @param detail 播放详情。
 * @returns 视图需要的 ref、状态和操作。
 */
export const useWatchPlayer = (detail: MobileWatchDetail): WatchPlayerApi => {
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const virtuosoRef = React.useRef<VirtuosoHandle | null>(null);
    const scrollerRef = React.useRef<HTMLElement | null>(null);
    const dictRef = React.useRef<HTMLDivElement | null>(null);
    const mountedRef = React.useRef(true);

    const [currentIndex, setCurrentIndex] = React.useState(-1);
    const currentIndexRef = React.useRef(-1);
    const browsingRef = React.useRef(false);
    const resumeVisibleTimerRef = React.useRef<number | null>(null);
    const autoScrollAtRef = React.useRef(0);

    const [showEnglish, setShowEnglish] = React.useState(() => loadBoolPref(PREF_KEYS.showEnglish, true));
    const [showTranslation, setShowTranslation] = React.useState(() => loadBoolPref(PREF_KEYS.showTranslation, true));
    const [showFollow, setShowFollow] = React.useState(false);
    const showTranslationRef = React.useRef(showTranslation);
    const [translations, setTranslations] = React.useState<Record<number, string>>({});
    const translationsRef = React.useRef<Record<number, string>>({});
    const attemptedTranslationsRef = React.useRef<Set<number>>(new Set());
    const translationCoveredUntilRef = React.useRef(-1);

    const [repeatOn, setRepeatOn] = React.useState(false);
    const repeatOnRef = React.useRef(false);
    const repeatStartRef = React.useRef<number | null>(null);
    const repeatEndRef = React.useRef<number | null>(null);

    const [autoPauseOn, setAutoPauseOn] = React.useState(false);
    const autoPauseOnRef = React.useRef(false);
    const autoPauseArmedRef = React.useRef(true);

    const [speed, setSpeed] = React.useState(() => loadSpeedPref());
    const speedRef = React.useRef(speed);
    const [theme, setTheme] = React.useState<AppTheme>(() => readTheme());

    const [settingsOpen, setSettingsOpen] = React.useState(false);
    const [videoError, setVideoError] = React.useState(false);

    const resumeDoneRef = React.useRef(detail.currentPosition <= 3);
    const resumeTimerRef = React.useRef<number | null>(null);
    const seekInFlightRef = React.useRef(false);
    /** 程序化跳句的目标；预卷期间当前句先停在这里，不要退回上一句。 */
    const seekTargetIndexRef = React.useRef<number | null>(null);
    const programmaticSeekRef = React.useRef(false);
    const lastSavedRef = React.useRef(-1);

    const dictCacheRef = React.useRef(new Map<string, OpenAIDictionaryResult | null>());
    const activeWordRef = React.useRef<string | null>(null);
    const dictRequestIdRef = React.useRef(0);
    const dictTimerRef = React.useRef<number | null>(null);
    const [dict, setDict] = React.useState<DictionaryState | null>(null);

    /** 与桌面端同思路的字幕时间轴索引：时间桶 + 上次命中缓存 + nextStart 覆盖空隙。 */
    const tender = React.useMemo(() => new SubtitleTender(detail.subtitles), [detail.subtitles]);

    React.useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    React.useEffect(() => {
        savePref(PREF_KEYS.showEnglish, showEnglish ? '1' : '0');
    }, [showEnglish]);

    React.useEffect(() => {
        savePref(PREF_KEYS.showTranslation, showTranslation ? '1' : '0');
        showTranslationRef.current = showTranslation;
    }, [showTranslation]);

    React.useEffect(() => {
        speedRef.current = speed;
        if (videoRef.current) {
            videoRef.current.playbackRate = speed;
        }
    }, [speed]);

    /**
     * 写回当前播放位置。
     *
     * @param force 是否忽略 5 秒间隔立即写入。
     */
    const saveProgress = React.useCallback((force: boolean): void => {
        const video = videoRef.current;
        if (!video || !resumeDoneRef.current) {
            return;
        }
        const second = Math.max(0, Math.floor(video.currentTime || 0));
        if (!force && lastSavedRef.current >= 0 && Math.abs(second - lastSavedRef.current) < 5) {
            return;
        }
        lastSavedRef.current = second;
        void mobileApi.saveProgress(detail.id, second, force).catch(() => undefined);
    }, [detail.id]);

    /**
     * 判断某行字幕是否完整落在可视区内。
     *
     * @param index 字幕下标。
     * @returns 整行可见时为 true。
     */
    /** Virtuoso 的滚动容器引用；它的实际 DOM 类型是 HTMLElement。 */
    const handleScrollerRef = React.useCallback((ref: HTMLElement | Window | null): void => {
        scrollerRef.current = ref instanceof HTMLElement ? ref : null;
    }, []);

    /**
     * 判断某行字幕是否完整落在可视区内。
     *
     * Virtuoso 只渲染视口附近的行，查不到 DOM 时按不可见处理。
     *
     * @param index 字幕下标。
     * @returns 整行可见时为 true。
     */
    const isRowVisible = React.useCallback((index: number): boolean => {
        const list = scrollerRef.current;
        const row = list?.querySelector<HTMLElement>(`.line[data-index="${index}"]`);
        if (!list || !row) {
            return false;
        }
        const listRect = list.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        return rowRect.top >= listRect.top + 8 && rowRect.bottom <= listRect.bottom - 8;
    }, []);

    /**
     * 只在当前句快离开可视区时滚动列表。
     *
     * @param index 字幕下标。
     */
    const ensureRowVisible = React.useCallback((index: number): void => {
        if (isRowVisible(index)) {
            return;
        }
        const list = scrollerRef.current;
        const row = list?.querySelector<HTMLElement>(`.line[data-index="${index}"]`);
        const align = row && list && row.getBoundingClientRect().top < list.getBoundingClientRect().top
            ? 'start'
            : 'center';
        autoScrollAtRef.current = performance.now();
        virtuosoRef.current?.scrollIntoView({ index, align, behavior: 'auto' });
        // 滚动完成后再看一眼当前行是否真的回到视口，避免程序化滚动期间的 scroll 事件
        // 把“回到当前”按钮错误地留在屏幕上。
        window.setTimeout(() => {
            const current = currentIndexRef.current;
            if (current < 0) {
                setShowFollow(false);
                return;
            }
            setShowFollow(browsingRef.current && !isRowVisible(current));
        }, 250);
    }, [isRowVisible]);

    /**
     * 用户浏览后，当前句重新进入可视区时延迟恢复跟随。
     */
    const scheduleResumeIfVisible = React.useCallback((): void => {
        if (!browsingRef.current || currentIndexRef.current < 0
            || resumeVisibleTimerRef.current !== null) {
            return;
        }
        if (!isRowVisible(currentIndexRef.current)) {
            return;
        }
        resumeVisibleTimerRef.current = window.setTimeout(() => {
            resumeVisibleTimerRef.current = null;
            if (browsingRef.current && isRowVisible(currentIndexRef.current)) {
                browsingRef.current = false;
                setShowFollow(false);
            }
        }, 150);
    }, [isRowVisible]);

    /**
     * 为当前句附近的一小段字幕请求翻译。
     *
     * 只翻字幕文件里没有中文的行；同一窗口请求过就不再重复请求，翻译服务不可用时
     * 保持空白，避免播放过程中反复打模型。
     *
     * @param index 当前字幕下标。
     */
    const requestTranslationWindow = React.useCallback((index: number): void => {
        if (!showTranslationRef.current) {
            return;
        }
        const lines = detail.subtitles;
        if (lines.length === 0) {
            return;
        }
        // 已经有一批翻译排在前面时不逐句追加请求；等播放接近批次末尾再整批补。
        if (index < translationCoveredUntilRef.current - 5) {
            return;
        }
        const start = Math.max(0, index - 2);
        const end = Math.min(lines.length, start + 20);
        translationCoveredUntilRef.current = Math.max(translationCoveredUntilRef.current, end);
        const indexes: number[] = [];
        const texts: string[] = [];
        for (let i = start; i < end; i += 1) {
            const line = lines[i];
            if (line.zh !== '' || line.en.trim() === '') {
                continue;
            }
            if (attemptedTranslationsRef.current.has(i)) {
                continue;
            }
            if ((translationsRef.current[i] ?? '') !== '') {
                continue;
            }
            attemptedTranslationsRef.current.add(i);
            indexes.push(i);
            texts.push(line.en);
        }
        if (texts.length === 0) {
            return;
        }
        mobileApi.translateTexts(texts)
            .then((result) => {
                if (!mountedRef.current) {
                    return;
                }
                const next = { ...translationsRef.current };
                indexes.forEach((lineIndex, position) => {
                    next[lineIndex] = result[position] ?? '';
                });
                translationsRef.current = next;
                setTranslations(next);
            })
            .catch(() => {
                // 没有配置翻译服务时保持空白，已请求过的行不反复重试。
            });
    }, [detail.subtitles]);

    /**
     * 应用当前字幕下标，并更新高亮、循环区间和列表位置。
     *
     * @param index 字幕下标。
     */
    const applyIndex = React.useCallback((index: number): void => {
        if (index !== currentIndexRef.current) {
            currentIndexRef.current = index;
            setCurrentIndex(index);
            autoPauseArmedRef.current = true;
            if (index >= 0) {
                requestTranslationWindow(index);
            }
        }

        const line = index >= 0 ? detail.subtitles[index] : null;
        repeatStartRef.current = repeatOnRef.current && line ? line.start : null;
        repeatEndRef.current = repeatOnRef.current && line ? line.end : null;

        if (index < 0) {
            return;
        }
        if (browsingRef.current) {
            setShowFollow(!isRowVisible(index));
            scheduleResumeIfVisible();
            return;
        }
        setShowFollow(false);
        ensureRowVisible(index);
    }, [detail.subtitles, ensureRowVisible, scheduleResumeIfVisible, requestTranslationWindow, isRowVisible]);

    /**
     * 计算时间点对应的当前句。
     *
     * 跳句会提前 0.2 秒起播，这段时间实际时间还落在上一句尾部；用 seekTargetIndexRef
     * 把当前句固定在目标上，等时间真正越过目标句开头后再交还给时间轴索引。
     *
     * @param time 播放时间，单位秒。
     * @returns 当前字幕下标。
     */
    const resolveCurrentIndex = React.useCallback((time: number): number => {
        const target = seekTargetIndexRef.current;
        if (target !== null) {
            const targetLine = detail.subtitles[target];
            if (targetLine && time < targetLine.start) {
                return target;
            }
            seekTargetIndexRef.current = null;
        }
        return tender.getIndexByTime(time);
    }, [detail.subtitles, tender]);

    /** 处理视频时间更新。 */
    const handleTimeUpdate = React.useCallback((): void => {
        const video = videoRef.current;
        if (!video || !resumeDoneRef.current) {
            return;
        }

        const line = currentIndexRef.current >= 0 ? detail.subtitles[currentIndexRef.current] : null;
        if (repeatOnRef.current && !seekInFlightRef.current && repeatEndRef.current !== null
            && video.currentTime >= repeatEndRef.current - LOOP_EPSILON) {
            const target = currentIndexRef.current;
            programmaticSeekRef.current = true;
            seekTargetIndexRef.current = target >= 0 ? target : null;
            try {
                video.currentTime = Math.max(0, (repeatStartRef.current ?? 0) - SEEK_PREROLL);
            } catch {
                programmaticSeekRef.current = false;
                seekTargetIndexRef.current = null;
                return;
            }
            return;
        }

        if (autoPauseOnRef.current && autoPauseArmedRef.current && line
            && video.currentTime >= line.end - LOOP_EPSILON) {
            autoPauseArmedRef.current = false;
            video.pause();
            return;
        }

        applyIndex(resolveCurrentIndex(video.currentTime));
        saveProgress(false);
    }, [detail.subtitles, applyIndex, saveProgress, resolveCurrentIndex]);

    /** 原生进度条开始 seek 时暂停循环/自动暂停判定。 */
    const handleSeeking = React.useCallback((): void => {
        if (!programmaticSeekRef.current) {
            seekTargetIndexRef.current = null;
        }
        seekInFlightRef.current = true;
        autoPauseArmedRef.current = false;
    }, []);

    /** seek 结束后按新位置重新计算当前句。 */
    const handleSeeked = React.useCallback((): void => {
        if (!resumeDoneRef.current) {
            resumeDoneRef.current = true;
            if (resumeTimerRef.current !== null) {
                window.clearTimeout(resumeTimerRef.current);
                resumeTimerRef.current = null;
            }
        }
        seekInFlightRef.current = false;
        programmaticSeekRef.current = false;
        autoPauseArmedRef.current = true;
        const video = videoRef.current;
        if (video) {
            applyIndex(resolveCurrentIndex(video.currentTime));
        }
    }, [applyIndex, resolveCurrentIndex]);

    /** 处理元数据加载，按上次位置续播。 */
    const handleLoadedMetadata = React.useCallback((): void => {
        const video = videoRef.current;
        if (!video) {
            return;
        }
        video.playbackRate = speedRef.current;

        if (!resumeDoneRef.current) {
            const duration = Number.isFinite(video.duration) ? video.duration : 0;
            const target = duration > 5
                ? Math.min(detail.currentPosition, duration - 2)
                : detail.currentPosition;
            try {
                video.currentTime = Math.max(0, target);
            } catch {
                resumeDoneRef.current = true;
            }
            if (!resumeDoneRef.current) {
                resumeTimerRef.current = window.setTimeout(() => {
                    resumeDoneRef.current = true;
                    const current = videoRef.current;
                    if (current) {
                        applyIndex(resolveCurrentIndex(current.currentTime));
                    }
                }, 1500);
            }
        }

        if (resumeDoneRef.current) {
            applyIndex(resolveCurrentIndex(video.currentTime));
        }
    }, [detail.currentPosition, applyIndex, resolveCurrentIndex]);

    /** 暂停时立即写回进度。 */
    const handlePause = React.useCallback((): void => {
        saveProgress(true);
    }, [saveProgress]);

    /** 播放结束时写回进度。 */
    const handleEnded = React.useCallback((): void => {
        saveProgress(true);
    }, [saveProgress]);

    /** 视频错误时显示格式提示。 */
    const handleError = React.useCallback((): void => {
        if (videoRef.current?.error?.code === 1) {
            return;
        }
        setVideoError(true);
    }, []);

    /** 视频有画面后收起错误提示。 */
    const handleLoadedData = React.useCallback((): void => {
        setVideoError(false);
    }, []);

    /** 用户在字幕列表滚动。 */
    const handleScroll = React.useCallback((): void => {
        if (performance.now() - autoScrollAtRef.current < 150) {
            return;
        }
        browsingRef.current = true;
        setShowFollow(currentIndexRef.current >= 0 && !isRowVisible(currentIndexRef.current));
        scheduleResumeIfVisible();
    }, [isRowVisible, scheduleResumeIfVisible]);

    /**
     * 滚回当前句并恢复跟随。
     */
    const followCurrent = React.useCallback((): void => {
        const index = currentIndexRef.current;
        if (index < 0) {
            return;
        }
        browsingRef.current = false;
        setShowFollow(false);
        if (resumeVisibleTimerRef.current !== null) {
            window.clearTimeout(resumeVisibleTimerRef.current);
            resumeVisibleTimerRef.current = null;
        }
        ensureRowVisible(index);
        tapFeedback();
    }, [ensureRowVisible]);

    /**
     * 关闭查词条并清理定时器。
     */
    const closeDict = React.useCallback((): void => {
        if (dictTimerRef.current !== null) {
            window.clearTimeout(dictTimerRef.current);
            dictTimerRef.current = null;
        }
        activeWordRef.current = null;
        setDict(null);
    }, []);

    /**
     * 安排查词条自动收起。
     *
     * @param delay 延迟毫秒数。
     */
    const scheduleDictHide = React.useCallback((delay: number): void => {
        if (dictTimerRef.current !== null) {
            window.clearTimeout(dictTimerRef.current);
        }
        dictTimerRef.current = window.setTimeout(() => {
            dictTimerRef.current = null;
            activeWordRef.current = null;
            setDict(null);
        }, delay);
    }, []);

    /**
     * 查询单词并更新顶部查词条。
     *
     * @param raw 点击到的单词原文。
     */
    const lookupWord = React.useCallback((raw: string): void => {
        const word = raw.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
        if (word === '') {
            return;
        }
        const key = word.toLowerCase();
        activeWordRef.current = key;

        const cached = dictCacheRef.current.get(key);
        if (cached !== undefined) {
            setDict({ word, data: cached, loading: false, error: null });
            scheduleDictHide(9000);
            return;
        }

        setDict({ word, data: null, loading: true, error: null });
        if (dictTimerRef.current !== null) {
            window.clearTimeout(dictTimerRef.current);
            dictTimerRef.current = null;
        }
        const requestId = ++dictRequestIdRef.current;
        mobileApi.lookupWord(word)
            .then((result) => {
                if (!mountedRef.current) {
                    return;
                }
                dictCacheRef.current.set(key, result);
                if (activeWordRef.current === key && dictRequestIdRef.current === requestId) {
                    setDict({ word, data: result, loading: false, error: null });
                    scheduleDictHide(9000);
                }
            })
            .catch((reason: unknown) => {
                if (!mountedRef.current) {
                    return;
                }
                if (activeWordRef.current === key && dictRequestIdRef.current === requestId) {
                    setDict({
                        word,
                        data: null,
                        loading: false,
                        error: reason instanceof Error ? reason.message : String(reason),
                    });
                    scheduleDictHide(12000);
                }
            });
    }, [scheduleDictHide]);

    /**
     * 跳到指定字幕行。
     *
     * @param index 目标字幕下标。
     * @param play 跳转后是否继续播放。
     */
    const seekLine = React.useCallback((index: number, play = true): void => {
        const video = videoRef.current;
        const line = detail.subtitles[index];
        if (!video || !line) {
            return;
        }
        programmaticSeekRef.current = true;
        seekTargetIndexRef.current = index;
        try {
            video.currentTime = Math.max(0, line.start - SEEK_PREROLL);
        } catch {
            programmaticSeekRef.current = false;
            seekTargetIndexRef.current = null;
            return;
        }
        browsingRef.current = false;
        setShowFollow(false);
        if (resumeVisibleTimerRef.current !== null) {
            window.clearTimeout(resumeVisibleTimerRef.current);
            resumeVisibleTimerRef.current = null;
        }
        closeDict();
        applyIndex(index);
        if (play) {
            void video.play().catch(() => undefined);
        }
        tapFeedback();
    }, [detail.subtitles, applyIndex, closeDict]);

    /**
     * 按句前后跳。
     *
     * @param delta -1 表示上一句，1 表示下一句。
     */
    const stepLine = React.useCallback((delta: number): void => {
        if (detail.subtitles.length === 0) {
            return;
        }
        const base = currentIndexRef.current >= 0
            ? currentIndexRef.current
            : tender.getIndexByTime(videoRef.current?.currentTime ?? 0);
        const target = Math.max(0, Math.min(detail.subtitles.length - 1, (base < 0 ? -1 : base) + delta));
        seekLine(target, true);
    }, [detail.subtitles, seekLine, tender]);

    /** 重播当前句。 */
    const replayCurrent = React.useCallback((): void => {
        if (detail.subtitles.length === 0) {
            return;
        }
        const base = currentIndexRef.current >= 0
            ? currentIndexRef.current
            : tender.getIndexByTime(videoRef.current?.currentTime ?? 0);
        seekLine(base < 0 ? 0 : base, true);
    }, [detail.subtitles, seekLine, tender]);

    /** 打开播放设置。 */
    const openSettings = React.useCallback((): void => setSettingsOpen(true), []);
    /** 关闭播放设置。 */
    const closeSettings = React.useCallback((): void => setSettingsOpen(false), []);

    /** 切换英文字幕轨道。 */
    const toggleEnglish = React.useCallback((): void => {
        setShowEnglish((value) => !value);
    }, []);

    /** 切换翻译显示；重新打开时立即补当前窗口的翻译。 */
    const toggleTranslation = React.useCallback((): void => {
        const next = !showTranslationRef.current;
        showTranslationRef.current = next;
        setShowTranslation(next);
        if (next) {
            requestTranslationWindow(currentIndexRef.current >= 0 ? currentIndexRef.current : 0);
        }
    }, [requestTranslationWindow]);

    /** 开关循环当前句。 */
    const toggleRepeat = React.useCallback((): void => {
        const next = !repeatOnRef.current;
        repeatOnRef.current = next;
        setRepeatOn(next);
        const line = currentIndexRef.current >= 0 ? detail.subtitles[currentIndexRef.current] : null;
        repeatStartRef.current = next && line ? line.start : null;
        repeatEndRef.current = next && line ? line.end : null;
    }, [detail.subtitles]);

    /** 开关每句自动暂停。 */
    const toggleAutoPause = React.useCallback((): void => {
        const next = !autoPauseOnRef.current;
        autoPauseOnRef.current = next;
        setAutoPauseOn(next);
        autoPauseArmedRef.current = true;
    }, []);

    /**
     * 修改播放倍速。
     *
     * @param rate 目标倍速。
     */
    const changeSpeed = React.useCallback((rate: number): void => {
        speedRef.current = rate;
        setSpeed(rate);
        savePref(PREF_KEYS.speed, String(rate));
    }, []);

    /**
     * 切换浅色 / 深色主题。
     *
     * @param next 目标主题。
     */
    const changeTheme = React.useCallback((next: AppTheme): void => {
        setTheme(next);
        applyTheme(next);
        saveTheme(next);
    }, []);

    React.useEffect(() => {
        if (!dict) {
            return;
        }
        const handler = (event: PointerEvent): void => {
            if (!(event.target instanceof Node) || dictRef.current?.contains(event.target)) {
                return;
            }
            if (event.target instanceof Element && event.target.closest('.word')) {
                return;
            }
            closeDict();
        };
        document.addEventListener('pointerdown', handler, true);
        return () => document.removeEventListener('pointerdown', handler, true);
    }, [dict, closeDict]);

    React.useEffect(() => {
        const onPageHide = (): void => saveProgress(true);
        const onVisibilityChange = (): void => {
            if (document.visibilityState === 'hidden') {
                saveProgress(true);
            }
        };
        window.addEventListener('pagehide', onPageHide);
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            window.removeEventListener('pagehide', onPageHide);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [saveProgress]);

    React.useEffect(() => {
        // 进入播放页时把 video 节点固定下来：cleanup 里不再读可能已经变化的 ref。
        const video = videoRef.current;
        return () => {
            saveProgress(true);
            if (video) {
                try {
                    video.pause();
                } catch {
                    // 忽略暂停失败。
                }
                video.removeAttribute('src');
                try {
                    video.load();
                } catch {
                    // 元素可能已经脱离文档。
                }
            }
            if (resumeTimerRef.current !== null) {
                window.clearTimeout(resumeTimerRef.current);
            }
            if (resumeVisibleTimerRef.current !== null) {
                window.clearTimeout(resumeVisibleTimerRef.current);
            }
            if (dictTimerRef.current !== null) {
                window.clearTimeout(dictTimerRef.current);
            }
        };
    }, [saveProgress]);

    const currentLine = currentIndex >= 0 ? detail.subtitles[currentIndex] : detail.subtitles[0] ?? null;
    const currentTranslation = currentLine
        ? (currentLine.zh || translations[currentIndex >= 0 ? currentIndex : 0] || '')
        : '';
    const controlText = detail.subtitles.length === 0
        ? t('没有字幕', 'No subtitles')
        : (showEnglish && currentLine?.en
            ? currentLine.en
            : showTranslation && currentTranslation
                ? currentTranslation
                : '—');

    return {
        videoRef,
        virtuosoRef,
        handleScrollerRef,
        dictRef,
        currentIndex,
        currentLine,
        currentTranslation,
        controlText,
        showEnglish,
        showTranslation,
        showFollow,
        repeatOn,
        autoPauseOn,
        speed,
        theme,
        settingsOpen,
        dict,
        videoError,
        openSettings,
        closeSettings,
        toggleEnglish,
        toggleTranslation,
        followCurrent,
        toggleRepeat,
        toggleAutoPause,
        changeSpeed,
        changeTheme,
        seekLine,
        stepLine,
        replayCurrent,
        lookupWord,
        closeDict,
        handleScroll,
        handleLoadedMetadata,
        handleTimeUpdate,
        handleSeeking,
        handleSeeked,
        handlePause,
        handleEnded,
        handleError,
        handleLoadedData,
    };
};
