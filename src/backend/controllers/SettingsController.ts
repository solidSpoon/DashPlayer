import registerRoute from '@/common/api/register';
import Controller from '@/backend/interfaces/controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import SettingService from '@/backend/services/SettingService';
import { ApiSettingVO } from "@/common/types/vo/api-setting-vo";
import { getMainLogger } from '@/backend/ioc/simple-logger';

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
            await this.settingService.set('whisper.enableTranscription', settings.whisper.enableTranscription ? 'true' : 'false');
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

    registerRoutes(): void {
        registerRoute('settings/get-all-services', () => this.queryApiSettings());
        registerRoute('settings/update-service', (p) => this.updateApiSettings(p));
        registerRoute('settings/test-openai', () => this.testOpenAi());
        registerRoute('settings/test-tencent', () => this.testTencent());
        registerRoute('settings/test-youdao', () => this.testYoudao());
    }
}