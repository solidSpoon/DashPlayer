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

/**
 * 切「侧栏译文」那一瞬的位置快照，也是补偿窗口的生命周期句柄。
 */
type SideTranslationSnapshot = {
    /** 当前句的 DOM 节点；补偿时通过它重新量位置 */
    element: HTMLElement;
    /** 点击那一刻当前句的视口纵坐标（视觉像素） */
    top: number;
    /** 点击那一刻滚动容器的 scrollTop（滚动像素） */
    scrollTop: number;
    /** 本世代的编号：世代变了说明又点了一次开关，这份快照作废 */
    generation: number;
    /** 监听 scroll 的那个滚动容器 */
    scroller: HTMLElement;
    /**
     * 期望的 scrollTop：用来区分「我自己写进去的滚动」与「用户滚的」。
     * 写回后立即同步，所以随后那个 scroll 事件会被认成自己写的。
     */
    expectedScrollTop: number;
    /** 用户已经接管了位置，本次补偿不写任何东西 */
    cancelled: boolean;
    /** 注销 scroll 监听（幂等） */
    detach: () => void;
};

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
     * 切换「侧栏译文」前的视觉快照（含本次切换的世代号）。
     */
    const sideTranslationToggleSnapshotRef = useRef<SideTranslationSnapshot | null>(null);
    /**
     * 侧栏译文切换的世代号：每次 toggle 递增。旧世代的补偿与 scroll 监听一律作废，
     * 否则连续切换时上一次写的 scrollTop 会落到新一次切换之后（实测会累积成位移）。
     */
    const sideTranslationToggleGenerationRef = useRef(0);

    /**
     * 捕获阶段监听三个切换入口：先量位置，再让 React 去改行高。
     * 用捕获阶段是因为这些入口各自挂着 onClick / Radix 的关闭逻辑，冒泡阶段布局可能已经变过了。
     * 入口靠 data-side-translation-toggle 标记，不靠组件实例引用，因为三个入口分属三个组件。
     */
    useEffect(() => {
        const handleCaptureClick = (event: MouseEvent) => {
            const target = event.target;
            if (!(target instanceof Element) || !target.closest('[data-side-translation-toggle]')) {
                return;
            }
            const element = useSubtitleScroll.getState().internal.currentRef;
            const scroller = scrollerRef.current;
            if (!element || !(scroller instanceof HTMLElement)) {
                return;
            }

            // 上一次还没走完的快照先作废，旧监听不留在滚动容器上
            sideTranslationToggleSnapshotRef.current?.detach();
            const generation = sideTranslationToggleGenerationRef.current + 1;
            sideTranslationToggleGenerationRef.current = generation;
            const scrollTop = scroller.scrollTop;

            /**
             * 窗口内收到「不是自己写的」滚动，就说明用户接管了位置：直接放弃本次补偿。
             * 事件驱动而不是「写回前采样一次」：用户滚动落在两次 rAF 之间时，采样可能还看到旧值，
             * 于是一次性地把用户滚到的位置拽回去（实测 3 轮里有 1 轮）。
             */
            const handleUserScroll = () => {
                if (snapshot.cancelled) {
                    return;
                }
                // 自己写回的那一次滚动不算用户滚动：预期值在写回后立即同步
                if (Math.abs(scroller.scrollTop - snapshot.expectedScrollTop) <= 1) {
                    return;
                }
                snapshot.cancelled = true;
                snapshot.detach();
            };

            const snapshot: SideTranslationSnapshot = {
                element,
                top: element.getBoundingClientRect().top,
                scrollTop,
                generation,
                scroller,
                expectedScrollTop: scrollTop,
                cancelled: false,
                detach: () => scroller.removeEventListener('scroll', handleUserScroll),
            };
            scroller.addEventListener('scroll', handleUserScroll, { passive: true });
            sideTranslationToggleSnapshotRef.current = snapshot;
        };
        document.addEventListener('click', handleCaptureClick, true);
        return () => {
            document.removeEventListener('click', handleCaptureClick, true);
            // 组件卸载：监听不能留在滚动容器上
            sideTranslationToggleSnapshotRef.current?.detach();
            sideTranslationToggleSnapshotRef.current = null;
        };
    }, []);

    /**
     * 上一次渲染时的「侧栏译文」开关值；用于区分「用户刚切了开关」与「首次挂载/其他重渲染」。
     */
    const prevShowSideTranslationRef = useRef(showSideTranslation);
    useEffect(() => {
        if (prevShowSideTranslationRef.current === showSideTranslation) {
            return;
        }
        prevShowSideTranslationRef.current = showSideTranslation;
        const snapshot = sideTranslationToggleSnapshotRef.current;
        sideTranslationToggleSnapshotRef.current = null;

        // 译文行增减会整体改变行高，scrollTop 却不变：当前句会跟着内容一起位移（观感是来回跳）。
        // 所以不是「把它锚回视野」而是「把它放回原来的视口位置」：量同一个 DOM 节点移动了多少，
        // 再把这个位移从 scrollTop 里读回来。只写一次（多轮写回会重复叠加位移，已经回退过）。
        // 等两帧是因为 Virtuoso 的重测自己也在 rAF 里跑。
        let innerFrameId = 0;
        let settleFrameId = 0;
        const outerFrameId = requestAnimationFrame(() => {
            innerFrameId = requestAnimationFrame(() => {
                const scroller = scrollerRef.current;
                const internal = useSubtitleScroll.getState().internal;
                const position = internal.currentListPosition;
                // 世代变了（又点了一次开关）或用户已抢走滚动：位置以新状态为准，一个字都不写
                const stale = !!snapshot
                    && (snapshot.generation !== sideTranslationToggleGenerationRef.current || snapshot.cancelled);
                if (stale) {
                    snapshot.detach();
                    return;
                }
                // 必须确认量的还是同一行：两帧的间隔里 Virtuoso 可能把当前句的节点回收给了别的句子，
                // 那时拿旧节点量出来的位移与当前句无关，只能退回锚定
                const sameRow = !!snapshot && internal.currentRef === snapshot.element && snapshot.element.isConnected;
                if (!snapshot || !(scroller instanceof HTMLElement) || !sameRow) {
                    snapshot?.detach();
                    // 量不到原节点时退回旧兜底：至少把当前句锚回视野里
                    if (position >= 0) {
                        syncIntoView(position);
                    }
                    return;
                }
                // 二次保险：scroll 事件可能还没送达，写回前再比一次数
                if (Math.abs(scroller.scrollTop - snapshot.expectedScrollTop) > 1) {
                    snapshot.detach();
                    return;
                }
                // rect 是视觉像素，scrollTop 是布局像素：侧栏打开时整块面板被 CSS scale 过，必须先换算
                const scale = scroller.clientHeight > 0
                    ? scroller.getBoundingClientRect().height / scroller.clientHeight
                    : 1;
                const delta = (snapshot.element.getBoundingClientRect().top - snapshot.top) / scale;
                if (Math.abs(delta) >= 1) {
                    // 登记一次「这次 scroll 是我写的」，否则 onScroll 会把它当用户滚动
                    useSubtitleScroll.getState().skipNextScrollJudgement();
                    scroller.scrollTop += delta;
                    // 写回后立即同步预期值：随后那个 scroll 事件就是「自己写的」
                    snapshot.expectedScrollTop = scroller.scrollTop;
                }
                // 兜底：补偿后若当前句仍被挤出视野（如补偿被用户滚动打断），再锚一次
                if (position >= 0) {
                    syncIntoView(position);
                }
                // 写完再多守一帧才注销监听：这一帧里用户滚动仍应能生效
                settleFrameId = requestAnimationFrame(() => snapshot.detach());
            });
        });
        return () => {
            cancelAnimationFrame(outerFrameId);
            cancelAnimationFrame(innerFrameId);
            cancelAnimationFrame(settleFrameId);
            snapshot?.detach();
        };
    }, [showSideTranslation, syncIntoView]);

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
        const handlePointerDown = (e: PointerEvent) => {
            // 事件 target 为滚动容器本身说明按下的是滚动条区域，而非字幕行
            if (e.target === scroller) {
                interruptAutoScroll();
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                interruptAutoScroll();
            }
        };
        scroller.addEventListener('wheel', interruptAutoScroll, { passive: true });
        scroller.addEventListener('pointerdown', handlePointerDown);
        scroller.addEventListener('keydown', handleKeyDown);
        detachUserInputRef.current = () => {
            scroller.removeEventListener('wheel', interruptAutoScroll);
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
                            data-side-translation-toggle
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
