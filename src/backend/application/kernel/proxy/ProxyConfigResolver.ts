import type { ProxyConfig } from 'electron';

export type ProxyMode = 'system' | 'custom' | 'none';

export interface ProxySettingValues {
    mode: ProxyMode;
    url: string;
    bypassRules: string;
}

/** 自定义代理模式下 URL 缺失时的显式错误，避免静默退化为直连。 */
export class MissingProxyUrlError extends Error {
    constructor() {
        super('自定义代理模式必须填写代理地址');
        this.name = 'MissingProxyUrlError';
    }
}

/**
 * 将用户设置的代理模式映射为 Electron {@link ProxyConfig}。
 *
 * 行为说明：
 * - `system` 返回裸 `system` 模式，具体系统代理由 {@link ProxyService} 启动后从 OS 读取；
 * - `custom` 且 URL 为空时抛出 {@link MissingProxyUrlError}，
 *   由调用方（设置变更链路）显式暴露给用户，不静默回退直连。
 */
export function resolveProxyConfig({ mode, url, bypassRules }: ProxySettingValues): ProxyConfig {
    switch (mode) {
        case 'none':
            return { mode: 'direct' };
        case 'custom':
            if (!url.trim()) {
                throw new MissingProxyUrlError();
            }
            return {
                mode: 'fixed_servers',
                proxyRules: url.trim(),
                proxyBypassRules: bypassRules.trim() || undefined,
            };
        case 'system':
        default:
            return { mode: 'system' };
    }
}

/**
 * 生成代理配置指纹，用于判断代理是否发生变化。
 */
export const proxyConfigKey = (config: ProxyConfig): string =>
    `${config.mode}|${config.proxyRules ?? ''}|${config.proxyBypassRules ?? ''}`;
