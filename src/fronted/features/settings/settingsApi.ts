import { RuntimeSettingSaveRequest } from '@/common/contracts/runtime-settings';
import { ProxySettingSaveVO } from '@/common/contracts/proxy-setting-vo';
import { AppearanceSettingVO } from '@/common/contracts/appearance-setting-vo';
import { EngineSelectionSettingVO } from '@/common/types/vo/engine-selection-setting-vo';
import { ServiceCredentialSettingSaveVO } from '@/common/types/vo/service-credentials-setting-vo';
import { ShortcutSettingSaveVO } from '@/common/types/vo/shortcut-setting-vo';
import { backendClient } from '@/fronted/infrastructure/electron/backendClient';

/**
 * 设置功能调用的后端接口。
 */
export const settingsApi = {
    /**
     * 查询代理设置。
     *
     * @returns 当前代理设置。
     */
    getProxy: () => backendClient.call('settings/proxy/detail'),

    /**
     * 保存代理设置。
     *
     * @param settings 待保存的代理设置。
     * @returns 保存完成后结束。
     */
    saveProxy: (settings: ProxySettingSaveVO) => backendClient.call('settings/proxy/save', settings),

    /**
     * 保存运行时设置。
     *
     * @param setting 待保存的设置键和值。
     * @returns 保存完成后结束。
     */
    saveRuntimeSetting: (setting: RuntimeSettingSaveRequest) =>
        backendClient.call('settings/runtime/save', setting),

    /**
     * 查询外观设置。
     *
     * @returns 当前外观设置。
     */
    getAppearance: () => backendClient.call('settings/appearance/detail'),

    /**
     * 保存外观设置。
     *
     * @param settings 待保存的外观设置。
     * @returns 保存完成后结束。
     */
    saveAppearance: (settings: AppearanceSettingVO) => backendClient.call('settings/appearance/save', settings),

    /**
     * 检查应用更新。
     *
     * @returns 更新检查结果。
     */
    checkUpdate: () => backendClient.call('system/check-update'),

    /**
     * 打开外部链接。
     *
     * @param url 待打开的链接。
     * @returns 打开完成后结束。
     */
    openUrl: (url: string) => backendClient.call('system/open-url', url),

    /**
     * 查询引擎选择设置。
     *
     * @returns 当前引擎选择设置。
     */
    getEngineSelection: () => backendClient.call('settings/engine-selection/detail'),

    /**
     * 保存引擎选择设置。
     *
     * @param settings 待保存的引擎设置。
     * @returns 保存完成后结束。
     */
    saveEngineSelection: (settings: EngineSelectionSettingVO) =>
        backendClient.call('settings/engine-selection/save', settings),

    /**
     * 查询服务凭据设置。
     *
     * @returns 当前服务凭据设置。
     */
    getServiceCredentials: () => backendClient.call('settings/service-credentials/detail'),

    /**
     * 保存服务凭据设置。
     *
     * @param settings 待保存的服务凭据。
     * @returns 保存完成后结束。
     */
    saveServiceCredentials: (settings: ServiceCredentialSettingSaveVO) =>
        backendClient.call('settings/service-credentials/save', settings),

    /**
     * 查询 Parakeet 模型状态。
     *
     * @returns 当前模型状态。
     */
    getParakeetModelStatus: () => backendClient.call('parakeet/models/status'),

    /**
     * 下载 Parakeet 模型。
     *
     * @returns 下载任务结果。
     */
    downloadParakeetModel: () => backendClient.call('parakeet/models/download'),

    /**
     * 取消 Parakeet 模型下载。
     *
     * @returns 取消结果。
     */
    cancelParakeetModelDownload: () => backendClient.call('parakeet/models/cancel-download'),

    /**
     * 删除 Parakeet 模型。
     *
     * @returns 删除完成后结束。
     */
    deleteParakeetModel: () => backendClient.call('parakeet/models/delete'),

    /**
     * 查询 Sherpa TTS 模型状态。
     *
     * @returns 当前模型状态。
     */
    getSherpaTtsModelStatus: () => backendClient.call('sherpa-tts/models/status'),

    /**
     * 下载 Sherpa TTS 模型。
     *
     * @returns 下载任务结果。
     */
    downloadSherpaTtsModel: () => backendClient.call('sherpa-tts/models/download'),

    /**
     * 取消 Sherpa TTS 模型下载。
     *
     * @returns 取消结果。
     */
    cancelSherpaTtsModelDownload: () => backendClient.call('sherpa-tts/models/cancel-download'),

    /**
     * 删除 Sherpa TTS 模型。
     *
     * @returns 删除完成后结束。
     */
    deleteSherpaTtsModel: () => backendClient.call('sherpa-tts/models/delete'),

    /**
     * 测试服务凭据是否可用。
     *
     * @param provider 待测试的服务提供方。
     * @returns 凭据测试结果。
     */
    testServiceCredential: (provider: 'openai' | 'tencent' | 'youdao') => {
        const routeMap = {
            openai: 'settings/service-credentials/test-openai',
            tencent: 'settings/service-credentials/test-tencent',
            youdao: 'settings/service-credentials/test-youdao',
        } as const;
        return backendClient.call(routeMap[provider]);
    },

    /**
     * 查询快捷键设置。
     *
     * @returns 当前快捷键设置。
     */
    getShortcuts: () => backendClient.call('settings/shortcuts/detail'),

    /**
     * 保存快捷键设置。
     *
     * @param settings 待保存的快捷键设置。
     * @returns 保存完成后结束。
     */
    saveShortcuts: (settings: ShortcutSettingSaveVO) => backendClient.call('settings/shortcuts/save', settings),

    /**
     * 查询存储设置。
     *
     * @returns 当前存储设置。
     */
    getStorage: () => backendClient.call('settings/storage/detail'),

    /**
     * 查询存储状态。
     *
     * @returns 当前存储状态。
     */
    getStorageStatus: () => backendClient.call('storage/status'),

    /**
     * 查询缓存大小。
     *
     * @returns 缓存大小。
     */
    getCacheSize: () => backendClient.call('storage/cache/size'),

    /**
     * 保存存储设置。
     *
     * @param path 存储路径。
     * @returns 保存完成后结束。
     */
    saveStorage: (path: string) => backendClient.call('settings/storage/save', { path }),

    /**
     * 从远端同步收藏片段。
     *
     * @returns 同步完成后结束。
     */
    syncFavouriteFromOss: () => backendClient.call('favorite-clips/sync-from-oss'),

    /**
     * 从远端同步视频学习数据。
     *
     * @returns 同步结果。
     */
    syncVideoLearningFromOss: () => backendClient.call('video-learning/sync-from-oss'),

    /**
     * 重置数据库。
     *
     * @returns 重置完成后结束。
     */
    resetDatabase: () => backendClient.call('system/reset-db'),

    /**
     * 打开缓存目录。
     *
     * @returns 打开完成后结束。
     */
    openCacheFolder: () => backendClient.call('system/open-folder/cache'),

    /**
     * 选择存储目录。
     *
     * @param options 文件夹选择选项。
     * @returns 用户选择的目录路径列表。
     */
    selectStorageFolder: (options: { defaultPath?: string; createDirectory?: boolean }) =>
        backendClient.call('system/select-folder', options),

};
