import React from 'react';
import {
    FloatingPortal,
    autoPlacement,
    offset,
    useFloating,
    useInteractions
} from '@floating-ui/react';
import { YdRes, OpenAIDictionaryResult } from '@/common/types/YdRes';
import { cn } from '@/fronted/lib/utils';
import OpenAIWordPop from './openai-word-pop';
import useSetting from '@/fronted/hooks/useSetting';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { useTransLineTheme } from './translatable-theme';

const logger = getRendererLogger('WordPop');

export interface WordSubParam {
    translation: YdRes | OpenAIDictionaryResult | null | undefined;
    /**
     * 浮层锚点所绑定的单词元素。
     *
     * 约束：
     * - 该元素由外层 `Word` 持有，生命周期需覆盖整个悬停过程。
     * - 传入 `null` 时仅渲染浮层容器，不会尝试重新创建参考节点。
     */
    referenceElement: HTMLElement | null;
    isLoading?: boolean;
    openaiStreamingData?: OpenAIDictionaryResult | null;
    isStreaming?: boolean;
    onRefresh?: () => void;
    classNames?: {
        container?: string;        // youdao 容器覆盖
        openaiContainer?: string;  // openai 容器覆盖
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
            classNames
        }: WordSubParam,
        ref: React.ForwardedRef<HTMLDivElement | null>
    ) => {
        logger.debug('WordPop translation data', { translation, openaiStreamingData, isStreaming });

        const theme = useTransLineTheme();
        const setting = useSetting((state) => state.setting);
        const dictionaryEngineRaw = setting('providers.dictionary');
        const dictionaryEngine =
            dictionaryEngineRaw === 'youdao' || dictionaryEngineRaw === 'openai'
                ? dictionaryEngineRaw
                : 'openai';
        const openaiDictionaryEnabled = dictionaryEngine === 'openai';
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

        const [isLoading, setIsLoading] = React.useState(true);

        // 监听 iframe 加载完成
        const handleIframeLoad = () => {
            setIsLoading(false);
        };

        /**
         * 将浮层显式锚定到外层稳定存在的单词节点，避免悬停时替换文本 DOM。
         */
        React.useEffect(() => {
            refs.setReference(referenceElement);
        }, [referenceElement, refs]);

        const isYoudaoFormat = (data: unknown): data is YdRes => {
            return typeof data === 'object' && data !== null && 'webdict' in data && 'translation' in data;
        };

        const isOpenAIFormat = (data: unknown): data is OpenAIDictionaryResult => {
            return typeof data === 'object' && data !== null && 'definitions' in data && Array.isArray((data as { definitions?: unknown }).definitions);
        };

        const renderYoudaoContent = (ydData: YdRes) => (
            <>
                {ydData?.webdict?.url && (
                    <div className={cn('w-full overflow-y-scroll overflow-x-hidden scrollbar-none')}>
                        <iframe
                            className="w-full h-[8000px] -mt-[50px]"
                            src={ydData.webdict.url}
                            title="dict"
                            onLoad={handleIframeLoad}
                        />
                    </div>
                )}
                <div className="sticky bottom-0 text-cyan-900 text-lg text-center w-full pt-1 mt-1 pb-2">
                    {ydData?.translation}
                </div>
            </>
        );


        const popper = () => {
            const shouldShowYoudao = isYoudaoFormat(translation);
            const shouldShowOpenAI = isOpenAIFormat(translation);
            const openAIData = openaiStreamingData ?? (shouldShowOpenAI ? translation : null);
            const openAIHasData = !!openAIData && (
                (Array.isArray(openAIData.definitions) && openAIData.definitions.length > 0) ||
                Boolean(openAIData.word)
            );
            const openAILoading = openaiDictionaryEnabled
                ? (externalIsLoading || isStreaming) && !openAIHasData
                : externalIsLoading;
            logger.debug('WordPop content type detection', {
                translation,
                shouldShowYoudao,
                shouldShowOpenAI,
                hasDefinitions: translation && 'definitions' in translation,
                definitionsArray: translation && 'definitions' in translation ? translation.definitions : null,
                openAIHasData,
                isStreaming
            });

            if (openaiDictionaryEnabled) {
                return (
                    <OpenAIWordPop
                        className={cn(theme.pop.openaiContainer, classNames?.openaiContainer)}
                        data={openAIData}
                        isLoading={openAILoading}
                        isStreaming={isStreaming}
                        onRefresh={onRefresh}
                    />
                );
            }

            return (
                <div
                    className={cn(
                        theme.pop.container,
                        classNames?.container,
                        isLoading ? 'opacity-0' : 'opacity-100',
                        shouldShowYoudao && translation.webdict?.url && 'pt-4'
                    )}
                >
                    {shouldShowYoudao && renderYoudaoContent(translation)}
                    {!shouldShowYoudao && <div className="p-4 text-gray-500">无可用的字典信息</div>}
                </div>
            );
        };

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
                            {popper()}
                        </div>
                    </div>
                </FloatingPortal>
            </>
        );
    }
);

WordPop.displayName = 'WordPop';

export default WordPop;
