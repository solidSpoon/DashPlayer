import { describe, expect, it } from 'vitest';
import {
    MissingProxyUrlError,
    proxyConfigKey,
    resolveProxyConfig,
} from '@/backend/application/kernel/proxy/ProxyConfigResolver';

describe('代理模式到 Electron 配置的映射', () => {
    it('none 映射为直连', () => {
        expect(resolveProxyConfig({ mode: 'none', url: 'http://ignored:1', bypassRules: 'ignored' })).toEqual({
            mode: 'direct',
        });
    });

    it('system 映射为裸 system 模式', () => {
        expect(resolveProxyConfig({ mode: 'system', url: '', bypassRules: '' })).toEqual({ mode: 'system' });
    });

    it('custom 带 URL 时映射为 fixed_servers', () => {
        expect(resolveProxyConfig({ mode: 'custom', url: 'http://127.0.0.1:7890', bypassRules: '*.local' })).toEqual({
            mode: 'fixed_servers',
            proxyRules: 'http://127.0.0.1:7890',
            proxyBypassRules: '*.local',
        });
    });

    it('custom 带 URL 但 bypass 为空时不传 bypass 字段', () => {
        expect(resolveProxyConfig({ mode: 'custom', url: 'http://127.0.0.1:7890', bypassRules: '' })).toEqual({
            mode: 'fixed_servers',
            proxyRules: 'http://127.0.0.1:7890',
            proxyBypassRules: undefined,
        });
    });

    it('custom 去掉 URL 首尾空白', () => {
        expect(resolveProxyConfig({ mode: 'custom', url: '  http://127.0.0.1:7890  ', bypassRules: '' })).toEqual({
            mode: 'fixed_servers',
            proxyRules: 'http://127.0.0.1:7890',
            proxyBypassRules: undefined,
        });
    });

    it('custom 且 URL 为空时抛出 MissingProxyUrlError', () => {
        expect(() => resolveProxyConfig({ mode: 'custom', url: '', bypassRules: '' })).toThrow(MissingProxyUrlError);
        expect(() => resolveProxyConfig({ mode: 'custom', url: '   ', bypassRules: '' })).toThrow(MissingProxyUrlError);
    });
});

describe('代理配置指纹', () => {
    it('等价配置生成相同指纹', () => {
        const a = proxyConfigKey({ mode: 'fixed_servers', proxyRules: 'http://x', proxyBypassRules: 'y' });
        const b = proxyConfigKey({ mode: 'fixed_servers', proxyRules: 'http://x', proxyBypassRules: 'y' });
        expect(a).toBe(b);
    });

    it('不同配置生成不同指纹', () => {
        const a = proxyConfigKey({ mode: 'fixed_servers', proxyRules: 'http://x', proxyBypassRules: 'y' });
        const b = proxyConfigKey({ mode: 'fixed_servers', proxyRules: 'http://z', proxyBypassRules: 'y' });
        expect(a).not.toBe(b);
    });
});
