import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { shallow } from 'zustand/shallow';
import { twJoin } from 'tailwind-merge';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import SideSentence from '../SideSentence';
import { usePlayerState } from '@/fronted/features/player/playerState';
import { usePlayerUi } from '@/fronted/features/player/playerUiStore';
import { isSidebarHiddenByEnglish } from '@/fronted/features/player/components/sidePanelVisibility';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import useLayout from '@/fronted/hooks/useLayout';
import { cn } from '@/fronted/lib/utils';
import useSubtitleScroll, { useSubtitleScrollState } from '@/fronted/features/player/hooks/useSubtitleScroll';
import useBoundary from '@/fronted/features/player/hooks/useBoundary';
import useChatPanel from '@/fronted/features/chat/chatStore';
import { Sentence } from '@/common/types/SentenceC';

export default function Subtitle() {
    const showSideBar = useLayout((state) => state.showSideBar);
    const showEn = usePlayerUi((state) => state.showEn);
    const syncSide = usePlayerUi((state) => state.syncSide);
    const showSideTranslation = usePlayerUi((state) => state.showSideTranslation);
    const changeShowSideTranslation = usePlayerUi((state) => state.changeShowSideTranslation);
    const { t } = useI18nTranslation('player');
    // 「随英文字幕隐藏」把侧栏收起时，卡片文案是 opacity-0，chip 是这块空白唯一的解释
    const sidebarHiddenByEnglish = isSidebarHiddenByEnglish(syncSide, showEn);
    const { currentSentence, subtitle, singleRepeat, hoverRepeat, virtualGroup } = usePlayerState((s) => ({
        currentSentence: s.currentSentence,
        subtitle: s.sentences,
        singleRepeat: s.singleRepeat,
        hoverRepeat: s.hoverRepeat,
        virtualGroup: s.virtualGroup,
    }), shallow);
    const { setBoundaryRef } = useBoundary();

    const scrollerRef = useRef<HTMLElement | Window | null>(null);
    /** 卸载当前滚动容器上用户输入监听的函数；容器（重）挂载时先卸载旧监听 */
    const detachUserInputRef = useRef<(() => void) | null>(null);

    const {
        scrollState,
        onScrolling,
        updateCurrentRef,
        setVirtuoso,
        updateVisibleRange,
        delaySetNormal,
        syncIntoView,
    } = useSubtitleScrollState((s) => ({
        scrollState: s.scrollState,
        onScrolling: s.onScrolling,
        updateCurrentRef: s.updateCurrentRef,
        setVirtuoso: s.setVirtuoso,
        updateVisibleRange: s.updateVisibleRange,
        delaySetNormal: s.delaySetNormal,
        syncIntoView: s.syncIntoView,
    }), shallow);

    const currentListPosition = useMemo(() => {
        if (!currentSentence || subtitle.length === 0) {
            return -1;
        }
        return subtitle.findIndex(
            (item) => item.index === currentSentence.index && item.fileHash === currentSentence.fileHash
        );
    }, [currentSentence, subtitle]);

    useEffect(() => {
        if (currentListPosition < 0) {
            return;
        }
        syncIntoView(currentListPosition);
    }, [currentListPosition, syncIntoView]);

    /**
     * 切换时的世代号：每次 toggle 递增。一次切换只触发自己那串定位，
     * 旧世代的 pending 回调直接作废（连续切换以最后一次为准）。
     */
    const sideTranslationToggleGenerationRef = useRef(0);
    /**
     * 用户自己动了滚动的标记：切换瞬间及其后几帧内收到滚轮/拖拽/翻页就置位，
     * 本次切换不再重新定位（目标用户自己的位置）。只认输入事件，不去比 scrollTop，
     * 省得把自己写进去的滚动当成用户操作。
     */
    const sideTranslationUserScrollRef = useRef(false);

    /**
     * 上一次渲染时的「侧栏译文」开关值；用于区分「用户刚切了开关」与「首次挂载/其他重渲染」。
     */
    const prevShowSideTranslationRef = useRef(showSideTranslation);
    useEffect(() => {
        if (prevShowSideTranslationRef.current === showSideTranslation) {
            return;
        }
        prevShowSideTranslationRef.current = showSideTranslation;
        const generation = sideTranslationToggleGenerationRef.current + 1;
        sideTranslationToggleGenerationRef.current = generation;
        sideTranslationUserScrollRef.current = false;

        /** 目标落点：当前句放到视野从上往下约 1/3 处（不看 ±center，不受列表尾部剩余内容影响） */
        const TARGET_RATIO = 0.33;
        /** 可接受落点带：视野 20%–45%（向外各让 5 个百分点作为不重写阈值） */
        const RATIO_MIN = 0.15;
        const RATIO_MAX = 0.5;

        const store = useSubtitleScroll.getState();
        // 程序定位后的几帧里，跟随先让位：否则它会又把位置拉回默认锚点（实测被抢回 180px）
        store.beginFollowQuietWindow();

        let frameId = 0;
        let attempts = 0;
        /** 第一次写完之后（隔一帧）读到的 scrollTop：用来识别中间有没有别人插手 */
        let ownScrollTop = 0;

        /**
         * 量当前句在可视边界内的相对位置（0 = 边界顶，1 = 边界底）。
         *
         * @returns 相对位置；量不到（节点未渲染/边界未就绪）时返回 null。
         */
        const measureRatio = (): number | null => {
            const { internal, boundary } = useSubtitleScroll.getState();
            const ref = internal.currentRef;
            if (!boundary || !ref) {
                return null;
            }
            const height = boundary.yb - boundary.yt;
            if (height <= 0) {
                return null;
            }
            return (ref.getBoundingClientRect().top - boundary.yt) / height;
        };

        /**
         * 现在能不能重新定位：世代没变、用户没自己滚、且当前句仍在可视边界内。
         * 当前句已被滚出视野说明用户翻到了别处，此时一个字都不改。
         */
        const canRecenter = (): boolean => {
            if (generation !== sideTranslationToggleGenerationRef.current) {
                return false;
            }
            if (sideTranslationUserScrollRef.current) {
                return false;
            }
            const { internal, boundary } = useSubtitleScroll.getState();
            const ref = internal.currentRef;
            if (!boundary || !ref) {
                return false;
            }
            const rect = ref.getBoundingClientRect();
            return rect.bottom > boundary.yt && rect.top < boundary.yb;
        };

        /**
         * 写一次定位：align 'start' + 负偏移，把当前句钉在视野从上往下 1/3 处。
         * 不自己算 delta、不写 scrollTop；靠头/尾被夹紧也只在 Virtuoso 内部处理。
         */
        const writeLocate = () => {
            const state = useSubtitleScroll.getState();
            const { internal } = state;
            const target = scrollerRef.current;
            if (!internal.virtuoso || !(target instanceof HTMLElement) || internal.currentListPosition < 0) {
                return false;
            }
            attempts += 1;
            // 这次 scroll 是程序写入的：登记一次，onScroll 读掉后不做用户滚动判定
            state.skipNextScrollJudgement();
            internal.virtuoso.scrollToIndex({
                index: internal.currentListPosition,
                align: 'start',
                offset: -Math.round(target.clientHeight * TARGET_RATIO),
                behavior: 'auto',
            });
            return true;
        };

        /**
         * 等指定帧数后执行；逐帧递归，保证中间真的过了几帧（Virtuoso 的重测也在 rAF 里）。
         *
         * @param frames 还要等几帧（从 1 起算）。
         * @param run 最后一帧要执行的动作。
         */
        const afterFrames = (frames: number, run: () => void) => {
            const step = (left: number) => {
                frameId = requestAnimationFrame(() => {
                    if (left <= 1) {
                        run();
                    } else {
                        step(left - 1);
                    }
                });
            };
            step(frames);
        };

        // 两帧：等 React 重排 + Virtuoso 按新行高重测完，再算落点
        afterFrames(2, () => {
            if (!canRecenter() || !writeLocate()) {
                return;
            }
            // 隔一帧再把落地值记下来（Virtuoso 可能晚一拍才真正写进去），作为后面判断「有没有别人插手」的基准
            afterFrames(1, () => {
                const target = scrollerRef.current;
                ownScrollTop = target instanceof HTMLElement ? target.scrollTop : 0;
                // 再隔一帧确认落点：Virtuoso 分批重测会把位置再推走，偏出目标带就再定位一次
                afterFrames(1, () => {
                    if (!canRecenter() || attempts >= 2) {
                        return;
                    }
                    const scroller = scrollerRef.current;
                    // 中间 scrollTop 自己走了（用户或别的写入方），说明位置已不在我们手上，不去擦
                    if (!(scroller instanceof HTMLElement) || Math.abs(scroller.scrollTop - ownScrollTop) > 8) {
                        return;
                    }
                    const ratio = measureRatio();
                    if (ratio === null || (ratio >= RATIO_MIN && ratio <= RATIO_MAX)) {
                        return;
                    }
                    writeLocate();
                });
            });
        });

        return () => cancelAnimationFrame(frameId);
    }, [showSideTranslation]);

    useEffect(() => {
        return () => {
            detachUserInputRef.current?.();
            detachUserInputRef.current = null;
        };
    }, []);
    const dragStateRef = useRef<{
        active: boolean;
        startListPosition: number | null;
        lastListPosition: number | null;
        sentence: Sentence | null;
    }>({
        active: false,
        startListPosition: null,
        lastListPosition: null,
        sentence: null,
    });

    const selectionRangeRef = useRef<{ startPos: number; endPos: number } | null>(null);

    const virtualGroupMeta = useMemo(() => {
        if (!virtualGroup.active || virtualGroup.sentences.length < 2) {
            return {
                hasGroup: false,
                keyGroupSet: new Set<string>(),
                firstKey: null as string | null,
                lastKey: null as string | null,
            };
        }

        const keyGroupSet = new Set(virtualGroup.sentences.map((s) => `${s.fileHash}-${s.index}`));
        const first = virtualGroup.sentences[0];
        const last = virtualGroup.sentences[virtualGroup.sentences.length - 1];
        return {
            hasGroup: true,
            keyGroupSet,
            firstKey: first ? `${first.fileHash}-${first.index}` : null,
            lastKey: last ? `${last.fileHash}-${last.index}` : null,
        };
    }, [virtualGroup]);

    const applySelectionRange = useCallback((startPos: number, endPos: number) => {
        const normalizedStart = Math.min(startPos, endPos);
        const normalizedEnd = Math.max(startPos, endPos);

        if (selectionRangeRef.current &&
            selectionRangeRef.current.startPos === normalizedStart &&
            selectionRangeRef.current.endPos === normalizedEnd) {
            return;
        }

        if (normalizedEnd !== normalizedStart) {
            selectionRangeRef.current = { startPos: normalizedStart, endPos: normalizedEnd };
            const selectedSentences = subtitle.slice(normalizedStart, normalizedEnd + 1);
            playerActions.setVirtualGroupBySentences(selectedSentences);
        } else {
            selectionRangeRef.current = null;
            playerActions.clearVirtualGroup();
        }
    }, [subtitle]);

    const finalizeSelection = useCallback(() => {
        const state = dragStateRef.current;
        if (!state.active) {
            return;
        }

        state.active = false;
        const { startListPosition, lastListPosition, sentence } = state;

        if (
            startListPosition !== null &&
            lastListPosition !== null &&
            Math.abs(lastListPosition - startListPosition) >= 1
        ) {
            applySelectionRange(startListPosition, lastListPosition);
        } else if (sentence) {
            playerActions.clearVirtualGroup();
            // 学习页打开期间点击字幕视为正常跳转：先关闭学习页，再按常规跳转到该句
            if (useChatPanel.getState().learningVisible) {
                useChatPanel.getState().hideLearning();
            }
            playerActions.gotoSentence(sentence);
            if (scrollState === 'USER_BROWSING') {
                delaySetNormal();
            }
        }

        selectionRangeRef.current = null;
        dragStateRef.current = {
            active: false,
            startListPosition: null,
            lastListPosition: null,
            sentence: null,
        };
    }, [applySelectionRange, delaySetNormal, scrollState]);

    useEffect(() => {
        window.addEventListener('mouseup', finalizeSelection);
        return () => {
            window.removeEventListener('mouseup', finalizeSelection);
        };
    }, [finalizeSelection]);

    const handleMouseDown = useCallback((sentence: Sentence, listPosition: number) => (event: React.MouseEvent) => {
        event.preventDefault();
        dragStateRef.current = {
            active: true,
            startListPosition: listPosition,
            lastListPosition: listPosition,
            sentence,
        };
        selectionRangeRef.current = null;
    }, []);

    const handleMouseEnter = useCallback((_sentence: Sentence, listPosition: number) => () => {
        const state = dragStateRef.current;
        if (!state.active || state.startListPosition === null) {
            return;
        }

        state.lastListPosition = listPosition;
        applySelectionRange(state.startListPosition, listPosition);
    }, [applySelectionRange]);

    const handleMouseUp = useCallback(() => {
        finalizeSelection();
    }, [finalizeSelection]);

    /**
     * Virtuoso 滚动容器（重）挂载时挂载/卸载用户输入监听。
     * 滚轮、滚动条拖拽、翻页键发生在自动滚动（AUTO_SCROLLING）期间时立即中断跟读，
     * 避免平滑动画与用户输入争夺滚动位置；其他状态下 onUserInterrupt 自身为空操作。
     */
    const handleScrollerRef = useCallback((ref: unknown) => {
        detachUserInputRef.current?.();
        detachUserInputRef.current = null;
        const scroller = ref as HTMLElement | null;
        scrollerRef.current = scroller;
        if (!scroller) {
            return;
        }
        const interruptAutoScroll = () => {
            useSubtitleScroll.getState().onUserInterrupt();
        };
        /**
         * 用户主动滚动的信号：置位后本次「侧栏译文」切换不再重新定位。
         * 只认输入事件（滚轮/按下列表或滚动条/翻页键），不去比 scrollTop——
         * 自己写进去的程序滚动量不出来，比数值容易把自己当成用户。
         */
        const markUserScroll = () => {
            sideTranslationUserScrollRef.current = true;
        };
        const handleWheel = () => {
            markUserScroll();
            interruptAutoScroll();
        };
        const handlePointerDown = (e: PointerEvent) => {
            // 按下列表或滚动条都算用户接管了位置（点击字幕行也会跳句，同样不该被拉回）
            markUserScroll();
            // 事件 target 为滚动容器本身说明按下的是滚动条区域，而非字幕行
            if (e.target === scroller) {
                interruptAutoScroll();
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                markUserScroll();
                interruptAutoScroll();
            }
        };
        scroller.addEventListener('wheel', handleWheel, { passive: true });
        scroller.addEventListener('pointerdown', handlePointerDown);
        scroller.addEventListener('keydown', handleKeyDown);
        detachUserInputRef.current = () => {
            scroller.removeEventListener('wheel', handleWheel);
            scroller.removeEventListener('pointerdown', handlePointerDown);
            scroller.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const handleRangeChanged = useCallback(({ startIndex, endIndex }: { startIndex: number; endIndex: number }) => {
        updateVisibleRange([startIndex, endIndex]);
    }, [updateVisibleRange]);

    const renderItem = useCallback((listPosition: number, item: Sentence) => {
        const isCurrent = !!currentSentence && item.index === currentSentence.index && item.fileHash === currentSentence.fileHash;
        const itemKey = `${item.fileHash}-${item.index}`;
        const isSelected =
            virtualGroupMeta.hasGroup &&
            virtualGroupMeta.keyGroupSet.has(itemKey);
        const isGroupStart = isSelected && itemKey === virtualGroupMeta.firstKey;
        const isGroupEnd = isSelected && itemKey === virtualGroupMeta.lastKey;
        return (
            // 拖拽选区容器：鼠标按下/进入/抬起用于区间选择，不承担点击交互
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions
            <div
                onMouseDown={handleMouseDown(item, listPosition)}
                onMouseEnter={handleMouseEnter(item, listPosition)}
                onMouseUp={handleMouseUp}
            >
                <SideSentence
                    sentence={item}
                    onClick={() => {
                        // handled via drag finalize logic
                    }}
                    isCurrent={isCurrent}
                    isRepeat={singleRepeat || hoverRepeat}
                    selectionState={
                        isSelected
                            ? {
                                isMember: true,
                                isGroupStart,
                                isGroupEnd,
                            }
                            : undefined
                    }
                    ref={(ref) => {
                        if (isCurrent) {
                            updateCurrentRef(ref, listPosition);
                        }
                    }}
                />
            </div>
        );
    }, [
        currentSentence,
        handleMouseDown,
        handleMouseEnter,
        handleMouseUp,
        singleRepeat,
        hoverRepeat,
        updateCurrentRef,
        virtualGroupMeta,
    ]);

    const render = () => {
        return (
            <div className="w-full h-full relative" ref={setBoundaryRef}>
                <Virtuoso
                    onScroll={onScrolling}
                    scrollerRef={handleScrollerRef}
                    increaseViewportBy={200}
                    minOverscanItemCount={{ top: 3, bottom: 6 }}
                    defaultItemHeight={55}
                    ref={setVirtuoso}
                    className={twJoin(
                        'h-full w-full overflow-y-auto text-stone-600 dark:text-neutral-200 py-2',
                        'scrollbar-thin scrollbar-thumb-rounded-full',
                        'scrollbar-thumb-stone-300/60 dark:scrollbar-thumb-neutral-700/60 hover:scrollbar-thumb-stone-400 dark:hover:scrollbar-thumb-neutral-500',
                        showSideBar && 'scrollbar-none'
                    )}
                    data={subtitle}
                    rangeChanged={handleRangeChanged}
                    itemContent={renderItem}
                    components={{
                        Footer: () => <div className="h-52" />,
                        Header: () => <div className={cn('h-0.5')} />,
                    }}
                />

                {/* 侧栏译文被关掉后就地提示并给回开按钮。
                    放在 Virtuoso 之外（absolute，不设 Header/Footer）：既不占列表行高，
                    也不会随句子卡片一起淡出——侧栏被收起时它必须还在，否则用户看不出发生了什么。 */}
                {!showSideTranslation && (
                    <div className="absolute right-2 top-2 z-10 pointer-events-none">
                        <button
                            type="button"
                            onClick={() => changeShowSideTranslation()}
                            title={sidebarHiddenByEnglish ? t('controlBox.sidebarHiddenNow') : undefined}
                            className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-muted/80 px-2 py-0.5 text-[10px] leading-tight text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
                        >
                            <span>{t('controlBox.sideTranslationHiddenChip')}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-medium">{t('controlBox.sideTranslationShowAction')}</span>
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return render();
}
