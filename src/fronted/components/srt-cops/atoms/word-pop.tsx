import React from 'react';
import {
    autoPlacement,
    offset,
    useFloating,
    useInteractions
} from '@floating-ui/react';
import { YdRes, OpenAIDictionaryResult } from '@/common/types/YdRes';
import {cn} from "@/fronted/lib/utils";
import OpenAIWordPop from './openai-word-pop';
import useSetting from '@/fronted/hooks/useSetting';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import useVocabulary from '@/fronted/hooks/useVocabulary';

const logger = getRendererLogger('WordPop');

export interface WordSubParam {
    word: string;
    translation: YdRes | OpenAIDictionaryResult | null | undefined;
    hoverColor: string;
    isLoading?: boolean;
    onRefresh?: () => void;
}

const WordPop = React.forwardRef(
    (
        { word, translation, hoverColor, isLoading: externalIsLoading, onRefresh }: WordSubParam,
        ref: React.ForwardedRef<HTMLDivElement | null>
    ) => {
        logger.debug('WordPop translation data', { translation });
        
        const setting = useSetting((state) => state.setting);
        const openaiDictionaryEnabled = setting('services.openai.enableDictionary') === 'true';
        const youdaoDictionaryEnabled = setting('services.youdao.enableDictionary') === 'true';
        const vocabularyStore = useVocabulary();
        const isVocabularyWord = vocabularyStore.isVocabularyWord;
        
        // 检查是否是词汇单词
        const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
        const isVocab = cleanWord && isVocabularyWord(cleanWord);

        const { refs, floatingStyles, context } = useFloating({
            middleware: [
                // autoPlacement({ allowedPlacements: ['bottom'] }),
                offset(50),
                autoPlacement({
                    allowedPlacements: [
                        'top',
                        'bottom',
                        'top-start',
                        'top-end',
                        'bottom-start',
                        'bottom-end'
                    ]
                })
            ]
        });

        const { getReferenceProps, getFloatingProps } = useInteractions([]);

        const [isLoading, setIsLoading] = React.useState(true);

        // 监听 iframe 加载完成
        const handleIframeLoad = () => {
            setIsLoading(false);
        };

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
                <div className="sticky bottom-0 text-cyan-900 text-lg text-center w-full pt-1 mt-1 pb-2">
                    {ydData?.translation}
                </div>
            </>
        );


        const popper = () => {
            const shouldShowYoudao = isYoudaoFormat(translation);
            const shouldShowOpenAI = isOpenAIFormat(translation);
            
            logger.debug('WordPop content type detection', {
                translation,
                shouldShowYoudao,
                shouldShowOpenAI,
                hasDefinitions: translation && 'definitions' in translation,
                definitionsArray: translation && 'definitions' in translation ? translation.definitions : null
            });

            if (openaiDictionaryEnabled) {
                return <OpenAIWordPop data={shouldShowOpenAI ? translation : null} isLoading={externalIsLoading} onRefresh={onRefresh} />;
            }

            return (
                <div
                    className={cn(
                        'select-text relative top-0 left-0 h-[500px] w-[500px] overflow-y-hidden flex flex-col items-start bg-gray-100 text-gray-900 shadow-inner shadow-gray-100 drop-shadow-2xl rounded-2xl px-4 scrollbar-none',
                        isLoading ? 'opacity-0' : 'opacity-100',
                        shouldShowYoudao && translation?.webdict?.url && 'pt-4'
                    )}
                >
                    {shouldShowYoudao && renderYoudaoContent(translation)}
                    {!shouldShowYoudao && (
                        <div className="p-4 text-gray-500">
                            无可用的字典信息
                        </div>
                    )}
                </div>
            );
        };

        return (
            <>
                <div
                    ref={refs.setReference}
                    className={cn(
                        'rounded select-none z-50 focus:outline-none', 
                        hoverColor,
                        isVocab && '!text-blue-400 !underline !decoration-blue-400 !decoration-1 !bg-blue-500/10 px-0.5 rounded hover:!bg-blue-500/30'
                    )}
                    role="button"
                    tabIndex={0}
                    {...getReferenceProps()}
                >
                    {word}
                </div>

                <div
                    {...getFloatingProps()}
                    ref={refs.setFloating}
                    style={floatingStyles}
                    onClick={(e) => {
                        e.stopPropagation();
                    }}
                >
                    <div className="z-50" ref={ref}>
                        {popper()}
                    </div>
                </div>
            </>
        );
    }
);

export default WordPop;
