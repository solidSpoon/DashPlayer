import React from 'react';
import {
    FloatingPortal,
    autoPlacement,
    offset,
    useFloating,
    useInteractions
} from '@floating-ui/react';
import { OpenAIDictionaryResult } from '@/common/types/DictionaryResult';
import { cn } from '@/fronted/lib/utils';
import OpenAIWordPop from './openai-word-pop';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { useTransLineTheme } from './translatable-theme';

const logger = getRendererLogger('WordPop');

export interface WordSubParam {
    translation: OpenAIDictionaryResult | null | undefined;
    /**
     * 浮层锚点所绑定的单词元素。
     *
     * 约束：
     * - 该元素由外层 `Word` 持有，生命周期需覆盖整个悬停过程。
     * - 传入 `null` 时仅渲染浮层容器，不会尝试重新创建参考节点。
     */
    referenceElement: HTMLElement | null;
    isLoading?: boolean;
    /** 流式/最终单词卡数据；预置词典与 AI 生成共用同一结构。 */
    openaiStreamingData?: OpenAIDictionaryResult | null;
    isStreaming?: boolean;
    onRefresh?: () => void;
    /** 点击收藏按钮；未提供时不渲染收藏入口。 */
    onFavorite?: () => void;
    /** 当前单词是否已收藏。 */
    isFavorited?: boolean;
    /** 收藏请求是否进行中。 */
    isFavoriting?: boolean;
    classNames?: {
        openaiContainer?: string;  // 单词卡容器覆盖
        refreshButton?: string;    // 刷新按钮覆盖
    };
}

const WordPop = React.forwardRef(
    (
        {
            translation,
            referenceElement,
            isLoading: externalIsLoading,
            openaiStreamingData,
            isStreaming = false,
            onRefresh,
            onFavorite,
            isFavorited = false,
            isFavoriting = false,
            classNames
        }: WordSubParam,
        ref: React.ForwardedRef<HTMLDivElement | null>
    ) => {
        logger.debug('WordPop translation data', { translation, openaiStreamingData, isStreaming });

        const theme = useTransLineTheme();
        const { refs, floatingStyles } = useFloating({
            middleware: [
                offset(50),
                autoPlacement({
                    allowedPlacements: [
                        'top',
                        'bottom',
                        'top-start',
                        'top-end',
                        'bottom-start',
                        'bottom-end'
                    ],
                }),
            ],
        });

        const { getReferenceProps, getFloatingProps } = useInteractions([]);

        /**
         * 将浮层显式锚定到外层稳定存在的单词节点，避免悬停时替换文本 DOM。
         */
        React.useEffect(() => {
            refs.setReference(referenceElement);
        }, [referenceElement, refs]);

        const cardData = openaiStreamingData ?? (isOpenAIFormat(translation) ? translation : null);

        return (
            <>
                <FloatingPortal>
                    {/* 仅用于阻止事件冒泡，不提供交互语义 */}
                    {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
                    <div
                        {...getFloatingProps(getReferenceProps())}
                        ref={refs.setFloating}
                        style={floatingStyles}
                        className="z-[9999]"
                        onClick={(e) => {
                            e.stopPropagation();
                        }}
                    >
                        <div className="z-50" ref={ref}>
                            <OpenAIWordPop
                                className={cn(theme.pop.openaiContainer, classNames?.openaiContainer)}
                                data={cardData}
                                isLoading={externalIsLoading}
                                isStreaming={isStreaming}
                                onRefresh={onRefresh}
                                onFavorite={onFavorite}
                                isFavorited={isFavorited}
                                isFavoriting={isFavoriting}
                            />
                        </div>
                    </div>
                </FloatingPortal>
            </>
        );
    }
);

/**
 * 判断数据是否为统一的简化单词卡形状（预置词典与 AI 生成共用）。
 */
const isOpenAIFormat = (data: unknown): data is OpenAIDictionaryResult => {
    return typeof data === 'object' && data !== null && 'definitions' in data && Array.isArray((data as { definitions?: unknown }).definitions);
};

WordPop.displayName = 'WordPop';

export default WordPop;
