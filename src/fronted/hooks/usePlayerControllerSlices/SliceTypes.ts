import SentenceT from '../../../common/types/SentenceT';
import TransHolder from '../../../common/utils/TransHolder';
import { SentenceStruct } from '@/common/types/SentenceStruct';

export interface SubtitleSlice {
    subtitle: SentenceT[];
    subTitlesStructure: Map<string, SentenceStruct>;
    setSubtitle: (subtitle: SentenceT[]) => void;
    mergeSubtitle: (subtitle: SentenceT[]) => void;
    mergeSubtitleTrans: (holder: TransHolder<string>) => void;
    getSubtitleAt: (time: number) => SentenceT | undefined;
    getSubtitleAround: (index: number, num?: number) => SentenceT[];
}

export interface PlayerControllerInternal {
    lastSeekToOn: number;
    exactPlayTime: number;
    subtitleIndex: Map<number, SentenceT[]>;
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
    currentSentence: SentenceT | undefined;
    setCurrentSentence: (
        sentence:
            | SentenceT
            | undefined
            | ((prev: SentenceT | undefined) => SentenceT | undefined)
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
    jump: (target: SentenceT) => void;
}
