import React from 'react';
import { RefreshCw } from 'lucide-react';
import { OpenAIDictionaryResult } from '@/common/types/YdRes';
import Playable from '@/fronted/components/shared/common/Playable';
import { cn } from '@/fronted/lib/utils';

const formatPhonetic = (value?: string) => {
    if (!value) {
        return null;
    }
    const trimmed = value.trim().replace(/^\/+/, '').replace(/\/+$/, '');
    if (!trimmed) {
        return null;
    }
    return `/${trimmed}/`;
};

interface OpenAIWordPopProps {
    data: OpenAIDictionaryResult | null | undefined;
    isLoading?: boolean;
    isStreaming?: boolean;
    onRefresh?: () => void;
    className?: string; // 新增：容器 class 覆盖
}

const OpenAIWordPop: React.FC<OpenAIWordPopProps> = ({ data, isLoading = false, isStreaming = false, onRefresh, className }) => {
    const hasDefinitions = !!data && Array.isArray(data.definitions) && data.definitions.length > 0;
    const hasExamples = !!data && Array.isArray(data.examples) && data.examples.length > 0;
    const hasContent = !!data && (Boolean(data.word) || hasDefinitions || hasExamples);

    const renderSkeleton = () => (
        <div className="p-4 h-full overflow-y-auto scrollbar-none space-y-3">
            {/* 单词标题骨架 */}
            <div className="border-b border-gray-200 pb-2">
                <div className="h-6 bg-gray-200 rounded w-20 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-32 mt-1 animate-pulse"></div>
            </div>

            {/* 释义骨架 */}
            <div>
                <div className="h-4 bg-gray-200 rounded w-12 mb-2 animate-pulse"></div>
                <div className="space-y-1">
                    <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded w-4/5 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                </div>
            </div>

            {/* 例句骨架 */}
            <div>
                <div className="h-4 bg-gray-200 rounded w-12 mb-2 animate-pulse"></div>
                <div className="space-y-2">
                    <div className="h-8 bg-gray-100 rounded p-2 animate-pulse"></div>
                    <div className="h-8 bg-gray-100 rounded p-2 animate-pulse"></div>
                </div>
            </div>
        </div>
    );

    const renderContent = () => {
        if (!data) {
            return (
                <div className="p-4 text-gray-500">
                    无可用的字典信息
                </div>
            );
        }

        const phonetic = formatPhonetic(data.phonetic);
        const ukPhonetic = formatPhonetic(data.ukPhonetic);
        const usPhonetic = formatPhonetic(data.usPhonetic);

        const renderDefinitionExamples = (examples?: OpenAIDictionaryResult['definitions'][number]['examples']) => {
            if (!examples || examples.length === 0) {
                return null;
            }

            return (
                <div className="mt-2 space-y-2">
                    {examples.map((example, index) => (
                        <div
                            key={`def-example-${index}-${example.sentence}`}
                            className="rounded-md bg-blue-50/60 border border-blue-100 px-2.5 py-2 space-y-1"
                        >
                            <div className="text-xs text-gray-800">
                                <Playable>{example.sentence}</Playable>
                            </div>
                        {example.translation && (
                            <div className="text-xs text-gray-600">
                                {example.translation}
                            </div>
                        )}
                            {example.explanation && (
                                <div className="text-xs text-gray-500">
                                    {example.explanation}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            );
        };

        const renderGlobalExamples = () => {
            if (!hasExamples || !data.examples) {
                return null;
            }

            return (
                <div>
                    <h4 className="text-sm font-medium text-gray-600 mb-2">更多例句</h4>
                    <div className="space-y-2">
                        {data.examples.map((example, index) => (
                            <div
                                key={`global-example-${index}-${example.sentence}`}
                                className="rounded-md border border-gray-200 px-3 py-2 space-y-1 bg-white/70"
                            >
                                <div className="text-xs text-gray-800">
                                    <Playable>{example.sentence}</Playable>
                                </div>
                                {example.translation && (
                                    <div className="text-xs text-gray-600">
                                        {example.translation}
                                    </div>
                                )}
                                {example.explanation && (
                                    <div className="text-xs text-gray-500">
                                        {example.explanation}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            );
        };

        return (
            <div className="p-4 h-full overflow-y-auto scrollbar-none">
                <div className="space-y-3">
                    {/* 单词标题 */}
                    <div className="border-b border-gray-200 pb-2">
                        <h3 className="text-lg font-semibold text-gray-800">
                            <Playable>{data.word}</Playable>
                        </h3>
                        {(phonetic || ukPhonetic || usPhonetic) && (
                            <div className="text-sm text-gray-500 mt-1 space-x-3 select-text">
                                {phonetic && <span>{phonetic}</span>}
                                {ukPhonetic && <span>UK: {ukPhonetic}</span>}
                                {usPhonetic && <span>US: {usPhonetic}</span>}
                            </div>
                        )}
                        {isStreaming && (
                            <div className="text-xs text-blue-500 mt-2 select-none">
                                正在生成释义…
                            </div>
                        )}
                    </div>

                    {/* 精简释义 */}
                    {hasDefinitions && (
                        <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700 select-text">
                            <span className="text-gray-500 mr-2">速览：</span>
                            <span>
                                {data.definitions
                                    .slice(0, 3)
                                    .map((definition, index) => {
                                        const prefix = definition.partOfSpeech ? `${definition.partOfSpeech}. ` : '';
                                        return `${prefix}${definition.meaning}`;
                                    })
                                    .join('；')}
                                {data.definitions.length > 3 ? '…' : ''}
                            </span>
                        </div>
                    )}

                    {/* 释义 */}
                    <div>
                        <h4 className="text-sm font-medium text-gray-600 mb-2">详细释义</h4>
                        <div className="space-y-3">
                            {hasDefinitions ? (
                                data.definitions.map((definition, index) => (
                                    <div
                                        key={`definition-${index}-${definition.meaning}`}
                                        className="rounded-md border border-gray-200 px-3 py-2 space-y-1 select-text"
                                    >
                                        <div className="flex items-start gap-2 text-sm text-gray-800">
                                            {definition.partOfSpeech && (
                                                <span className="text-xs uppercase tracking-wide text-blue-600 bg-blue-100/80 px-1.5 py-0.5 rounded">
                                                    {definition.partOfSpeech}
                                                </span>
                                            )}
                                            <span className="leading-relaxed">{definition.meaning}</span>
                                        </div>

                                        {definition.explanation && (
                                            <div className="text-xs text-gray-500">
                                                {definition.explanation}
                                            </div>
                                        )}
                                        {definition.translationNote && (
                                            <div className="text-xs text-amber-600">
                                                译注：{definition.translationNote}
                                            </div>
                                        )}
                                        {definition.relatedPhrases && definition.relatedPhrases.length > 0 && (
                                            <div className="text-xs text-purple-600">
                                                搭配：{definition.relatedPhrases.join('、')}
                                            </div>
                                        )}

                                        {renderDefinitionExamples(definition.examples)}
                                    </div>
                                ))
                            ) : (
                                <div className="text-sm text-gray-400 pl-3 border-l-2 border-dashed border-blue-200 select-none">
                                    {isStreaming ? '等待释义生成…' : '暂无释义'}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 额外例句 */}
                    {renderGlobalExamples()}
                </div>
            </div>
        );
    };

    return (
        <div className={cn('w-80 h-96 bg-gray-100 text-gray-900 shadow-inner shadow-gray-100 drop-shadow-2xl rounded-2xl overflow-hidden text-left relative', className)}>
            {onRefresh && (
                <button
                    onClick={onRefresh}
                    disabled={isLoading || isStreaming}
                    className={cn(
                        'absolute top-2 right-2 p-1.5 rounded-full bg-white/80 hover:bg-white text-gray-600 hover:text-gray-800 shadow-sm transition-colors z-10',
                        (isLoading || isStreaming) && 'opacity-50'
                    )}
                    title="强制刷新"
                >
                    <RefreshCw size={16} className={isLoading || isStreaming ? 'animate-spin' : ''} />
                </button>
            )}
            <div className="h-full overflow-hidden">
                {isLoading && !hasContent ? renderSkeleton() : renderContent()}
            </div>
        </div>
    );
};

export default OpenAIWordPop;
