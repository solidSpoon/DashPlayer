import Store from 'electron-store';
import { getEnvironmentConfigName } from '@/backend/utils/runtimeEnv';
import { getMainLogger } from '@/backend/infrastructure/logger';
import { initProxy, onProxySettingChange, disposeProxy } from '@/backend/infrastructure/system/proxy/ProxyService';
import { PROXY_SETTING_KEYS } from '@/backend/infrastructure/system/proxy/proxySettingKeys';

const logger = getMainLogger('initProxy');

let unsubscribers: Array<() => void> = [];
let initialized = false;

/**
 * 在应用 ready 后初始化代理功能：
 * - 应用当前设置的代理（system 模式会读取 OS 代理并轮询变化）；
 * - 订阅代理设置变更，变更后自动重应用。
 *
 * 幂等：重复调用不会重复初始化或重复订阅。
 */
export const initProxyFeature = async (): Promise<void> => {
    if (initialized) {
        return;
    }
    initialized = true;

    const settingsStore = new Store<Record<string, unknown>>({
        name: getEnvironmentConfigName('config'),
    });

    for (const key of PROXY_SETTING_KEYS) {
        unsubscribers.push(
            settingsStore.onDidChange(key, () => {
                onProxySettingChange();
            })
        );
    }

    await initProxy();
};

/**
 * 清理代理功能：停止轮询、恢复 Node 侧直连并解除订阅。
 */
export const disposeProxyFeature = (): void => {
    for (const unsubscribe of unsubscribers) {
        unsubscribe();
    }
    unsubscribers = [];
    initialized = false;
    disposeProxy();
    logger.info('proxy feature disposed');
};
