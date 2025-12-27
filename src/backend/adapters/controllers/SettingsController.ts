import registerRoute from '@/backend/adapters/ipc/registerRoute';
import Controller from '@/backend/interfaces/controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import SettingService from '@/backend/application/services/SettingService';
import { ApiSettingVO } from "@/common/types/vo/api-setting-vo";
import { getMainLogger } from '@/backend/infrastructure/logger';
import { SettingKey } from '@/common/types/store_schema';

@injectable()
export default class SettingsController implements Controller {
    @inject(TYPES.SettingService) private settingService!: SettingService;
    private logger = getMainLogger('SettingsController');

    public async queryApiSettings(): Promise<ApiSettingVO> {
        return this.settingService.queryApiSettings();
    }

    public async updateApiSettings(params: { service: string, settings: ApiSettingVO }): Promise<void> {
        const { service, settings } = params;

        this.logger.info('update api settings', { service, settings: { ...settings, openai: { ...settings.openai, key: '***' } } });

        if (service === 'whisper') {
            // Update only Whisper settings, but still receive full ApiSettingVO
            await this.settingService.set('whisper.enabled', settings.whisper.enabled ? 'true' : 'false');
            const transcriptionEngine = settings.whisper.enableTranscription ? 'whisper' : 'openai';
            await this.settingService.set('transcription.engine', transcriptionEngine);
            await this.settingService.set('whisper.modelSize', settings.whisper.modelSize === 'large' ? 'large' : 'base');
            await this.settingService.set('whisper.enableVad', 'true');
            await this.settingService.set('whisper.vadModel', 'silero-v6.2.0');
            if (transcriptionEngine === 'whisper') {
                await this.settingService.set('whisper.enabled', 'true');
            }
        } else {
            // Update all settings (for backward compatibility)
            await this.settingService.updateApiSettings(settings);
        }
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
        await this.settingService.set('appearance.theme', params.theme);
        await this.settingService.set('appearance.fontSize', params.fontSize);
    }

    public async updateShortcutSettings(params: Partial<Record<SettingKey, string>>): Promise<void> {
        const entries = Object.entries(params) as [SettingKey, string | undefined][];
        for (const [key, value] of entries) {
            if (value !== undefined) {
                await this.settingService.set(key, value);
            }
        }
    }

    public async updateStorageSettings(params: { path: string; collection: string }): Promise<void> {
        await this.settingService.set('storage.path', params.path);
        await this.settingService.set('storage.collection', params.collection);
    }

    public async updateTranslationSettings(params: {
        engine: 'tencent' | 'openai';
        tencentSecretId?: string;
        tencentSecretKey?: string;
    }): Promise<void> {
        await this.settingService.set('translation.engine', params.engine);
        if (params.tencentSecretId !== undefined) {
            await this.settingService.set('apiKeys.tencent.secretId', params.tencentSecretId);
        }
        if (params.tencentSecretKey !== undefined) {
            await this.settingService.set('apiKeys.tencent.secretKey', params.tencentSecretKey);
        }
    }

    public async updateYoudaoSettings(params: { secretId: string; secretKey: string }): Promise<void> {
        await this.settingService.set('apiKeys.youdao.secretId', params.secretId);
        await this.settingService.set('apiKeys.youdao.secretKey', params.secretKey);
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
