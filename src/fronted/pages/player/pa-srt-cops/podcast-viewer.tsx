import React from 'react';
import { cn } from '@/fronted/lib/utils';
import { usePlayerV2 } from '@/fronted/hooks/usePlayerV2';
import { playerV2Actions } from '@/fronted/components/player-components';
import usePlayerUi from '@/fronted/hooks/usePlayerUi';
import { Sentence } from '@/common/types/SentenceC';
import TranslatableLinePodcast from '@/fronted/pages/player/pa-srt-cops/translatable-line-podcast';
import ViewerControlPanel from '@/fronted/pages/player/subtitle-viewer/viewer-control-panel';
import StrUtil from '@/common/utils/str-util';
import FuncUtil from '@/common/utils/func-util';
import useTranslation from '@/fronted/hooks/useTranslation';

const PodcastViewer = ({ className }: { className?: string }) => {
    const current: Sentence | null = usePlayerV2((s) => s.currentSentence);
    const sentences = usePlayerV2((s) => s.sentences);

    const surrounding = (() => {
        if (!current) {
            return { previous: [] as Sentence[], next: [] as Sentence[] };
        }
        const idx = sentences.findIndex((x) => x.index === current.index && x.fileHash === current.fileHash);
        if (idx === -1) {
            return { previous: [] as Sentence[], next: [] as Sentence[] };
        }

        const MAX_AROUND = 2;
        const previous: Sentence[] = [];
        const next: Sentence[] = [];

        for (let i = Math.max(0, idx - MAX_AROUND); i < idx; i += 1) {
            previous.push(sentences[i]);
        }
        for (let i = idx + 1; i <= Math.min(sentences.length - 1, idx + MAX_AROUND); i += 1) {
            next.push(sentences[i]);
        }

        return { previous, next };
    })();

    const translationKey = current?.translationKey || '';
    const newTranslation = useTranslation(state => state.translations.get(translationKey)) || '';

    const showCn = usePlayerUi(s => s.showCn);
    const srtTender = usePlayerV2(s => s.srtTender);
    const clearAdjust = () => { void playerV2Actions.clearAdjust(); };
    if (!current || !srtTender) {
        return <div className={cn('relative flex h-full w-full items-center justify-center overflow-hidden rounded-none bg-stone-100 dark:bg-neutral-900', className)} />;
    }
    return (
        <div className={cn('relative flex h-full w-full items-center justify-center overflow-hidden rounded-none bg-stone-100 dark:bg-neutral-900', className)}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-stone-100 via-stone-100/80 to-transparent dark:from-neutral-900 dark:via-neutral-900/70" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-stone-100 via-stone-100/80 to-transparent dark:from-neutral-900 dark:via-neutral-900/70" />

            <div className="relative flex w-full max-w-5xl flex-col items-center gap-8 px-6 py-12 text-foreground/80">
                <div className="flex w-full flex-col items-center gap-4 text-foreground/50">
                    {surrounding.previous.map((sentence) => (
                        <TranslatableLinePodcast
                            key={sentence.key}
                            sentence={sentence}
                            adjusted={false}
                            clearAdjust={FuncUtil.blank}
                            className={cn('text-2xl font-medium text-foreground/60 transition-colors')}
                        />
                    ))}
                </div>

                <div className="w-full rounded-3xl border border-stone-200/70 bg-white/70 p-10 shadow-xl shadow-stone-200/40 backdrop-blur-md transition-colors dark:border-neutral-700/60 dark:bg-neutral-800/85 dark:shadow-black/40">
                    <div className="flex flex-col items-center gap-6 text-center text-foreground">
                        <TranslatableLinePodcast
                            className={cn('text-4xl font-semibold')}
                            adjusted={srtTender.adjusted(current) ?? false}
                            clearAdjust={clearAdjust}
                            sentence={current}
                        />
                        {showCn && !StrUtil.isBlank(newTranslation) && (
                            <div className="text-2xl text-foreground/80 dark:text-neutral-200">{newTranslation}</div>
                        )}
                        {showCn && !StrUtil.isBlank(current?.textZH) && (
                            <div className="text-xl text-foreground/70 dark:text-neutral-300">{current?.textZH}</div>
                        )}
                    </div>
                </div>

                <div className="flex w-full flex-col items-center gap-4 text-foreground/70">
                    {surrounding.next.map((sentence) => (
                        <TranslatableLinePodcast
                            key={sentence.key}
                            sentence={sentence}
                            adjusted={false}
                            clearAdjust={FuncUtil.blank}
                            className={cn('text-3xl font-medium text-foreground/75')}
                        />
                    ))}
                </div>
            </div>

            <ViewerControlPanel className="absolute left-0 bottom-0" />
        </div>
    );

};
export default PodcastViewer;

PodcastViewer.defaultProps = {
    className: ''
};
