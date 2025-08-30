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
        return this.settingService.updateApiSettings(params.settings);
    }

    registerRoutes(): void {
        registerRoute('settings/get-all-services', () => this.queryApiSettings());
        registerRoute('settings/update-service', (p) => this.updateApiSettings(p));
    }
}