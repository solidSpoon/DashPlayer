import registerRoute from '@/backend/controllers/ipc/registerRoute';
import Controller from '@/backend/controllers/Controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import SettingService from '@/backend/services/SettingService';
import { getMainLogger } from '@/backend/infrastructure/logger';
import {
    ServiceCredentialSettingDetailVO,
    ServiceCredentialSettingSaveVO,
} from '@/common/types/vo/service-credentials-setting-vo';
import { EngineSelectionSettingVO } from '@/common/types/vo/engine-selection-setting-vo';
import { ShortcutSettingDetailVO, ShortcutSettingSaveVO } from '@/common/types/vo/shortcut-setting-vo';
import { ProxySettingDetailVO, ProxySettingSaveVO } from '@/common/contracts/proxy-setting-vo';
import { AppearanceSettingVO } from '@/common/contracts/appearance-setting-vo';
import { StorageSettingVO } from '@/common/contracts/storage-setting-vo';
import {
    RuntimeSettingSaveRequest,
    RuntimeSettingsSnapshot,
} from '@/common/contracts/runtime-settings';

/**
 * 设置页 IPC 控制器：只负责接收参数并委托给 SettingService。
 */
@injectable()
export default class SettingsController implements Controller {
    @inject(TYPES.SettingService) private settingService!: SettingService;
    private logger = getMainLogger('SettingsController');

    /**
     * 获取渲染进程启动所需的非敏感设置。
     *
     * @returns 完整运行时设置快照。
     */
    public async getRuntimeSettings(): Promise<RuntimeSettingsSnapshot> {
        return this.settingService.getRuntimeSettings();
    }

    /**
     * 保存播放器运行期间允许直接修改的设置。
     *
     * @param request 设置键和值。
     */
    public async saveRuntimeSetting(request: RuntimeSettingSaveRequest): Promise<void> {
        await this.settingService.saveRuntimeSetting(request);
    }

    /**
     * 获取服务凭据页面详情。
     */
    public async getServiceCredentialsDetail(): Promise<ServiceCredentialSettingDetailVO> {
        return this.settingService.getServiceCredentialsDetail();
    }

    /**
     * 保存服务凭据页面数据。
     */
    public async saveServiceCredentials(settings: ServiceCredentialSettingSaveVO): Promise<void> {
        this.logger.info('update service credentials', { settings });
        await this.settingService.saveServiceCredentials(settings);
    }

    /**
     * 获取功能设置页面详情。
     */
    public async getEngineSelectionDetail(): Promise<EngineSelectionSettingVO> {
        return this.settingService.getEngineSelectionDetail();
    }

    /**
     * 保存功能设置页面数据。
     */
    public async saveEngineSelection(settings: EngineSelectionSettingVO): Promise<void> {
        this.logger.info('update engine selection', { settings });
        await this.settingService.saveEngineSelection(settings);
    }

    /**
     * 获取快捷键设置详情。
     */
    public async getShortcutSettingsDetail(): Promise<ShortcutSettingDetailVO> {
        return this.settingService.getShortcutSettingsDetail();
    }

    /**
     * 保存快捷键设置。
     */
    public async saveShortcutSettings(settings: ShortcutSettingSaveVO): Promise<void> {
        await this.settingService.saveShortcutSettings(settings);
    }

    /**
     * 获取外观设置详情。
     */
    public async getAppearanceSettingDetail(): Promise<AppearanceSettingVO> {
        return this.settingService.getAppearanceSettingDetail();
    }

    /**
     * 保存外观设置。
     */
    public async saveAppearanceSettings(settings: AppearanceSettingVO): Promise<void> {
        await this.settingService.saveAppearanceSettings(settings);
    }

    /**
     * 获取存储设置详情。
     */
    public async getStorageSettingDetail(): Promise<StorageSettingVO> {
        return this.settingService.getStorageSettingDetail();
    }

    /**
     * 保存存储设置。
     */
    public async saveStorageSettings(settings: StorageSettingVO): Promise<void> {
        await this.settingService.saveStorageSettings(settings);
    }

    /**
     * 获取代理设置详情。
     */
    public async getProxySettingDetail(): Promise<ProxySettingDetailVO> {
        return this.settingService.getProxySettingDetail();
    }

    /**
     * 保存代理设置。
     */
    public async saveProxySettings(settings: ProxySettingSaveVO): Promise<void> {
        await this.settingService.saveProxySettings(settings);
    }

    public async testOpenAi(): Promise<{ success: boolean, message: string }> {
        this.logger.info('testing openai connection');
        return this.settingService.testOpenAi();
    }

    public async testTencent(): Promise<{ success: boolean, message: string }> {
        this.logger.info('testing tencent connection');
        return this.settingService.testTencent();
    }

    public async testYoudao(): Promise<{ success: boolean, message: string }> {
        this.logger.info('testing youdao connection');
        return this.settingService.testYoudao();
    }

    registerRoutes(): void {
        registerRoute('settings/runtime/detail', () => this.getRuntimeSettings());
        registerRoute('settings/runtime/save', (p) => this.saveRuntimeSetting(p));
        registerRoute('settings/service-credentials/detail', () => this.getServiceCredentialsDetail());
        registerRoute('settings/service-credentials/save', (p) => this.saveServiceCredentials(p));
        registerRoute('settings/service-credentials/test-openai', () => this.testOpenAi());
        registerRoute('settings/service-credentials/test-tencent', () => this.testTencent());
        registerRoute('settings/service-credentials/test-youdao', () => this.testYoudao());
        registerRoute('settings/engine-selection/detail', () => this.getEngineSelectionDetail());
        registerRoute('settings/engine-selection/save', (p) => this.saveEngineSelection(p));
        registerRoute('settings/shortcuts/detail', () => this.getShortcutSettingsDetail());
        registerRoute('settings/shortcuts/save', (p) => this.saveShortcutSettings(p));
        registerRoute('settings/appearance/detail', () => this.getAppearanceSettingDetail());
        registerRoute('settings/appearance/save', (p) => this.saveAppearanceSettings(p));
        registerRoute('settings/storage/detail', () => this.getStorageSettingDetail());
        registerRoute('settings/storage/save', (p) => this.saveStorageSettings(p));
        registerRoute('settings/proxy/detail', () => this.getProxySettingDetail());
        registerRoute('settings/proxy/save', (p) => this.saveProxySettings(p));
    }
}
