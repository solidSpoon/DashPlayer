import { inject, injectable } from 'inversify';
import SpeechRecognitionGateway from '@/backend/services/gateways/media/SpeechRecognitionGateway';
import { SettingsStore } from '@/backend/services/gateways/SettingsStore';
import TYPES from '@/backend/ioc/types';
import { TRANSCRIPTION_ENGINES, type TranscriptionEngine } from '@/common/contracts/transcription-engine';

/**
 * 本地识别引擎选择器的业务契约。
 */
export default interface TranscriptionEngineSelector {
    /**
     * 读取设置选择当前识别引擎对应的网关。
     *
     * 转录任务启动时调用一次并在整个任务期间固定使用同一网关，
     * 避免任务中途切换引擎导致各块时间轴风格不一致。
     *
     * @returns 当前设置对应的识别网关；设置值非法时立即抛错。
     */
    select(): SpeechRecognitionGateway;

    /**
     * 读取当前设置的识别引擎。
     * @returns 当前引擎；设置值非法时立即抛错。
     */
    currentEngine(): TranscriptionEngine;
}

/**
 * 按设置项 `transcription.engine` 在 sherpa-onnx 与 whisper.cpp 网关间路由。
 */
@injectable()
export class TranscriptionEngineSelectorImpl implements TranscriptionEngineSelector {
    constructor(
        @inject(TYPES.SettingsStore) private readonly settingsStore: SettingsStore,
        @inject(TYPES.SherpaOnnxGateway) private readonly sherpaGateway: SpeechRecognitionGateway,
        @inject(TYPES.WhisperCppGateway) private readonly whisperCppGateway: SpeechRecognitionGateway,
    ) {}

    /**
     * 读取设置选择当前识别引擎对应的网关。
     * @returns 当前设置对应的识别网关；设置值非法时立即抛错。
     */
    public select(): SpeechRecognitionGateway {
        return this.currentEngine() === 'whisper-cpp' ? this.whisperCppGateway : this.sherpaGateway;
    }

    /**
     * 读取当前设置的识别引擎。
     * @returns 当前引擎；设置值非法时立即抛错。
     */
    public currentEngine(): TranscriptionEngine {
        const value = this.settingsStore.get('transcription.engine');
        if (!(TRANSCRIPTION_ENGINES as readonly string[]).includes(value)) {
            throw new Error(`设置项 transcription.engine 非法: ${value}`);
        }
        return value as TranscriptionEngine;
    }
}
