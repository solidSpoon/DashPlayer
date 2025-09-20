import { cn } from '@/fronted/lib/utils';
import usePlayerController from '@/fronted/hooks/usePlayerController';
import { Sentence } from '@/common/types/SentenceC';
import TranslatableLinePodcast from '@/fronted/pages/player/pa-srt-cops/translatable-line-podcast';
import ViewerControlPanel from '@/fronted/pages/player/subtitle-viewer/viewer-control-panel';
import { useShallow } from 'zustand/react/shallow';
import StrUtil from '@/common/utils/str-util';
import FuncUtil from '@/common/utils/func-util';
import useTranslation from '@/fronted/hooks/useTranslation';

const PodcastViewer = ({ className }: { className?: string }) => {
    const current: Sentence | undefined = usePlayerController((s) => s.currentSentence);
    const subtitleAround: Sentence[] = usePlayerController.getState().getSubtitleAround(current?.index ?? 0);
    const currentIndex = current?.index ?? 0;
    const subtitleBefore: Sentence[] = subtitleAround.filter((s) => s.index < currentIndex).sort((a, b) => b.index - a.index);
    const subtitleAfter: Sentence[] = subtitleAround.filter((s) => s.index > currentIndex).sort((a, b) => a.index - b.index);

    const translationKey = current?.translationKey || '';
    const newTranslation = useTranslation(state => state.translations.get(translationKey)) || '';

    const showCn = usePlayerController(s => s.showCn);
    const srtTender = usePlayerController(s => s.srtTender);
    const { clearAdjust } = usePlayerController(useShallow(s => ({
        clearAdjust: s.clearAdjust
    })));
    if (!current || !srtTender) {
        return <div className={cn('w-full h-full relative overflow-hidden rounded-none bg-stone-100 dark:bg-neutral-800', className)} />;
    }
    return (
        <div
            className={cn('w-full h-full relative overflow-hidden rounded-none bg-stone-100 dark:bg-neutral-800', className)}
        >
            <div className={cn('w-full h-full overflow-hidden grid grid-cols-1 bg-stone-100 dark:bg-neutral-800')}
                 style={{
                     gridTemplateRows: '15% 15% 55% 15%'
                 }}
            >
                <div
                    className={cn('row-start-1 row-end-3 col-start-1 col-end-2 flex flex-col-reverse items-center justify-start gap-10 text-foreground/50 overflow-hidden pb-8')}>
                    {
                        subtitleBefore.map((s) => (
                            <TranslatableLinePodcast
                                adjusted={false} clearAdjust={FuncUtil.blank}
                                key={s.key} className={cn('text-3xl')}
                                sentence={s}
                            />
                        ))
                    }
                </div>
                <div
                    className={cn('row-start-3 row-end-5 col-start-1 col-end-2 flex flex-col items-center justify-start gap-10 overflow-hidden')}
                >

                    <div
                        className={cn('py-20 w-full flex flex-col items-center justify-center gap-10',
                            'bg-stone-50 dark:bg-neutral-700 text-foreground/80 border-8 rounded-2xl border-stone-100 dark:border-neutral-800'
                        )}
                    >
                        <TranslatableLinePodcast
                            className={cn('text-4xl')}
                            adjusted={srtTender.adjusted(current) ?? false} clearAdjust={clearAdjust}
                            sentence={current}
                        />
                        {!StrUtil.isBlank(newTranslation) && showCn && <div className={cn('text-3xl text-center')}>
                            {newTranslation}
                        </div>}
                        {!StrUtil.isBlank(current?.textZH) && showCn && <div className={cn('text-2xl text-center')}>
                            {current?.textZH}
                        </div>}
                    </div>
                    {
                        subtitleAfter.map((s) => (
                            <TranslatableLinePodcast
                                sentence={s}
                                adjusted={false} clearAdjust={FuncUtil.blank}
                                key={s.key} className={cn('text-3xl text-foreground/75')} />

                        ))
                    }
                </div>
                <div className={cn('w-full row-start-1 row-end-2 col-start-1 col-end-2',
                    'bg-gradient-to-t from-transparent to-stone-100 dark:from-transparent dark:to-neutral-800'
                )}></div>
                <div className={cn('w-full row-start-4 row-end-5 col-start-1 col-end-2',
                    'bg-gradient-to-b from-transparent to-stone-100 dark:from-transparent dark:to-neutral-800'
                )}></div>
            </div>
            <ViewerControlPanel

                className={'absolute left-0 bottom-0'} />
            {/* </CardContent> */}
        </div>
    );

};
export default PodcastViewer;

PodcastViewer.defaultProps = {
    className: ''
};
