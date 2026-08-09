import ipaddr from 'ipaddr.js';

/**
 * 代理直连规则（bypass）匹配器。
 *
 * 规则格式与 Electron `proxyBypassRules` 保持一致，在 Node 侧请求
 * （全局 fetch / axios / node-fetch）上执行同样的直连判断：
 * - `<local>`：本机回环地址
 * - 具体 IP（如 `192.168.1.1`）或带通配符的 IP（如 `192.168.1.*`）
 * - CIDR（如 `10.0.0.0/8`、`169.254/16`）
 * - 域名：精确匹配（`example.com`）、子域匹配（`.example.com` / `*.example.com`）
 * - 可选 `scheme://` 与 `:port` 限定
 */
export type ProxyBypassRule =
    | { type: 'local' }
    | { type: 'cidr'; scheme?: string; cidr: [ipaddr.IPv4 | ipaddr.IPv6, number] }
    | { type: 'ip'; scheme?: string; port?: string; ip: string }
    | { type: 'ipWildcard'; scheme?: string; port?: string; regex: RegExp }
    | { type: 'domain'; scheme?: string; port?: string; domain: string; matchSubdomains: boolean }
    | { type: 'domainWildcard'; scheme?: string; port?: string; regex: RegExp };

export interface ProxyBypassMatcher {
    isByPass(url: string): boolean;
}

/**
 * 判断字符串是否为合法的 IP（含 IPv6 括号写法）。
 */
const isValidIp = (value: string): boolean => {
    return ipaddr.isValid(value.replace(/^\[|\]$/g, ''));
};

/**
 * 解析 CIDR 字符串，非法时返回 null。
 * ipaddr.js 1.x 没有 isValidCIDR，只能通过 parseCIDR 抛错来判断。
 */
const parseCidr = (value: string): [ipaddr.IPv4 | ipaddr.IPv6, number] | null => {
    try {
        return ipaddr.parseCIDR(value.replace(/^\[|\]$/g, ''));
    } catch {
        return null;
    }
};

/**
 * 将含 `*` 的通配表达式编译为不区分大小写的正则。
 */
const buildWildcardRegex = (pattern: string): RegExp => {
    const escapedSegments = pattern.split('*').map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`^${escapedSegments.join('.*')}$`, 'i');
};

/**
 * 解析单条直连规则；无法解析时返回 null。
 */
export function parseProxyBypassRule(rawRule: string): ProxyBypassRule | null {
    const trimmed = rawRule.trim();
    if (!trimmed) {
        return null;
    }
    if (trimmed === '<local>') {
        return { type: 'local' };
    }

    let rest = trimmed;
    let scheme: string | undefined;
    const schemeMatch = rest.match(/^([a-zA-Z][a-zA-Z\d+\-.]*):\/\//);
    if (schemeMatch) {
        scheme = schemeMatch[1].toLowerCase();
        rest = rest.slice(schemeMatch[0].length);
    }

    const cidr = parseCidr(rest);
    if (rest.includes('/') && cidr) {
        return { type: 'cidr', scheme, cidr };
    }

    let port: string | undefined;
    const portMatch = rest.match(/^(.+?):(\d+)$/);
    if (portMatch && (!portMatch[1].startsWith('[') || portMatch[1].includes(']'))) {
        rest = portMatch[1];
        port = portMatch[2];
    }

    const cleaned = rest.replace(/^\[|\]$/g, '').toLowerCase();
    if (!cleaned) {
        return null;
    }

    if (ipaddr.isValid(cleaned)) {
        return { type: 'ip', scheme, port, ip: cleaned };
    }

    if (cleaned.startsWith('*.')) {
        return { type: 'domain', scheme, port, domain: cleaned.slice(2), matchSubdomains: true };
    }
    if (cleaned.startsWith('.')) {
        return { type: 'domain', scheme, port, domain: cleaned.slice(1), matchSubdomains: true };
    }

    if (cleaned.includes('*')) {
        if (isValidIp(cleaned.replace(/\*/g, '0'))) {
            return { type: 'ipWildcard', scheme, port, regex: buildWildcardRegex(cleaned) };
        }
        return { type: 'domainWildcard', scheme, port, regex: buildWildcardRegex(cleaned) };
    }
    return { type: 'domain', scheme, port, domain: cleaned, matchSubdomains: false };
}

/**
 * 从规则字符串列表构建匹配器；非法规则会被跳过。
 */
export function createProxyBypassMatcher(rules: string[]): ProxyBypassMatcher {
    const parsedRules: ProxyBypassRule[] = [];
    for (const rule of rules) {
        const parsed = parseProxyBypassRule(rule);
        if (parsed) {
            parsedRules.push(parsed);
        }
    }
    if (parsedRules.length === 0) {
        return { isByPass: () => false };
    }

    const isLocalHostname = (hostname: string): boolean => {
        const cleaned = hostname.replace(/^\[|\]$/g, '').toLowerCase();
        return cleaned === 'localhost' || (ipaddr.isValid(cleaned) && ipaddr.parse(cleaned).range() === 'loopback');
    };

    return {
        isByPass(url: string): boolean {
            let parsedUrl: URL;
            try {
                parsedUrl = new URL(url);
            } catch {
                return false;
            }

            const hostname = parsedUrl.hostname.toLowerCase();
            const protocolName = parsedUrl.protocol.replace(':', '');
            const defaultPort = protocolName === 'http' ? '80' : protocolName === 'https' ? '443' : '';
            const port = parsedUrl.port || defaultPort;
            const hostnameIsIp = ipaddr.isValid(hostname.replace(/^\[|\]$/g, ''));

            for (const rule of parsedRules) {
                if ('scheme' in rule && rule.scheme && rule.scheme !== protocolName) {
                    continue;
                }
                if ('port' in rule && rule.port && rule.port !== port) {
                    continue;
                }

                switch (rule.type) {
                    case 'local':
                        if (isLocalHostname(hostname)) {
                            return true;
                        }
                        break;
                    case 'ip':
                        if (hostnameIsIp && hostname === rule.ip) {
                            return true;
                        }
                        break;
                    case 'ipWildcard':
                        if (hostnameIsIp && rule.regex.test(hostname)) {
                            return true;
                        }
                        break;
                    case 'cidr': {
                        if (!hostnameIsIp) {
                            break;
                        }
                        const parsedHost = ipaddr.parse(hostname.replace(/^\[|\]$/g, ''));
                        const [cidrAddress, prefixLength] = rule.cidr;
                        if (parsedHost.kind() !== cidrAddress.kind()) {
                            break;
                        }
                        if (parsedHost.kind() === 'ipv4' && cidrAddress.kind() === 'ipv4') {
                            const ipv4Host = parsedHost as ipaddr.IPv4;
                            const ipv4Cidr = cidrAddress as ipaddr.IPv4;
                            if (ipv4Host.match(ipv4Cidr, prefixLength)) {
                                return true;
                            }
                        } else if (parsedHost.kind() === 'ipv6' && cidrAddress.kind() === 'ipv6') {
                            const ipv6Host = parsedHost as ipaddr.IPv6;
                            const ipv6Cidr = cidrAddress as ipaddr.IPv6;
                            if (ipv6Host.match(ipv6Cidr, prefixLength)) {
                                return true;
                            }
                        }
                        break;
                    }
                    case 'domain':
                        if (hostnameIsIp) {
                            break;
                        }
                        if (rule.matchSubdomains) {
                            if (hostname === rule.domain || hostname.endsWith(`.${rule.domain}`)) {
                                return true;
                            }
                        } else if (hostname === rule.domain) {
                            return true;
                        }
                        break;
                    case 'domainWildcard':
                        if (!hostnameIsIp && rule.regex.test(hostname)) {
                            return true;
                        }
                        break;
                }
            }
            return false;
        },
    };
}
