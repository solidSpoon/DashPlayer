import { app, session } from 'electron';
import { getMainLogger } from '@/backend/infrastructure/logger';
import { storeGet } from '@/backend/infrastructure/settings/store';
import { readSystemProxy } from './readSystemProxy';
import { Dispatcher, EnvHttpProxyAgent, getGlobalDispatcher, setGlobalDispatcher } from 'undici';
import { socksDispatcher } from 'fetch-socks';
import { createProxyBypassMatcher, ProxyBypassMatcher } from '@/backend/utils/proxy/ProxyBypassMatcher';
import {
    ProxyMode,
    ProxySettingValues,
    proxyConfigKey,
    resolveProxyConfig,
} from '@/backend/utils/proxy/ProxyConfigResolver';

const logger = getMainLogger('ProxyService');

/** 读取代理设置项，非法模式在应用时尽早失败。 */
const readProxySettings = (): ProxySettingValues => {
    const mode = storeGet('proxy.mode') as ProxyMode;
    if (mode !== 'system' && mode !== 'custom' && mode !== 'none') {
        throw new Error(`非法的代理模式设置: ${mode}`);
    }
    return {
        mode,
        url: storeGet('proxy.url'),
        bypassRules: storeGet('proxy.bypass_rules'),
    };
};

const NODE_PROXY_ENV_KEYS = [
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'http_proxy',
    'https_proxy',
    'ALL_PROXY',
    'all_proxy',
    'SOCKS_PROXY',
    'socks_proxy',
    'NO_PROXY',
    'no_proxy',
] as const;

/** 清除全部代理相关环境变量，避免残留影响后续直连。 */
const clearProxyEnv = (): void => {
    for (const key of NODE_PROXY_ENV_KEYS) {
        delete process.env[key];
    }
};

/**
 * 将配置写入标准代理环境变量（HTTP_PROXY / NO_PROXY 等），
 * 覆盖 axios、node-fetch、tencentcloud-sdk 等按环境变量取代理的客户端。
 */
const applyProxyEnv = (config: Electron.ProxyConfig): void => {
    clearProxyEnv();
    if (config.mode === 'direct' || !config.proxyRules) {
        return;
    }
    const isSocks = config.proxyRules.toLowerCase().startsWith('socks');
    const proxyEnv: Record<string, string> = {
        HTTP_PROXY: config.proxyRules,
        HTTPS_PROXY: config.proxyRules,
        http_proxy: config.proxyRules,
        https_proxy: config.proxyRules,
        ALL_PROXY: config.proxyRules,
        all_proxy: config.proxyRules,
    };
    if (isSocks) {
        proxyEnv.SOCKS_PROXY = config.proxyRules;
        proxyEnv.socks_proxy = config.proxyRules;
    }
    if (config.proxyBypassRules) {
        proxyEnv.NO_PROXY = config.proxyBypassRules;
        proxyEnv.no_proxy = config.proxyBypassRules;
    }
    for (const [key, value] of Object.entries(proxyEnv)) {
        process.env[key] = value;
    }
};

/** 透传 dispatcher：命中直连规则时走原始直连 dispatcher，否则走代理 dispatcher。 */
class SelectiveDispatcher extends Dispatcher {
    constructor(
        private readonly proxyDispatcher: Dispatcher,
        private readonly directDispatcher: Dispatcher,
        private readonly matcher: ProxyBypassMatcher,
    ) {
        super();
    }

    dispatch(opts: Dispatcher.DispatchOptions, handler: Dispatcher.DispatchHandlers): boolean {
        const origin = opts.origin ? opts.origin.toString() : '';
        if (origin && this.matcher.isByPass(origin)) {
            return this.directDispatcher.dispatch(opts, handler);
        }
        return this.proxyDispatcher.dispatch(opts, handler);
    }

    async close(): Promise<void> {
        try {
            await this.proxyDispatcher.close();
        } catch {
            // 忽略关闭失败，交由 destroy 兜底
        }
    }

    async destroy(): Promise<void> {
        try {
            await this.proxyDispatcher.destroy();
        } catch {
            // 忽略销毁失败
        }
    }
}

class NodeProxyController {
    private readonly originalGlobalDispatcher: Dispatcher;
    private proxyDispatcher: Dispatcher | null = null;
    private currentKey: string | null = null;
    private matcher: ProxyBypassMatcher = createProxyBypassMatcher([]);

    constructor() {
        this.originalGlobalDispatcher = getGlobalDispatcher();
    }

    /** 应用或更新 Node 侧代理；配置未变化时不做任何操作。 */
    configure(url: string | undefined, bypassRules: string[]): void {
        const key = JSON.stringify({ url: url ?? null, bypassRules });
        if (key === this.currentKey) {
            return;
        }
        this.currentKey = key;
        this.matcher = createProxyBypassMatcher(bypassRules);

        this.disposeProxyDispatcher();
        if (!url) {
            setGlobalDispatcher(this.originalGlobalDispatcher);
            return;
        }

        const endpoint = this.normalizeProxyEndpoint(url);
        const proxyDispatcher = endpoint.kind === 'socks'
            ? this.buildSocksDispatcher(endpoint.value)
            : new EnvHttpProxyAgent();
        this.proxyDispatcher = proxyDispatcher;
        setGlobalDispatcher(new SelectiveDispatcher(proxyDispatcher, this.originalGlobalDispatcher, this.matcher));
    }

    /** 关闭并释放当前代理 dispatcher，恢复原始全局 dispatcher。 */
    dispose(): void {
        this.disposeProxyDispatcher();
        setGlobalDispatcher(this.originalGlobalDispatcher);
        this.currentKey = null;
    }

    private normalizeProxyEndpoint(url: string): { kind: 'http' | 'socks'; value: string } {
        if (url.toLowerCase().startsWith('socks')) {
            return { kind: 'socks', value: url };
        }
        return { kind: 'http', value: url };
    }

    private buildSocksDispatcher(url: string): Dispatcher {
        const parsed = new URL(url);
        const port = Number(parsed.port);
        if (!Number.isInteger(port) || port <= 0) {
            throw new Error(`SOCKS 代理 URL 缺少有效端口: ${url}`);
        }
        return socksDispatcher({
            type: parsed.protocol === 'socks4:' ? 4 : 5,
            host: parsed.hostname,
            port,
            userId: parsed.username ? decodeURIComponent(parsed.username) : undefined,
            password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
        });
    }

    private disposeProxyDispatcher(): void {
        if (this.proxyDispatcher) {
            void this.proxyDispatcher.close();
            this.proxyDispatcher = null;
        }
    }
}

const nodeController = new NodeProxyController();

let systemProxyInterval: NodeJS.Timeout | null = null;
let appliedKey: string | null = null;

/**
 * 将给定配置应用到所有网络栈：
 * - Electron session（Chromium / net 请求）
 * - Node 侧全局 fetch（AI SDK / openai SDK）
 * - Node 标准代理环境变量（axios / node-fetch / tencentcloud-sdk）
 */
const applyProxy = async (config: Electron.ProxyConfig): Promise<void> => {
    logger.info('apply proxy', { mode: config.mode, proxyRules: config.proxyRules, proxyBypassRules: config.proxyBypassRules });
    applyProxyEnv(config);
    nodeController.configure(
        config.mode === 'direct' ? undefined : config.proxyRules,
        (config.proxyBypassRules ?? '').split(/[;,]/).map((s) => s.trim()).filter(Boolean),
    );

    await Promise.all([
        app.setProxy(config),
        session.defaultSession.setProxy(config),
    ]);
    appliedKey = proxyConfigKey(config);
};

/** 从设置读取最新配置，system 模式下解析具体系统代理。 */
const snapshotProxyConfig = async (): Promise<Electron.ProxyConfig> => {
    const config = resolveProxyConfig(readProxySettings());
    if (config.mode !== 'system') {
        return config;
    }
    try {
        const systemProxy = await readSystemProxy();
        if (systemProxy) {
            return {
                mode: 'fixed_servers',
                proxyRules: systemProxy.proxyUrl.toLowerCase(),
                proxyBypassRules: systemProxy.noProxy.length > 0 ? systemProxy.noProxy.join(',') : undefined,
            };
        }
    } catch (error) {
        logger.warn('读取系统代理失败，回退为裸 system 模式', { error });
    }
    return config;
};

/** 重新读取设置并应用代理（system 模式下用于周期轮询 OS 代理变化）。 */
const applyProxyFromSettings = async (): Promise<void> => {
    const config = await snapshotProxyConfig();
    if (proxyConfigKey(config) === appliedKey) {
        return;
    }
    await applyProxy(config);
};

/**
 * 串行化代理应用请求（Promise 链队列）：
 * 一次保存会连续触发多个 onDidChange，若并发执行 app.setProxy，
 * 较早的旧快照可能最后完成并覆盖新配置；排队可保证逐个串行执行，
 * 且后续任务基于最新快照（配置未变化时 applyProxyFromSettings 会直接跳过）。
 */
let proxyApplyQueue: Promise<void> = Promise.resolve();
const enqueueProxyApply = (): void => {
    proxyApplyQueue = proxyApplyQueue
        .then(() => applyProxyFromSettings())
        .catch((error) => {
            logger.error('代理应用失败', { error });
        });
};

const stopSystemProxyMonitor = (): void => {
    if (systemProxyInterval) {
        clearInterval(systemProxyInterval);
        systemProxyInterval = null;
    }
};

const startSystemProxyMonitor = (): void => {
    if (systemProxyInterval) {
        return;
    }
    systemProxyInterval = setInterval(() => {
        enqueueProxyApply();
    }, 60_000);
};

/**
 * 在应用 ready 之后初始化代理：应用设置中配置的代理，
 * 并依据模式开启系统代理轮询。
 */
export const initProxy = async (): Promise<void> => {
    const config = await snapshotProxyConfig();
    stopSystemProxyMonitor();
    if (config.mode === 'system') {
        startSystemProxyMonitor();
    }
    await applyProxy(config);
};

/** 订阅代理设置变更：重新应用代理，并按最新模式启停系统代理轮询。 */
export const onProxySettingChange = (): void => {
    const mode = storeGet('proxy.mode') as ProxyMode;
    if (mode === 'system') {
        startSystemProxyMonitor();
    } else {
        stopSystemProxyMonitor();
    }
    enqueueProxyApply();
};

/** 关闭代理监控并恢复 Node 侧直连（应用退出时调用）。 */
export const disposeProxy = (): void => {
    stopSystemProxyMonitor();
    nodeController.dispose();
    clearProxyEnv();
};
