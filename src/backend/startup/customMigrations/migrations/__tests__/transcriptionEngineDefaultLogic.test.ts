import { describe, expect, it } from 'vitest';
import { resolveMigratedTranscriptionEngine } from '@/backend/startup/customMigrations/migrations/transcriptionEngineDefaultLogic';

describe('识别引擎默认值迁移', () => {
    it('从未设置过引擎且 sherpa CPU 模型完整时，迁移为 sherpa-onnx 平滑沿用', () => {
        expect(resolveMigratedTranscriptionEngine(false, true)).toBe('sherpa-onnx');
    });

    it('从未设置过引擎且 sherpa 模型不存在时（新用户），不迁移，走 whisper-cpp 新默认', () => {
        expect(resolveMigratedTranscriptionEngine(false, false)).toBeNull();
    });

    it('用户显式设置过引擎时，一律不动，尊重用户选择', () => {
        expect(resolveMigratedTranscriptionEngine(true, true)).toBeNull();
        expect(resolveMigratedTranscriptionEngine(true, false)).toBeNull();
    });
});
