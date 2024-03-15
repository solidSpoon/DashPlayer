import {cn} from "@/fronted/lib/utils";
import usePlayerController from "@/fronted/hooks/usePlayerController";
import SentenceT from "@/common/types/SentenceT";
import ViewerTranslableLine from "@/fronted/components/subtitle-viewer/viewer-translable-line";
import {strBlank} from "@/common/utils/Util";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/fronted/components/ui/card";
import useFile from "@/fronted/hooks/useFile";
import ViewerControlPannel from "@/fronted/components/subtitle-viewer/viewer-control-pannel";
import {useShallow} from "zustand/react/shallow";

const SubtitleViewer = ({className}: { className?: string }) => {
    const current: SentenceT = usePlayerController((s) => s.currentSentence);
    const subtitleAround: SentenceT[] = usePlayerController.getState().getSubtitleAround(current?.index ?? 0);
    const subtitleBefore: SentenceT[] = subtitleAround.filter((s) => s.index < current.index).sort((a, b) => b.index - a.index);
    const subtitleAfter: SentenceT[] = subtitleAround.filter((s) => s.index > current.index).sort((a, b) => a.index - b.index)
    const fileName = useFile(s=>s.videoFile.fileName);
    const {
        playing,
        play,
        pause,
        seekTo

    } = usePlayerController(
        useShallow((state) => ({
            playing: state.playing,
            muted: state.muted,
            volume: state.volume,
            play: state.play,
            pause: state.pause,
            seekTime: state.seekTime,
            updateExactPlayTime: state.updateExactPlayTime,
            setDuration: state.setDuration,
            seekTo: state.seekTo,
            playbackRate: state.playbackRate,
        }))
    );

    return (
        <Card
            className={cn('w-full h-full overflow-hidden p-2 rounded-none relative', className)}
        >
            <CardHeader>
                <CardTitle>
                    Transcription
                </CardTitle>
                <CardDescription>
                    {fileName}
                </CardDescription>
            </CardHeader>
            <CardContent>

                <div className={cn('w-full h-full overflow-hidden grid rounded bg-stone-100')}
                     style={{
                         gridTemplateRows: '20% 80%'
                     }}
                >
                    <div
                        className={cn('flex flex-col-reverse items-center justify-start gap-10 text-foreground/50 bg-stone-100 overflow-hidden')}>
                        {
                            subtitleBefore.map((s) => (
                                <ViewerTranslableLine
                                    adjusted={false} clearAdjust={() => {
                                }}
                                    key={s.key} className={cn('text-3xl')}
                                    text={s.text ?? ''}
                                />
                            ))
                        }
                    </div>
                    <div
                        className={cn(' flex flex-col items-center justify-start gap-10 bg-stone-100 overflow-hidden')}
                    >

                        <div
                            className={cn('py-20 w-full flex flex-col mt-10 items-center justify-center gap-10',
                                'bg-white'
                            )}
                        >
                            <ViewerTranslableLine
                                className={cn('text-4xl')}
                                adjusted={false} clearAdjust={() => {
                            }}
                                text={current?.text ?? ''}
                            />
                            {!strBlank(current?.msTranslate) && <div className={cn('text-3xl text-foreground')}>
                                {current?.msTranslate}
                            </div>}
                            {!strBlank(current?.textZH) && <div className={cn('text-2xl text-foreground/85')}>
                                {current?.textZH}
                            </div>}
                        </div>
                        {
                            subtitleAfter.map((s) => (
                                <ViewerTranslableLine
                                    text={s.text ?? ''}
                                    adjusted={false} clearAdjust={() => {
                                }}
                                    key={s.key} className={cn('text-3xl text-foreground/75')}/>

                            ))
                        }
                    </div>
                </div>
                <ViewerControlPannel

                    className={'absolute left-0 bottom-0'}/>
            </CardContent>
        </Card>
    );

}
export default SubtitleViewer;

SubtitleViewer.defaultProps = {
    className: ''
}
