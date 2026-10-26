import React from 'react';
import type { MobileSubtitleLine } from '@/common/contracts/mobile-web';
import { tapFeedback, tokenizeSubtitle } from './lib';

interface MainSubtitleProps {
    /** 当前播放句；没有字幕时为 null。 */
    line: MobileSubtitleLine | null;
    /** 当前句译文；没有时为空字符串。 */
    translation: string;
    /** 是否显示英文。 */
    showEnglish: boolean;
    /** 是否显示译文。 */
    showTranslation: boolean;
    /** 点击单词查词。 */
    onWord: (word: string) => void;
    /** 长按主字幕区打开播放设置。 */
    onLongPress: () => void;
}

/** 长按多久打开设置。 */
const LONG_PRESS_MS = 550;

/**
 * 主字幕区。
 *
 * 当前句放大并居中显示，只有这里的英文单词可以点按查词；长按空白或文字
 * 打开播放设置。下方列表是纯英文的跳转按钮，不参与查词。
 */
const MainSubtitle = React.memo(({
    line,
    translation,
    showEnglish,
    showTranslation,
    onWord,
    onLongPress,
}: MainSubtitleProps) => {
    const tokens = React.useMemo(() => (line ? tokenizeSubtitle(line.en) : []), [line]);
    const english = showEnglish && line ? line.en : '';
    const translated = showTranslation ? translation : '';

    const longPressTimerRef = React.useRef<number | null>(null);
    const suppressTimerRef = React.useRef<number | null>(null);
    const startRef = React.useRef<{ x: number; y: number } | null>(null);
    const longPressReadyRef = React.useRef(false);
    const suppressClickRef = React.useRef(false);

    /**
     * 清掉长按计时器。
     */
    const clearLongPressTimer = React.useCallback((): void => {
        if (longPressTimerRef.current !== null) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    }, []);

    React.useEffect(() => {
        return () => {
            clearLongPressTimer();
            if (suppressTimerRef.current !== null) {
                window.clearTimeout(suppressTimerRef.current);
            }
        };
    }, [clearLongPressTimer]);

    /**
     * 按下后开始计时；移动超过 10px 视为滚动，取消长按。
     *
     * @param event 指针事件。
     */
    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
        if (event.pointerType === 'mouse' && event.button !== 0) {
            return;
        }
        clearLongPressTimer();
        longPressReadyRef.current = false;
        startRef.current = { x: event.clientX, y: event.clientY };
        longPressTimerRef.current = window.setTimeout(() => {
            longPressReadyRef.current = true;
            tapFeedback();
        }, LONG_PRESS_MS);
    };

    /**
     * 跟随指针移动，超过阈值就取消长按。
     *
     * @param event 指针事件。
     */
    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
        const start = startRef.current;
        if (!start) {
            return;
        }
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) {
            clearLongPressTimer();
            longPressReadyRef.current = false;
            startRef.current = null;
        }
    };

    /**
     * 松开时如果长按已经成立，打开设置。
     *
     * 设置面板在松开后的下一个任务里再打开，避免这次抬手的 click 落到面板背景上
     * 把面板立刻关掉；同时用 suppressClickRef 吞掉单词的 click，避免连带查词。
     */
    const handlePointerUp = (): void => {
        clearLongPressTimer();
        startRef.current = null;
        if (!longPressReadyRef.current) {
            return;
        }
        longPressReadyRef.current = false;
        suppressClickRef.current = true;
        if (suppressTimerRef.current !== null) {
            window.clearTimeout(suppressTimerRef.current);
        }
        suppressTimerRef.current = window.setTimeout(() => {
            suppressClickRef.current = false;
        }, 500);
        window.setTimeout(() => onLongPress(), 0);
    };

    /**
     * 取消长按。
     */
    const cancelLongPress = (): void => {
        clearLongPressTimer();
        longPressReadyRef.current = false;
        startRef.current = null;
    };

    /**
     * 吞掉长按抬手后合成的那次 click。
     *
     * @param event 鼠标事件。
     */
    const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>): void => {
        if (!suppressClickRef.current) {
            return;
        }
        suppressClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
    };

    return (
        <div
            className="main-sub"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={cancelLongPress}
            onPointerLeave={cancelLongPress}
            onClickCapture={handleClickCapture}
            onContextMenu={(event) => event.preventDefault()}
        >
            {english !== '' && (
                <div className="main-sub-en">
                    {tokens.map((token, tokenIndex) => (
                        token.type === 'word' ? (
                            <button
                                // 字幕内容在一次播放里不变，用下标做 key 即可。
                                key={tokenIndex}
                                type="button"
                                className="word"
                                onClick={() => onWord(token.value)}
                            >
                                {token.value}
                            </button>
                        ) : (
                            <React.Fragment key={tokenIndex}>{token.value}</React.Fragment>
                        )
                    ))}
                </div>
            )}
            {translated !== '' && <div className="main-sub-zh">{translated}</div>}
        </div>
    );
});

MainSubtitle.displayName = 'MainSubtitle';

export default MainSubtitle;
