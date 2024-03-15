import {cn} from "@/fronted/lib/utils";
import usePlayerController from "@/fronted/hooks/usePlayerController";
import SentenceT from "@/common/types/SentenceT";

const SubtitleViewer = ({className}: { className?: string }) => {
    const current: SentenceT = usePlayerController((s) => s.currentSentence);
    const subtitleAround:SentenceT[] = usePlayerController.getState().getSubtitleAround(current?.index??0);
    const subtitleBefore:SentenceT[] = subtitleAround.filter((s) => s.index < current.index).sort((a, b) => b.index - a.index);
    const subtitleAfter:SentenceT[] = subtitleAround.filter((s) => s.index > current.index).sort((a, b) => a.index - b.index)


    return (
        <div className={cn('w-full h-full overflow-hidden grid', className)}
        style={{
            gridTemplateRows: '30% 70%'
        }}
        >
            <div className={cn('bg-white flex flex-col-reverse items-center justify-start gap-10 text-foreground/50')}>
                {
                    subtitleBefore.map((s) => (
                        <div key={s.key} className={cn('text-3xl')}>
                            {s.text}
                        </div>
                    ))
                }
            </div>
            <div
            className={cn('bg-white flex flex-col items-center justify-start gap-10')}
            >
                <div className={cn('text-5xl py-20')}>
                    {current.text}
                </div>
                {
                    subtitleAfter.map((s) => (
                        <div key={s.key} className={cn('text-3xl text-foreground/75')}>
                            {s.text}
                        </div>
                    ))
                }
            </div>
        </div>
    );

}
export default SubtitleViewer;

SubtitleViewer.defaultProps = {
    className: ''
}
