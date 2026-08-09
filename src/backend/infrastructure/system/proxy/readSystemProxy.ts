import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface SystemProxyInfo {
    proxyUrl: string;
    noProxy: string[];
}

/**
 * 解析 macOS `scutil --proxy` 输出。
 *
 * 输出为类 plist 的嵌套结构，如：
 * ```
 * <dictionary> {
 *   ExceptionsList : <array> {
 *     0 : localhost
 *     1 : 127.0.0.1
 *   }
 *   HTTPEnable : 1
 *   HTTPProxy : 127.0.0.1
 *   HTTPPort : 7890
 * }
 * ```
 * 只读取 HTTP/HTTPS 代理；PAC 代理无法固化为单一 URL，返回 null。
 */
export const parseMacScutil = (output: string): SystemProxyInfo | null => {
    const values = new Map<string, string>();
    const exceptions: string[] = [];
    let inExceptions = false;

    for (const rawLine of output.split('\n')) {
        const line = rawLine.trim();
        if (line.startsWith('ExceptionsList :')) {
            inExceptions = true;
            continue;
        }
        if (inExceptions) {
            if (line === '}') {
                inExceptions = false;
                continue;
            }
            const entry = line.replace(/^\d+\s*:\s*/, '').replace(/^"|"$/g, '').trim();
            if (entry) {
                exceptions.push(entry);
            }
            continue;
        }
        const match = line.match(/^(\S+)\s*:\s*(.*)$/);
        if (match) {
            values.set(match[1], match[2].replace(/^"|"$/g, ''));
        }
    }

    const httpEnabled = values.get('HTTPEnable') === '1';
    const httpsEnabled = values.get('HTTPSEnable') === '1';

    if (!httpEnabled && !httpsEnabled) {
        return null;
    }

    // 选择已启用的代理条目：HTTPS 优先（两者同时启用时端口通常一致），
    // 避免 HTTPS-only 配置下误用未启用的 HTTP 字段拼出 undefined:undefined。
    const server = httpsEnabled ? values.get('HTTPSProxy') ?? values.get('HTTPProxy') : values.get('HTTPProxy');
    const port = httpsEnabled ? values.get('HTTPSPort') ?? values.get('HTTPPort') : values.get('HTTPPort');

    if (!server || !port) {
        return null;
    }

    const proxyUrl = `http://${server}:${port}`;
    return { proxyUrl, noProxy: exceptions };
};

/** 解析 Windows `reg query` 输出，返回系统代理 URL 与例外列表。 */
export const parseWindowsReg = (output: string): SystemProxyInfo | null => {
    const values = new Map<string, string>();
    for (const rawLine of output.split('\n')) {
        const line = rawLine.trim();
        const match = line.match(/^\s*(\S+)\s+REG_\S+\s+(.*)$/);
        if (match) {
            values.set(match[1].toLowerCase(), match[2].trim().replace(/^"|"$/g, ''));
        }
    }

    const enabled = values.get('proxyenable') === '0x1';
    const proxyServer = values.get('proxyserver');
    if (!enabled || !proxyServer) {
        return null;
    }

    const separatorIndex = proxyServer.indexOf(';');
    let serverPart = separatorIndex >= 0 ? proxyServer.slice(0, separatorIndex) : proxyServer;
    // 处理 Windows 的多协议形式（http=host:port;https=host:port），去掉协议前缀。
    const protocolPrefixMatch = serverPart.match(/^([a-zA-Z]+)=(.+)$/);
    if (protocolPrefixMatch) {
        serverPart = protocolPrefixMatch[2];
    }
    const proxyUrl = serverPart.includes('://') ? serverPart : `http://${serverPart}`;

    const noProxy = (values.get('proxyoverride') ?? '')
        .split(';')
        .map((entry) => entry.trim())
        .filter(Boolean);

    return { proxyUrl, noProxy };
};

/** 从标准代理环境变量读取系统代理（Linux 桌面环境常用）。 */
const readFromEnv = (): SystemProxyInfo | null => {
    const env = process.env;
    const proxyUrl = env.https_proxy ?? env.HTTPS_PROXY ?? env.http_proxy ?? env.HTTP_PROXY ?? env.all_proxy ?? env.ALL_PROXY;
    if (!proxyUrl) {
        return null;
    }
    const noProxy = (env.no_proxy ?? env.NO_PROXY ?? '')
        .split(/[;,]/)
        .map((entry) => entry.trim())
        .filter(Boolean);
    return { proxyUrl, noProxy };
};

/**
 * 读取操作系统级代理配置。
 *
 * 平台差异：
 * - macOS：执行 `scutil --proxy` 解析；
 * - Windows：执行 `reg query` 读取代理注册表项；
 * - Linux：读取 `*_PROXY` 环境变量。
 *
 * 无代理配置时返回 null；系统代理读取失败时抛出错误。
 */
export const readSystemProxy = async (): Promise<SystemProxyInfo | null> => {
    if (process.platform === 'darwin') {
        const { stdout } = await execFileAsync('scutil', ['--proxy']);
        return parseMacScutil(stdout);
    }
    if (process.platform === 'win32') {
        const { stdout } = await execFileAsync('reg', [
            'query',
            'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
        ]);
        return parseWindowsReg(stdout);
    }
    return readFromEnv();
};
