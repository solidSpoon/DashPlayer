import registerRoute from '@/backend/adapters/ipc/registerRoute';
import Controller from '@/backend/interfaces/controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import SettingService from '@/backend/application/services/SettingService';
import { ApiSettingVO } from "@/common/types/vo/api-setting-vo";
import { getMainLogger } from '@/backend/infrastructure/logger';
import { SettingKey } from '@/common/types/store_schema';
import SettingsKeyValueService from '@/backend/application/services/impl/SettingsKeyValueService';

@injectable()
export default class SettingsController implements Controller {
    @inject(TYPES.SettingService) private settingService!: SettingService;
    @inject(TYPES.SettingsKeyValueService) private settingsKeyValueService!: SettingsKeyValueService;
    private logger = getMainLogger('SettingsController');

    public async queryApiSettings(): Promise<ApiSettingVO> {
        return this.settingService.queryApiSettings();
    }

    public async updateApiSettings(params: { service: string, settings: ApiSettingVO }): Promise<void> {
        const { service, settings } = params;

        this.logger.info('update api settings', { service, settings: { ...settings, openai: { ...settings.openai, key: '***' } } });
        await this.settingService.updateApiSettings(settings, service);
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

    public async updateAppearanceSettings(params: { theme: string; fontSize: string }): Promise<void> {
        await this.settingsKeyValueService.set('appearance.theme', params.theme);
        await this.settingsKeyValueService.set('appearance.fontSize', params.fontSize);
    }

    public async updateShortcutSettings(params: Partial<Record<SettingKey, string>>): Promise<void> {
        const entries = Object.entries(params) as [SettingKey, string | undefined][];
        for (const [key, value] of entries) {
            if (value !== undefined) {
                await this.settingsKeyValueService.set(key, value);
            }
        }
    }

    public async updateStorageSettings(params: { path: string; collection: string }): Promise<void> {
        await this.settingsKeyValueService.set('storage.path', params.path);
        await this.settingsKeyValueService.set('storage.collection', params.collection);
    }

    public async updateTranslationSettings(params: {
        engine: 'tencent' | 'openai';
        tencentSecretId?: string;
        tencentSecretKey?: string;
    }): Promise<void> {
        await this.settingsKeyValueService.set('translation.engine', params.engine);
        if (params.tencentSecretId !== undefined) {
            await this.settingsKeyValueService.set('apiKeys.tencent.secretId', params.tencentSecretId);
        }
        if (params.tencentSecretKey !== undefined) {
            await this.settingsKeyValueService.set('apiKeys.tencent.secretKey', params.tencentSecretKey);
        }
    }

    public async updateYoudaoSettings(params: { secretId: string; secretKey: string }): Promise<void> {
        await this.settingsKeyValueService.set('apiKeys.youdao.secretId', params.secretId);
        await this.settingsKeyValueService.set('apiKeys.youdao.secretKey', params.secretKey);
    }

    registerRoutes(): void {
        registerRoute('settings/services/get-all', () => this.queryApiSettings());
        registerRoute('settings/services/update', (p) => this.updateApiSettings(p));
        registerRoute('settings/services/test-openai', () => this.testOpenAi());
        registerRoute('settings/services/test-tencent', () => this.testTencent());
        registerRoute('settings/services/test-youdao', () => this.testYoudao());
        registerRoute('settings/appearance/update', (p) => this.updateAppearanceSettings(p));
        registerRoute('settings/shortcuts/update', (p) => this.updateShortcutSettings(p));
        registerRoute('settings/storage/update', (p) => this.updateStorageSettings(p));
        registerRoute('settings/translation/update', (p) => this.updateTranslationSettings(p));
        registerRoute('settings/youdao/update', (p) => this.updateYoudaoSettings(p));
    }
}
