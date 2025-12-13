export interface ModelFileStatusVO {
    exists: boolean;
    path: string;
}

export type KokoroModelVariant = 'quantized' | 'fp32';

export interface TtsModelStatusVO {
    modelsRoot: string;
    echogardenHomeDir: string;
    echogardenPackagesDir: string;
    kokoro: {
        voices: ModelFileStatusVO;
        quantized: ModelFileStatusVO;
        fp32: ModelFileStatusVO;
    };
}

