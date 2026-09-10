import { describe, expect, it } from 'vitest';
import type SpeechRecognitionGateway from '@/backend/services/gateways/media/SpeechRecognitionGateway';
import { SettingsStore } from '@/backend/services/gateways/SettingsStore';
import { TranscriptionEngineSelectorImpl } from '@/backend/services/TranscriptionEngineSelector';

/**
 * 设置仓库测试替身：内存键值存储，模拟真实 store 的字符串读写语义。
 */
class MemorySettingsStore implements SettingsStore {
    private readonly values = new Map<string, string>();

    public set(key: string, value: string | undefined | null): boolean {
        const previous = this.values.get(key);
        const changed = previous !== value;
        if (value === undefined || value === null) {
            this.values.delete(key);
        } else {
            this.values.set(key, value);
        }
        return changed;
    }

    public get(key: string): string {
        return this.values.get(key) ?? '';
    }
}

/** 记录自身身份的网关测试替身。 */
function gatewayStub(name: string): SpeechRecognitionGateway {
    return {
        transcribe: () => {
            throw new Error('测试替身不执行识别');
        },
        cancelActive: () => {
            throw new Error('测试替身不执行取消');
        },
        // 用于断言路由目标
        toString: () => name,
    } as SpeechRecognitionGateway;
}

/** 构造带固定引擎设置的替换身。 */
function buildStore(engine: string): SettingsStore {
    const store = new MemorySettingsStore();
    store.set('transcription.engine', engine);
    return store;
}

describe('识别引擎选择器', () => {
    it('引擎为 whisper-cpp 时返回 whisper.cpp 网关', () => {
        const sherpa = gatewayStub('sherpa');
        const whisper = gatewayStub('whisper');
        const selector = new TranscriptionEngineSelectorImpl(buildStore('whisper-cpp'), sherpa, whisper);

        expect(selector.select()).toBe(whisper);
        expect(selector.currentEngine()).toBe('whisper-cpp');
    });

    it('引擎为 sherpa-onnx 时返回 sherpa 网关', () => {
        const sherpa = gatewayStub('sherpa');
        const whisper = gatewayStub('whisper');
        const selector = new TranscriptionEngineSelectorImpl(buildStore('sherpa-onnx'), sherpa, whisper);

        expect(selector.select()).toBe(sherpa);
        expect(selector.currentEngine()).toBe('sherpa-onnx');
    });

    it('设置值非法时立即抛错，不静默回退到任一引擎', () => {
        const selector = new TranscriptionEngineSelectorImpl(buildStore('whisper'), gatewayStub('s'), gatewayStub('w'));

        expect(() => selector.select()).toThrow('transcription.engine 非法');
        expect(() => selector.currentEngine()).toThrow('transcription.engine 非法');
    });
});
