import registerRoute from '@/backend/adapters/ipc/registerRoute';
import Controller from '@/backend/adapters/controllers/Controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import SettingService from '@/backend/application/services/SettingService';
import { getMainLogger } from '@/backend/infrastructure/logger';
import { SettingKey } from '@/common/types/store_schema';
import SettingsKeyValueService from '@/backend/application/services/impl/SettingsKeyValueService';
import { FeatureServiceRoutingVO } from '@/common/types/vo/feature-service-routing-vo';
import { ServiceCredentialsVO } from '@/common/types/vo/service-credentials-vo';

@injectable()
export default class SettingsController implements Controller {
    @inject(TYPES.SettingService) private settingService!: SettingService;
    @inject(TYPES.SettingsKeyValueService) private settingsKeyValueService!: SettingsKeyValueService;
    private logger = getMainLogger('SettingsController');

    public async getCredentials(): Promise<ServiceCredentialsVO> {
        return this.settingService.getCredentials();
    }

    public async updateCredentials(params: { patch: Partial<ServiceCredentialsVO> }): Promise<void> {
        const patch = params.patch ?? {};
        const redacted = {
            ...patch,
            openai: patch.openai
                ? { ...patch.openai, apiKey: patch.openai.apiKey ? '***' : patch.openai.apiKey }
                : undefined,
            tencent: patch.tencent
                ? { ...patch.tencent, secretKey: patch.tencent.secretKey ? '***' : patch.tencent.secretKey }
                : undefined,
            youdao: patch.youdao
                ? { ...patch.youdao, secretKey: patch.youdao.secretKey ? '***' : patch.youdao.secretKey }
                : undefined,
        };
        this.logger.info('update credentials', { patch: redacted });
        await this.settingService.updateCredentials(patch);
    }

    public async getFeatures(): Promise<FeatureServiceRoutingVO> {
        return this.settingService.getFeatureRouting();
    }

    public async updateFeatures(params: { patch: Partial<FeatureServiceRoutingVO> }): Promise<void> {
        this.logger.info('update feature routing', { patch: params.patch });
        await this.settingService.updateFeatureRouting(params.patch ?? {});
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

    public async updateAppearanceSettings(params: { theme: string; fontSize: string; uiLanguage?: string }): Promise<void> {
        await this.settingsKeyValueService.set('appearance.theme', params.theme);
        await this.settingsKeyValueService.set('appearance.fontSize', params.fontSize);
        if (params.uiLanguage !== undefined) {
            await this.settingsKeyValueService.set('appearance.uiLanguage', params.uiLanguage);
        }
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

    registerRoutes(): void {
        registerRoute('settings/services/test-openai', () => this.testOpenAi());
        registerRoute('settings/services/test-tencent', () => this.testTencent());
        registerRoute('settings/services/test-youdao', () => this.testYoudao());
        registerRoute('settings/credentials/get', () => this.getCredentials());
        registerRoute('settings/credentials/update', (p) => this.updateCredentials(p));
        registerRoute('settings/features/get', () => this.getFeatures());
        registerRoute('settings/features/update', (p) => this.updateFeatures(p));
        registerRoute('settings/appearance/update', (p) => this.updateAppearanceSettings(p));
        registerRoute('settings/shortcuts/update', (p) => this.updateShortcutSettings(p));
        registerRoute('settings/storage/update', (p) => this.updateStorageSettings(p));
    }
}
