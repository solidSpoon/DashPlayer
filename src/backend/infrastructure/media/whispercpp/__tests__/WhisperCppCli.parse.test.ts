import { describe, expect, it, vi } from 'vitest';
import { detectGpuFallback, parseWhisperCppOutput } from '@/backend/infrastructure/media/whispercpp/WhisperCppCli';

// 日志与运行时路径是系统边界：模块加载期会触达 Electron app，测试中静音并替换。
vi.mock('@/backend/infrastructure/logger', () => ({
    getMainLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));
vi.mock('@/backend/utils/runtimeEnv', () => ({
    getRuntimeResourcePath: vi.fn(() => '/fake/parakeet-cli'),
}));

/** jfk.wav 真实识别输出的节选（stdout 文本 + stderr 混合日志），随二进制版本固定作为解析契约。 */
const JFK_STDOUT = 'And so, my fellow Americans, ask not what your country can do for you, ask what you can do for your country.\n';

const JFK_STDERR = [
    'Loading Parakeet model from: /models/ggml-parakeet-tdt-0.6b-v3-q8_0.bin',
    'parakeet_init_with_params_no_state: use gpu    = 1',
    'parakeet_model_load: arch                   = Parakeet TDT',
    'parakeet_decode: starting decode with n_frames=138',
    'Segments (1):',
    'Segment 0: [0 -> 1101] "And so, my fellow Americans, ask not what your country can do for you, ask what you can do for your country."',
    '  [ 0] id= 1976 frame=  3 dur_idx= 4 dur_val= 4 p=0.9996 plog=-0.0004 t0=  24 t1=  56 word_start=true "▁And"',
    '  [ 1] id=  547 frame=  7 dur_idx= 4 dur_val= 4 p=0.9999 plog=-0.0001 t0=  56 t1=  88 word_start=true "▁so"',
    '  [ 2] id= 7877 frame= 11 dur_idx= 2 dur_val= 2 p=0.8520 plog=-0.1601 t0=  88 t1=  88 word_start=false ","',
    'parakeet_print_timings:   encode time =   860.05 ms /     1 runs',
].join('\n');

describe('whisper.cpp 输出解析', () => {
    it('从 stdout 与 stderr 中解析出识别文本与子词时间轴', () => {
        const result = parseWhisperCppOutput(JFK_STDOUT, JFK_STDERR);

        expect(result.text).toBe(JFK_STDOUT.trim());
        expect(result.tokens).toEqual([
            { text: ' And', start: 0.24 },
            { text: ' so', start: 0.56 },
            { text: ',', start: 0.88 },
        ]);
    });

    it('时间戳按 10ms 单位换算为秒', () => {
        const result = parseWhisperCppOutput('text', '  [37] id= 7883 frame=132 dur_idx= 4 dur_val= 4 p=0.9600 plog=-0.0408 t0=1056 t1=1056 word_start=false "."');

        expect(result.tokens[0].start).toBe(10.56);
    });

    it('没有识别文本时抛错并带出日志尾部', () => {
        expect(() => parseWhisperCppOutput('\n', JFK_STDERR)).toThrow('whisper.cpp 未返回识别文本');
    });

    it('没有任何 token 时间轴时抛错', () => {
        expect(() => parseWhisperCppOutput(JFK_STDOUT, 'parakeet_decode: starting decode')).toThrow('whisper.cpp 未返回 token 时间轴');
    });

    it('token 时间戳非法（结束早于开始）时抛错', () => {
        const stderr = '  [ 0] id= 1976 frame=  3 dur_idx= 4 dur_val= 4 p=1.0000 plog=-0.0000 t0=  56 t1=  24 word_start=true "▁And"';

        expect(() => parseWhisperCppOutput('text', stderr)).toThrow('非法时间戳');
    });

    it('token 时间轴不是单调递增时抛错', () => {
        const stderr = [
            '  [ 0] id= 1976 frame=  3 dur_idx= 4 dur_val= 4 p=1.0000 plog=-0.0000 t0=  56 t1=  88 word_start=true "▁And"',
            '  [ 1] id=  547 frame=  7 dur_idx= 4 dur_val= 4 p=0.9999 plog=-0.0001 t0=  24 t1=  56 word_start=true "▁so"',
        ].join('\n');

        expect(() => parseWhisperCppOutput('text', stderr)).toThrow('单调递增');
    });

    it('token 文本去掉子词前缀符号并保留词间空格', () => {
        const stderr = '  [ 0] id=  100 frame=  3 dur_idx= 1 dur_val= 1 p=1.0000 plog=-0.0000 t0=   0 t1=  10 word_start=true "▁hello"';

        const result = parseWhisperCppOutput('hello', stderr);

        expect(result.tokens[0].text).toBe(' hello');
    });

    it('单独成 token 的空格标记被跳过，不影响整段解析', () => {
        const stderr = [
            '  [357] id= 1234 frame=670 dur_idx= 1 dur_val= 1 p=0.9900 plog=-1.0000 t0=5368 t1=5376 word_start=true "▁He"',
            '  [358] id= 7863 frame=672 dur_idx= 1 dur_val= 1 p=0.9934 plog=-10.2057 t0=5376 t1=5384 word_start=true "▁"',
            '  [359] id=  547 frame=674 dur_idx= 1 dur_val= 1 p=0.9800 plog=-0.2000 t0=5384 t1=5400 word_start=true "▁said"',
        ].join('\n');

        const result = parseWhisperCppOutput('He said', stderr);

        expect(result.tokens).toEqual([
            { text: ' He', start: 53.68 },
            { text: ' said', start: 53.84 },
        ]);
    });
});

describe('核显回退检测', () => {
    it('stderr 含 no GPU found 标记时判定为 CPU 回退', () => {
        const stderr = [
            'parakeet_init_with_params_no_state: use gpu    = 1',
            'parakeet_backend_init_gpu: device 0: CPU (type: 0)',
            'parakeet_backend_init_gpu: no GPU found',
        ].join('\n');

        expect(detectGpuFallback(stderr)).toBe(true);
    });

    it('stderr 含设备初始化失败标记时判定为 CPU 回退', () => {
        const stderr = 'parakeet_backend_init_gpu: failed to initialize Vulkan0 backend';

        expect(detectGpuFallback(stderr)).toBe(true);
    });

    it('正常核显运行的 stderr 不误判', () => {
        // 摘自真实核显运行（Intel 核显 + Mesa Vulkan）的初始化日志
        const stderr = [
            'ggml_vulkan: Found 1 Vulkan devices:',
            'ggml_vulkan: 0 = Intel(R) Graphics (LNL) (Intel open-source Mesa driver) | uma: 1 | fp16: 1',
            'parakeet_init_with_params_no_state: devices    = 2',
            'parakeet_backend_init_gpu: found GPU device 0: Vulkan0 (type: 2, cnt: 0)',
            'parakeet_backend_init_gpu: using Vulkan0 backend',
        ].join('\n');

        expect(detectGpuFallback(stderr)).toBe(false);
    });

    it('其他模块的初始化失败日志不误判为核显回退', () => {
        const stderr = 'parakeet_backend_init: failed to initialize ACCEL backend';

        expect(detectGpuFallback(stderr)).toBe(false);
    });
});
