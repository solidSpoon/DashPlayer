export type WhisperModelSize = 'base' | 'large';
export type WhisperVadModel = 'silero-v5.1.2' | 'silero-v6.2.0';

export type WhisperModelStatusVO = {
    modelsRoot: string;
    whisper: {
        base: { exists: boolean; path: string };
        large: { exists: boolean; path: string };
    };
    vad: {
        'silero-v5.1.2': { exists: boolean; path: string };
        'silero-v6.2.0': { exists: boolean; path: string };
    };
};

