import { describe, expect, it } from 'vitest';
import { parseMacScutil, parseWindowsReg } from '@/backend/infrastructure/system/proxy/readSystemProxy';

describe('macOS scutil 输出解析', () => {
    it('解析 HTTP-only 配置', () => {
        const output = `
<dictionary> {
    HTTPEnable : 1
    HTTPPort : 7890
    HTTPProxy : 127.0.0.1
    HTTPSEnable : 0
}`;
        expect(parseMacScutil(output)).toEqual({
            proxyUrl: 'http://127.0.0.1:7890',
            noProxy: [],
        });
    });

    it('解析 HTTPS-only 配置，不使用未启用的 HTTP 字段', () => {
        const output = `
<dictionary> {
    HTTPEnable : 0
    HTTPSEnable : 1
    HTTPSPort : 8443
    HTTPSProxy : 10.0.0.5
}`;
        expect(parseMacScutil(output)).toEqual({
            proxyUrl: 'http://10.0.0.5:8443',
            noProxy: [],
        });
    });

    it('HTTPS 与 HTTP 同时启用时优先取 HTTPS 条目', () => {
        const output = `
<dictionary> {
    HTTPEnable : 1
    HTTPPort : 7890
    HTTPProxy : 127.0.0.1
    HTTPSEnable : 1
    HTTPSPort : 8443
    HTTPSProxy : 10.0.0.5
}`;
        expect(parseMacScutil(output)).toEqual({
            proxyUrl: 'http://10.0.0.5:8443',
            noProxy: [],
        });
    });

    it('解析 ExceptionsList 嵌套数组为 noProxy 列表', () => {
        const output = `
<dictionary> {
    ExceptionsList : <array> {
        0 : localhost
        1 : 127.0.0.1
        2 : *.local
    }
    HTTPEnable : 1
    HTTPPort : 7890
    HTTPProxy : 127.0.0.1
}`;
        expect(parseMacScutil(output)).toEqual({
            proxyUrl: 'http://127.0.0.1:7890',
            noProxy: ['localhost', '127.0.0.1', '*.local'],
        });
    });

    it('全部未启用时返回 null', () => {
        const output = `
<dictionary> {
    HTTPEnable : 0
    HTTPSEnable : 0
}`;
        expect(parseMacScutil(output)).toBeNull();
    });

    it('启用但缺少地址字段时返回 null，而不是拼出无效 URL', () => {
        const output = `
<dictionary> {
    HTTPEnable : 1
    HTTPSEnable : 0
}`;
        expect(parseMacScutil(output)).toBeNull();
    });
});

describe('Windows reg query 输出解析', () => {
    it('解析启用的代理配置', () => {
        const output = `
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings
    ProxyEnable    REG_DWORD    0x1
    ProxyServer    REG_SZ    http://127.0.0.1:7890
    ProxyOverride    REG_SZ    localhost;<local>
`;
        expect(parseWindowsReg(output)).toEqual({
            proxyUrl: 'http://127.0.0.1:7890',
            noProxy: ['localhost', '<local>'],
        });
    });

    it('ProxyServer 不带协议时补全 http://', () => {
        const output = `
    ProxyEnable    REG_DWORD    0x1
    ProxyServer    REG_SZ    127.0.0.1:7890
`;
        expect(parseWindowsReg(output)).toEqual({
            proxyUrl: 'http://127.0.0.1:7890',
            noProxy: [],
        });
    });

    it('ProxyServer 带分号多协议时取第一个', () => {
        const output = `
    ProxyEnable    REG_DWORD    0x1
    ProxyServer    REG_SZ    http=127.0.0.1:8080;https=127.0.0.1:8443
`;
        expect(parseWindowsReg(output)).toEqual({
            proxyUrl: 'http://127.0.0.1:8080',
            noProxy: [],
        });
    });

    it('未启用时返回 null', () => {
        const output = `
    ProxyEnable    REG_DWORD    0x0
    ProxyServer    REG_SZ    http://127.0.0.1:7890
`;
        expect(parseWindowsReg(output)).toBeNull();
    });
});
