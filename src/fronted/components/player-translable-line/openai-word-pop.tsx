import React from 'react';
import { RefreshCw } from 'lucide-react';
import { OpenAIDictionaryResult } from '@/common/types/YdRes';
import Playable from '@/fronted/pages/player/chat/Playable';
import { cn } from '@/fronted/lib/utils';

interface OpenAIWordPopProps {
    data: OpenAIDictionaryResult | null | undefined;
    isLoading?: boolean;
    onRefresh?: () => void;
    className?: string; // 新增：容器 class 覆盖
}

const OpenAIWordPop: React.FC<OpenAIWordPopProps> = ({ data, isLoading = false, onRefresh, className }) => {
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

        return (
            <div className="p-4 h-full overflow-y-auto scrollbar-none">
                <div className="space-y-3">
                    {/* 单词标题 */}
                    <div className="border-b border-gray-200 pb-2">
                        <h3 className="text-lg font-semibold text-gray-800">
                            <Playable>{data.word}</Playable>
                        </h3>
                        {(data.phonetic || data.ukPhonetic || data.usPhonetic) && (
                            <div className="text-sm text-gray-500 mt-1 space-x-3 select-text">
                                {data.phonetic && <span>/{data.phonetic}/</span>}
                                {data.ukPhonetic && <span>UK: /{data.ukPhonetic}/</span>}
                                {data.usPhonetic && <span>US: /{data.usPhonetic}/</span>}
                            </div>
                        )}
                    </div>

                    {/* 释义 */}
                    <div>
                        <h4 className="text-sm font-medium text-gray-600 mb-2">释义</h4>
                        <div className="space-y-1">
                            {data.definitions.map((def, index) => (
                                <div key={index} className="text-sm text-gray-700 pl-3 border-l-2 border-blue-100 select-text">
                                    {def}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 例句 */}
                    {data.examples && data.examples.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-gray-600 mb-2">例句</h4>
                            <div className="space-y-2">
                                {data.examples.map((example, index) => (
                                    <div
                                        key={index}
                                        className="text-xs text-gray-600 italic bg-gray-50 rounded p-2 select-text"
                                    >
                                        <Playable>{example}</Playable>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className={cn('w-80 h-96 bg-gray-100 text-gray-900 shadow-inner shadow-gray-100 drop-shadow-2xl rounded-2xl overflow-hidden text-left relative', className)}>
            {onRefresh && (
                <button
                    onClick={onRefresh}
                    disabled={isLoading}
                    className={cn(
                        'absolute top-2 right-2 p-1.5 rounded-full bg-white/80 hover:bg-white text-gray-600 hover:text-gray-800 shadow-sm transition-colors z-10',
                        isLoading && 'opacity-50'
                    )}
                    title="强制刷新"
                >
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                </button>
            )}
            <div className="h-full overflow-hidden">
                {isLoading ? renderSkeleton() : renderContent()}
            </div>
        </div>
    );
};

export default OpenAIWordPop;
