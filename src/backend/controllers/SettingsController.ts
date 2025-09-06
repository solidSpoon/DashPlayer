import registerRoute from '@/common/api/register';
import Controller from '@/backend/interfaces/controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import SettingService from '@/backend/services/SettingService';
import { ApiSettingVO } from "@/common/types/vo/api-setting-vo";

@injectable()
export default class SettingsController implements Controller {
    @inject(TYPES.SettingService) private settingService!: SettingService;

    public async queryApiSettings(): Promise<ApiSettingVO> {
        return this.settingService.queryApiSettings();
    }

    public async updateApiSettings(params: { service: string, settings: ApiSettingVO }): Promise<void> {
        const { service, settings } = params;
        
        if (service === 'parakeet') {
            // Update only Parakeet settings, but still receive full ApiSettingVO
            await this.settingService.set('parakeet.enabled', settings.parakeet.enabled ? 'true' : 'false');
            await this.settingService.set('parakeet.enableTranscription', settings.parakeet.enableTranscription ? 'true' : 'false');
        } else {
            // Update all settings (for backward compatibility)
            await this.settingService.updateApiSettings(settings);
        }
    }

    public async testOpenAi(): Promise<{ success: boolean, message: string }> {
        return this.settingService.testOpenAi();
    }

    public async testTencent(): Promise<{ success: boolean, message: string }> {
        return this.settingService.testTencent();
    }

    public async testYoudao(): Promise<{ success: boolean, message: string }> {
        return this.settingService.testYoudao();
    }

    registerRoutes(): void {
        registerRoute('settings/get-all-services', () => this.queryApiSettings());
        registerRoute('settings/update-service', (p) => this.updateApiSettings(p));
        registerRoute('settings/test-openai', () => this.testOpenAi());
        registerRoute('settings/test-tencent', () => this.testTencent());
        registerRoute('settings/test-youdao', () => this.testYoudao());
    }
}