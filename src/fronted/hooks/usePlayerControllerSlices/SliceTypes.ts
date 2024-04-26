import SentenceC from '../../../common/types/SentenceC';
import TransHolder from '../../../common/utils/TransHolder';
import { SentenceStruct } from '@/common/types/SentenceStruct';

export interface SubtitleSlice {
    subtitle: SentenceC[];
    setSubtitle: (subtitle: SentenceC[]) => void;
    mergeSubtitle: (subtitle: SentenceC[]) => void;
    mergeSubtitleTrans: (holder: TransHolder<string>) => void;
    getSubtitleAt: (time: number) => SentenceC | undefined;
    getSubtitleAround: (index: number, num?: number) => SentenceC[];
}

export interface PlayerControllerInternal {
    lastSeekToOn: number;
    exactPlayTime: number;
    subtitleIndex: Map<number, SentenceC[]>;
    maxIndex: number;
    // wordLevel: Map<string, WrodLevelRes>;
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
    // rateStack: number[];

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
}

export interface SentenceSlice {
    currentSentence: SentenceC | undefined;
    setCurrentSentence: (
        sentence:
            | SentenceC
            | undefined
            | ((prev: SentenceC | undefined) => SentenceC | undefined)
    ) => void;
    tryUpdateCurrentSentence: () => void;
    adjustStart: (time: number) => void;
    adjustEnd: (time: number) => void;
    clearAdjust: () => void;
}

export interface WordLevelSlice {
    // getWordLevel: (word: string) => WordLevelRes | undefined;
    markWordLevel: (word: string, familiar: boolean) => Promise<void>;
    syncWordsLevel: (words: string[]) => Promise<void>;
}


export interface ModeSlice {
    showEn: boolean;
    showCn: boolean;
    singleRepeat: boolean;
    showWordLevel: boolean;

    changeShowEn: () => void;
    changeShowCn: () => void;
    changeShowEnCn: () => void;
    changeSingleRepeat: () => void;
    changeShowWordLevel: () => void;
}

export interface ControllerSlice {
    repeat: () => void;
    next: () => void;
    prev: () => void;
    jump: (target: SentenceC) => void;
}
