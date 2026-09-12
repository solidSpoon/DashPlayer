import { describe, expect, it } from 'vitest';
import { resolveAiRequestBaseUrl } from '@/common/utils/openai-endpoint';

describe('resolveAiRequestBaseUrl 请求路径解析', () => {
    it('请求路径留空时基础地址原样使用（标准路径）', () => {
        expect(resolveAiRequestBaseUrl('https://api.deepseek.com/v1', '', 'openai'))
            .toBe('https://api.deepseek.com/v1');
    });

    it('openai 格式剥掉 /chat/completions 后缀，剩余版本路径拼回基础地址', () => {
        expect(resolveAiRequestBaseUrl('https://api.foo.com', '/v1/chat/completions', 'openai'))
            .toBe('https://api.foo.com/v1');
    });

    it('anthropic 格式剥掉 /messages 后缀，剩余版本路径拼回基础地址', () => {
        expect(resolveAiRequestBaseUrl('https://api.foo.com', '/v1/messages', 'anthropic'))
            .toBe('https://api.foo.com/v1');
    });

    it('请求路径就是动作本身（无版本路径）时直接用基础地址', () => {
        expect(resolveAiRequestBaseUrl('https://api.foo.com/v1', '/chat/completions', 'openai'))
            .toBe('https://api.foo.com/v1');
    });

    it('请求路径不以 / 开头时显式抛错', () => {
        expect(() => resolveAiRequestBaseUrl('https://api.foo.com', 'v1/messages', 'anthropic'))
            .toThrow(/以 \/ 开头/);
    });

    it('请求路径与 API 类型的动作后缀不匹配时显式抛错', () => {
        expect(() => resolveAiRequestBaseUrl('https://api.foo.com', '/v1/chat/completions', 'anthropic'))
            .toThrow(/不匹配/);
    });

    it('gemini 格式带自定义请求路径时显式抛错', () => {
        expect(() => resolveAiRequestBaseUrl('https://api.foo.com', '/v1beta/models/x:generateContent', 'gemini'))
            .toThrow(/暂不支持自定义/);
    });
});
