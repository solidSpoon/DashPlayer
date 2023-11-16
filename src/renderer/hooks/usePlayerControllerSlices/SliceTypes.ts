import SentenceT from '../../lib/param/SentenceT';
import { WordLevel } from '../../../db/entity/WordLevel';
import TransHolder from '../../../utils/TransHolder';
import { SentenceStruct } from '../../../types/SentenceStruct';

export interface SubtitleSlice {
    subtitle: SentenceT[];
    subTitlesStructure: Map<string, SentenceStruct>;
    setSubtitle: (subtitle: SentenceT[]) => void;
    mergeSubtitle: (subtitle: SentenceT[]) => void;
    mergeSubtitleTrans: (holder: TransHolder<string>) => void;
    getSubtitleAt: (time: number) => SentenceT | undefined;
}

export interface PlayerControllerInternal {
    lastSeekToOn: number;
    exactPlayTime: number;
    subtitleIndex: Map<number, SentenceT[]>;
    maxIndex: number;
    wordLevel: Map<string, WordLevel>;
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

    setMuted: (muted: boolean) => void;
    setVolume: (volume: number) => void;
    play: () => void;
    pause: () => void;
    space: () => void;
    seekTo: (seekTime: SeekAction | ((prev: SeekAction) => SeekAction)) => void;
    setDuration: (duration: number) => void;
    updateExactPlayTime: (currentTime: number) => void;
    getExactPlayTime: () => number;
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
}

export interface WordLevelSlice {
    getWordLevel: (word: string) => WordLevel | undefined;
    markWordLevel: (word: string, level: number) => Promise<void>;
    syncWordsLevel: (words: string[]) => Promise<void>;
}

export type PopType = 'control' | 'none';

export interface ModeSlice {
    showEn: boolean;
    showCn: boolean;
    singleRepeat: boolean;
    showWordLevel: boolean;
    popType: PopType;

    changeShowEn: () => void;
    changeShowCn: () => void;
    changeShowEnCn: () => void;
    changeSingleRepeat: () => void;
    changeShowWordLevel: () => void;
    changePopType: (popType: PopType) => void;
}

export interface ControllerSlice {
    repeat: () => void;
    next: () => void;
    prev: () => void;
    jump: (target: SentenceT) => void;
}
