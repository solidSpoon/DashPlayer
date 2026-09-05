import React from 'react';
import { RefreshCw, Star, Loader2 } from 'lucide-react';
import { OpenAIDictionaryResult } from '@/common/types/YdRes';
import Playable from '@/fronted/components/shared/common/Playable';
import { cn } from '@/fronted/lib/utils';
import { useTranslation } from 'react-i18next';

/**
 * 统一音标显示格式，自动补齐首尾斜杠。
 */
const formatPhonetic = (value: string) => {
    if (!value) return null;
    const trimmed = value.trim().replace(/^\/+/, '').replace(/\/+$/, '');
    if (!trimmed) return null;
    return `/${trimmed}/`;
};

const formatPartOfSpeech = (pos?: string) => {
    if (!pos) return '';
    const cleaned = pos.trim().replace(/\.+$/, '');
    return cleaned ? `${cleaned}.` : '';
};

interface OpenAIWordPopProps {
    data: OpenAIDictionaryResult | null | undefined;
    isLoading?: boolean;
    isStreaming?: boolean;
    onRefresh?: () => void;
    /** 点击收藏按钮；未提供时不渲染收藏入口。 */
    onFavorite?: () => void;
    /** 当前单词是否已收藏。 */
    isFavorited?: boolean;
    /** 收藏请求是否进行中。 */
    isFavoriting?: boolean;
    className?: string;
}

const OpenAIWordPop: React.FC<OpenAIWordPopProps> = ({
    data,
    isLoading = false,
    isStreaming = false,
    onRefresh,
    onFavorite,
    isFavorited = false,
    isFavoriting = false,
    className
}) => {
    const { t } = useTranslation('common');
    const hasDefinitions = !!data && Array.isArray(data.definitions) && data.definitions.length > 0;
    const hasContent = !!data && (Boolean(data.word) || hasDefinitions);

    const renderSkeleton = () => (
        <div className="p-4 space-y-4 h-full flex flex-col justify-start">
            <div className="flex items-center justify-between pb-1">
                <div className="space-y-2">
                    <div className="h-6 bg-muted rounded w-28 animate-pulse" />
                    <div className="h-4 bg-muted/60 rounded w-20 animate-pulse" />
                </div>
            </div>
            <div className="space-y-4 pt-1 flex-1">
                <div className="space-y-2">
                    <div className="h-5 bg-muted/80 rounded w-1/2 animate-pulse" />
                    <div className="h-4 bg-muted/40 rounded w-4/5 animate-pulse" />
                </div>
                <div className="space-y-2">
                    <div className="h-5 bg-muted/80 rounded w-2/3 animate-pulse" />
                    <div className="h-4 bg-muted/40 rounded w-3/4 animate-pulse" />
                </div>
            </div>
        </div>
    );

    const renderContent = () => {
        if (!data) {
            return (
                <div className="h-full flex items-center justify-center p-6 text-center text-sm text-muted-foreground select-none">
                    {t('noDefinition')}
                </div>
            );
        }

        const phonetic = formatPhonetic(data.phonetic);

        return (
            <div className="h-full flex flex-col overflow-hidden">
                {/* 固定头部：单词、音标、刷新操作 */}
                <div className="px-4.5 pt-4 pb-1.5 flex items-start justify-between shrink-0">
                    <div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-lg font-bold text-foreground tracking-tight select-text">
                                <Playable>{data.word}</Playable>
                            </span>
                        </div>
                        {phonetic && (
                            <span className="text-sm font-mono text-muted-foreground/75 mt-0.5 inline-block select-text">
                                {phonetic}
                            </span>
                        )}
                        {isStreaming && (
                            <span className="text-xs text-muted-foreground/70 animate-pulse mt-0.5 inline-block select-none font-normal">
                                ···
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0 ml-2">
                        {onFavorite && (
                            <button
                                type="button"
                                onClick={onFavorite}
                                disabled={isFavoriting}
                                className={cn(
                                    'p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer',
                                    isFavorited && 'text-amber-500 hover:text-amber-500',
                                    isFavoriting && 'cursor-default'
                                )}
                                title={isFavorited ? t('unfavoriteWord') : t('favoriteWord')}
                            >
                                {isFavoriting
                                    ? <Loader2 size={14} className="animate-spin" />
                                    : <Star size={14} fill={isFavorited ? 'currentColor' : 'none'} />}
                            </button>
                        )}
                        {onRefresh && (
                            <button
                                type="button"
                                onClick={onRefresh}
                                disabled={isLoading || isStreaming}
                                className={cn(
                                    'p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer',
                                    (isLoading || isStreaming) && 'opacity-50 cursor-not-allowed'
                                )}
                                title={t('forceRefresh')}
                            >
                                <RefreshCw size={14} className={isLoading || isStreaming ? 'animate-spin' : ''} />
                            </button>
                        )}
                    </div>
                </div>

                {/* 滚动区域：释义与例句列表 */}
                <div className="px-4.5 pt-1.5 pb-4 flex-1 overflow-y-auto space-y-4 scrollbar-thin">
                    {hasDefinitions ? (
                        data.definitions.map((def, defIdx) => {
                            const pos = formatPartOfSpeech(def.partOfSpeech);
                            const hasExamples = Array.isArray(def.examples) && def.examples.length > 0;

                            return (
                                <div
                                    key={`def-${defIdx}-${def.meaning}`}
                                    className="select-text space-y-2"
                                >
                                    {/* 词性与释义单行排版 */}
                                    <div className="flex items-baseline gap-2 leading-snug">
                                        {pos && (
                                            <span className="text-xs font-semibold italic text-muted-foreground shrink-0 select-none">
                                                {pos}
                                            </span>
                                        )}
                                        <span className="text-sm text-foreground font-medium">
                                            {def.meaning}
                                        </span>
                                    </div>

                                    {/* 例句原生缩进排版 (例句 14px，译文 13px) */}
                                    {hasExamples && (
                                        <div className="pl-3 border-l-2 border-border/60 space-y-2.5 my-1.5">
                                            {def.examples.map((ex, exIdx) => (
                                                <div key={`ex-${exIdx}-${ex.sentence}`} className="space-y-0.5">
                                                    <div className="text-sm text-foreground/95 font-normal leading-relaxed">
                                                        <Playable>{ex.sentence}</Playable>
                                                    </div>
                                                    {ex.translation && (
                                                        <div className="text-[13px] text-muted-foreground leading-relaxed">
                                                            {ex.translation}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-sm text-muted-foreground/70 select-none py-3">
                            {isStreaming ? (
                                <div className="flex items-center gap-2 text-muted-foreground/60 animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                                    <span>{t('generatingDefinition', { defaultValue: '正在查询释义…' })}</span>
                                </div>
                            ) : (
                                <span>{t('noDefinition', { defaultValue: '暂无释义' })}</span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div
            className={cn(
                'w-[360px] h-[400px] bg-popover text-popover-foreground shadow-lg border border-border/80 rounded-xl overflow-hidden text-left relative flex flex-col',
                className
            )}
        >
            {isLoading && !hasContent ? renderSkeleton() : renderContent()}
        </div>
    );
};

export default OpenAIWordPop;
