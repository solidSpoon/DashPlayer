import usePlayerController from '../usePlayerController';

let interval: number | null = null;
usePlayerController.subscribe(
    (state) => state.playing,
    (playing) => {
        if (playing) {
            const sync = () => {
                usePlayerController.setState((state) => ({
                    playTime: state.internal.exactPlayTime,
                }));
            };
            sync();
            interval = window.setInterval(sync, 300);
        } else if (interval) {
            window.clearInterval(interval);
            interval = null;
        }
    }
);
