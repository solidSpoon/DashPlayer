import React from 'react';
import { Star, RefreshCw } from 'lucide-react';
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
    word?: string;
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
    /** 收藏按钮点击回调，参数为 (单词, 释义) */
    onAddToVocabulary?: (word: string, translate?: string) => void;
    /** 当前单词是否已在生词本中 */
    isWordInVocabulary?: boolean;
    classNames?: {
        container?: string;        // youdao 容器覆盖
        openaiContainer?: string;  // openai 容器覆盖
        refreshButton?: string;    // 刷新按钮覆盖
    };
}

const WordPop = React.forwardRef(
        (
        {
            word,
            translation,
            referenceElement,
            isLoading: externalIsLoading,
            openaiStreamingData,
            isStreaming = false,
            onRefresh,
            onAddToVocabulary,
            isWordInVocabulary,
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

        const isYoudaoFormat = (data: any): data is YdRes => {
            return data && 'webdict' in data && 'translation' in data;
        };

        const isOpenAIFormat = (data: any): data is OpenAIDictionaryResult => {
            return data && 'definitions' in data && Array.isArray(data.definitions);
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
                <div className="sticky bottom-0 bg-white/95 border-t border-gray-100 flex items-center justify-between px-3 py-2 z-20">
                    <div className="text-cyan-900 text-base font-medium truncate flex-1 pr-2">
                        {ydData?.translation?.join('；')}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {onAddToVocabulary && word && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onAddToVocabulary(word, ydData?.translation?.join('；')); }}
                                disabled={isWordInVocabulary}
                                className={cn(
                                    'p-1.5 rounded-full shadow-sm transition-colors',
                                    isWordInVocabulary
                                        ? 'text-yellow-500 cursor-default bg-gray-50'
                                        : 'text-gray-600 hover:text-yellow-600 bg-white hover:bg-gray-50 border border-gray-100',
                                )}
                                title={isWordInVocabulary ? '已收藏' : '收藏到生词本'}
                            >
                                <Star size={16} className={isWordInVocabulary ? 'fill-yellow-400' : ''} />
                            </button>
                        )}
                        {onRefresh && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onRefresh(); }}
                                disabled={externalIsLoading || isStreaming || isLoading}
                                className={cn(
                                    'p-1.5 rounded-full shadow-sm transition-colors bg-white hover:bg-gray-50 border border-gray-100 text-gray-600 hover:text-gray-800',
                                    (externalIsLoading || isStreaming || isLoading) && 'opacity-50'
                                )}
                                title="强制刷新"
                            >
                                <RefreshCw size={16} className={(externalIsLoading || isStreaming || isLoading) ? 'animate-spin' : ''} />
                            </button>
                        )}
                    </div>
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
                        onAddToVocabulary={onAddToVocabulary}
                        isWordInVocabulary={isWordInVocabulary}
                    />
                );
            }

            return (
                <div
                    className={cn(
                        theme.pop.container,
                        classNames?.container,
                        isLoading ? 'opacity-0' : 'opacity-100',
                        shouldShowYoudao && (translation as any)?.webdict?.url && 'pt-4',
                        'relative overflow-hidden'
                    )}
                >
                    {shouldShowYoudao && renderYoudaoContent(translation as YdRes)}
                    {!shouldShowYoudao && <div className="p-4 text-gray-500">无可用的字典信息</div>}
                </div>
            );
        };

        return (
            <>
                <FloatingPortal>
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
