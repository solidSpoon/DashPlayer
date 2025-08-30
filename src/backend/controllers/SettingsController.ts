import { SettingKey } from '@/common/types/store_schema';
import registerRoute from '@/common/api/register';
import Controller from '@/backend/interfaces/controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import SettingService from '@/backend/services/SettingService';

type ServiceSettings = {
    openai: ServiceConfig;
    tencent: ServiceConfig;
    youdao: ServiceConfig;
};

type ServiceConfig = {
    credentials: Record<string, string>;
    enabledFeatures: Record<string, boolean>;
};

@injectable()
export default class SettingsController implements Controller {
    @inject(TYPES.SettingService) private settingService!: SettingService;

    public async getAllServices(): Promise<ServiceSettings> {
        const settings: ServiceSettings = {
            openai: {
                credentials: {
                    key: await this.settingService.get('apiKeys.openAi.key'),
                    endpoint: await this.settingService.get('apiKeys.openAi.endpoint'),
                    model: await this.settingService.get('model.gpt.default'),
                },
                enabledFeatures: {
                    sentenceLearning: await this.settingService.get('services.openai.enableSentenceLearning') === 'true',
                    subtitleTranslation: await this.settingService.get('services.openai.enableSubtitleTranslation') === 'true',
                }
            },
            tencent: {
                credentials: {
                    secretId: await this.settingService.get('apiKeys.tencent.secretId'),
                    secretKey: await this.settingService.get('apiKeys.tencent.secretKey'),
                },
                enabledFeatures: {
                    subtitleTranslation: await this.settingService.get('services.tencent.enableSubtitleTranslation') === 'true',
                }
            },
            youdao: {
                credentials: {
                    secretId: await this.settingService.get('apiKeys.youdao.secretId'),
                    secretKey: await this.settingService.get('apiKeys.youdao.secretKey'),
                },
                enabledFeatures: {
                    dictionary: await this.settingService.get('services.youdao.enableDictionary') === 'true',
                }
            }
        };
        return settings;
    }

    public async updateService(params: { service: string, settings: Partial<ServiceConfig> }): Promise<void> {
        const { service, settings } = params;
        
        // Handle credentials update
        if (settings.credentials) {
            for (const [key, value] of Object.entries(settings.credentials)) {
                let settingKey: SettingKey;
                switch (service) {
                    case 'openai':
                        if (key === 'key') settingKey = 'apiKeys.openAi.key';
                        else if (key === 'endpoint') settingKey = 'apiKeys.openAi.endpoint';
                        else if (key === 'model') settingKey = 'model.gpt.default';
                        else continue;
                        break;
                    case 'tencent':
                        if (key === 'secretId') settingKey = 'apiKeys.tencent.secretId';
                        else if (key === 'secretKey') settingKey = 'apiKeys.tencent.secretKey';
                        else continue;
                        break;
                    case 'youdao':
                        if (key === 'secretId') settingKey = 'apiKeys.youdao.secretId';
                        else if (key === 'secretKey') settingKey = 'apiKeys.youdao.secretKey';
                        else continue;
                        break;
                    default:
                        continue;
                }
                await this.settingService.set(settingKey, value);
            }
        }

        // Handle feature enablement with mutual exclusion
        if (settings.enabledFeatures) {
            for (const [feature, enabled] of Object.entries(settings.enabledFeatures)) {
                // Handle mutual exclusion for subtitle translation
                if (feature === 'subtitleTranslation' && enabled) {
                    if (service === 'openai') {
                        await this.settingService.set('services.openai.enableSubtitleTranslation', 'true');
                        await this.settingService.set('services.tencent.enableSubtitleTranslation', 'false');
                    } else if (service === 'tencent') {
                        await this.settingService.set('services.tencent.enableSubtitleTranslation', 'true');
                        await this.settingService.set('services.openai.enableSubtitleTranslation', 'false');
                    }
                } else {
                    // Handle other features
                    let settingKey: SettingKey;
                    switch (service) {
                        case 'openai':
                            if (feature === 'sentenceLearning') settingKey = 'services.openai.enableSentenceLearning';
                            else if (feature === 'subtitleTranslation') settingKey = 'services.openai.enableSubtitleTranslation';
                            else continue;
                            break;
                        case 'tencent':
                            if (feature === 'subtitleTranslation') settingKey = 'services.tencent.enableSubtitleTranslation';
                            else continue;
                            break;
                        case 'youdao':
                            if (feature === 'dictionary') settingKey = 'services.youdao.enableDictionary';
                            else continue;
                            break;
                        default:
                            continue;
                    }
                    await this.settingService.set(settingKey, enabled ? 'true' : 'false');
                }
            }
        }
    }

    registerRoutes(): void {
        registerRoute('settings/get-all-services', () => this.getAllServices());
        registerRoute('settings/update-service', (p) => this.updateService(p));
    }
}