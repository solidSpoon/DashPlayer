import {cn} from "@/fronted/lib/utils";
import PlayerSubtitle from "@/fronted/components/playerSubtitle/PlayerSubtitle";
import PlayerSubtitleControlPanel from "@/fronted/components/playerSubtitle/PlayerSubtitleControlPannel";
import usePlayerController from "@/fronted/hooks/usePlayerController";
import {useShallow} from "zustand/react/shallow";


const PlayerSubtitlePanel = () => {
    const {
        playing,
        play,
        pause,
        seekTo

    } = usePlayerController(
        useShallow((state) => ({
            playing: state.playing,
            play: state.play,
            pause: state.pause,
            seekTo: state.seekTo,
        }))
    );
    return (
        <div className={cn('w-full h-full absolute top-0 left-0 z-10 flex flex-col justify-end items-center')}>
            <PlayerSubtitle/>
            <PlayerSubtitleControlPanel
                onTimeChange={(time) => {
                    seekTo({time});
                }}
                onPause={() => {
                    pause();
                }}
                onPlay={() => {
                    play();
                }}
                playing={playing}
            />
        </div>
    )
}

export default PlayerSubtitlePanel;
