import { describe, expect, it } from 'vitest';
import { createProxyBypassMatcher, parseProxyBypassRule } from '@/backend/application/kernel/proxy/ProxyBypassMatcher';

describe('直连规则解析', () => {
    it('解析 <local> 为本地规则', () => {
        expect(parseProxyBypassRule('<local>')).toEqual({ type: 'local' });
    });

    it('解析精确域名', () => {
        expect(parseProxyBypassRule('example.com')).toEqual({
            type: 'domain',
            domain: 'example.com',
            matchSubdomains: false,
        });
    });

    it('解析 *. 开头为子域匹配规则', () => {
        expect(parseProxyBypassRule('*.example.com')).toEqual({
            type: 'domain',
            domain: 'example.com',
            matchSubdomains: true,
        });
    });

    it('解析 . 开头为子域匹配规则', () => {
        expect(parseProxyBypassRule('.example.com')).toEqual({
            type: 'domain',
            domain: 'example.com',
            matchSubdomains: true,
        });
    });

    it('解析具体 IP', () => {
        expect(parseProxyBypassRule('192.168.1.1')).toEqual({
            type: 'ip',
            ip: '192.168.1.1',
        });
    });

    it('解析 IP 通配符', () => {
        const parsed = parseProxyBypassRule('192.168.1.*');
        expect(parsed?.type).toBe('ipWildcard');
        if (parsed?.type === 'ipWildcard') {
            expect(parsed.regex.test('192.168.1.50')).toBe(true);
        }
    });

    it('解析 CIDR', () => {
        const parsed = parseProxyBypassRule('10.0.0.0/8');
        expect(parsed?.type).toBe('cidr');
    });

    it('解析带端口的规则', () => {
        const parsed = parseProxyBypassRule('example.com:8080');
        expect(parsed?.type).toBe('domain');
        if (parsed?.type === 'domain') {
            expect(parsed.port).toBe('8080');
        }
    });

    it('跳过空白与非法规则', () => {
        expect(parseProxyBypassRule('   ')).toBeNull();
        expect(parseProxyBypassRule('')).toBeNull();
    });
});

describe('直连规则匹配', () => {
    const matcher = createProxyBypassMatcher([
        'localhost',
        '127.0.0.1',
        '*.example.com',
        '10.0.0.0/8',
        '192.168.1.*',
        '<local>',
    ]);

    it('localhost 命中', () => {
        expect(matcher.isByPass('http://localhost:3000/x')).toBe(true);
    });

    it('本机回环 IP 命中', () => {
        expect(matcher.isByPass('https://127.0.0.1:8080/y')).toBe(true);
        expect(matcher.isByPass('http://[::1]/z')).toBe(true);
    });

    it('子域名命中 *.example.com', () => {
        expect(matcher.isByPass('https://sub.example.com/z')).toBe(true);
    });

    it('*.example.com 同时覆盖 apex 与子域（与 Electron 语义一致）', () => {
        expect(matcher.isByPass('https://example.com/z')).toBe(true);
        expect(matcher.isByPass('https://deep.sub.example.com/z')).toBe(true);
    });

    it('无端口限定时任意端口都命中', () => {
        expect(matcher.isByPass('https://sub.example.com:8443/z')).toBe(true);
    });

    it('无关域名不命中', () => {
        expect(matcher.isByPass('https://api.other.com/z')).toBe(false);
        expect(matcher.isByPass('https://notexample.com/z')).toBe(false);
    });

    it('CIDR 命中段内地址', () => {
        expect(matcher.isByPass('http://10.1.2.3/z')).toBe(true);
        expect(matcher.isByPass('http://11.0.0.1/z')).toBe(false);
    });

    it('IP 通配符命中对应网段', () => {
        expect(matcher.isByPass('http://192.168.1.50/z')).toBe(true);
        expect(matcher.isByPass('http://192.168.2.50/z')).toBe(false);
    });

    it('非法 URL 不抛异常且返回 false', () => {
        expect(matcher.isByPass('not-a-url')).toBe(false);
    });

    it('空规则列表时全部走代理', () => {
        const empty = createProxyBypassMatcher([]);
        expect(empty.isByPass('http://example.com/x')).toBe(false);
    });
});

describe('带端口限定的规则匹配', () => {
    it('仅命中指定端口', () => {
        const matcher = createProxyBypassMatcher(['example.com:8080']);
        expect(matcher.isByPass('http://example.com:8080/x')).toBe(true);
        expect(matcher.isByPass('http://example.com:9090/x')).toBe(false);
    });
});
