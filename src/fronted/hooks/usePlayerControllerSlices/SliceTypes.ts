import SentenceC from '../../../common/types/SentenceC';
import TransHolder from '../../../common/utils/TransHolder';
import { SrtTender } from '@/fronted/lib/SrtTender';

export interface SubtitleSlice {
    subtitle: SentenceC[];
    srtTender: SrtTender | null;
    setSubtitle: (subtitle: SentenceC[]) => void;
    mergeSubtitle: (subtitle: SentenceC[]) => void;
    mergeSubtitleTrans: (holder: TransHolder<string>) => void;
    getSubtitleAround: (index: number, num?: number) => SentenceC[];
}

export interface PlayerControllerInternal {
    lastSeekToOn: number;
    exactPlayTime: number;
    onPlaySeekTime: number | null;
}

export interface InternalSlice {
    internal: PlayerControllerInternal;
}

export interface SeekAction {
    time: number;
}

export interface PlayerSlice {
    playing: boolean;
    muted: boolean;
    volume: number;
    playTime: number;
    duration: number;
    seekTime: SeekAction;
    playbackRate: number;

    setMuted: (muted: boolean) => void;
    setVolume: (volume: number) => void;
    play: () => void;
    pause: () => void;
    space: () => void;
    seekTo: (seekTime: SeekAction | ((prev: SeekAction) => SeekAction)) => void;
    setDuration: (duration: number) => void;
    updateExactPlayTime: (currentTime: number) => void;
    getExactPlayTime: () => number;
    setPlaybackRate: (rate: number) => void;
    nextRate: () => void;
    onPlaySeek: (time: number) => void;
}

export interface SentenceSlice {
    currentSentence: SentenceC | undefined;
    adjustStart: (time: number) => void;
    adjustEnd: (time: number) => void;
    clearAdjust: () => void;
}

export interface ModeSlice {
    showEn: boolean;
    showCn: boolean;
    syncSide: boolean;
    singleRepeat: boolean;
    autoPause: boolean;
    showWordLevel: boolean;

    changeShowEn: () => void;
    changeShowCn: () => void;
    changeShowEnCn: () => void;
    changeSyncSide: () => void;
    changeSingleRepeat: () => void;
    changeShowWordLevel: () => void;
    changeAutoPause: () => void;
}

export interface ControllerSlice {
    repeat: () => void;
    next: () => void;
    prev: () => void;
    jump: (target: SentenceC) => void;
}
