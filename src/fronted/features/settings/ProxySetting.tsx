import * as React from 'react';
import useSWR from 'swr';
import SettingsPageShell from '@/fronted/features/settings/components/form/SettingsPageShell';
import SettingInput from '@/fronted/features/settings/components/form/SettingInput';
import { Label } from '@/fronted/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
import { useForm } from 'react-hook-form';
import { useAutoSaveSettingsForm } from '@/fronted/features/settings/useAutoSaveSettingsForm';
import { backendClient } from '@/fronted/infrastructure/electron/backendClient';
import { ProxySettingDetailVO } from '@/common/contracts/proxy-setting-vo';
import { useTranslation as useI18nTranslation } from 'react-i18next';

type ProxyFormValues = {
    mode: ProxySettingDetailVO['mode'];
    url: string;
    bypassRules: string;
};

const normalizeMode = (value: string | undefined): ProxyFormValues['mode'] => {
    if (value === 'custom' || value === 'none') {
        return value;
    }
    return 'system';
};

const ProxySetting = () => {
    const { t } = useI18nTranslation('settings');

    // 与 EngineSelectionSetting / ShortcutSetting 等页面一致：通过 detail 接口取服务端数据。
    const { data: settings } = useSWR<ProxySettingDetailVO>('settings/proxy/detail', () =>
        backendClient.call('settings/proxy/detail'),
    );

    const form = useForm<ProxyFormValues>();
    const { watch, setValue } = form;

    const { ready, initialize, flush } = useAutoSaveSettingsForm<ProxyFormValues>({
        form,
        onSave: async (values) => {
            await backendClient.call('settings/proxy/save', {
                mode: values.mode,
                url: values.url,
                bypassRules: values.bypassRules,
            });
        },
    });

    React.useEffect(() => {
        if (!settings) {
            return;
        }
        initialize({
            mode: normalizeMode(settings.mode),
            url: settings.url,
            bypassRules: settings.bypassRules,
        });
    }, [initialize, settings]);

    if (!ready) {
        return (
            <div className="w-full h-full min-h-0">
                <SettingsPageShell
                    title={t('proxy.title')}
                    description={t('proxy.description')}
                    contentClassName="space-y-8"
                >
                    <></>
                </SettingsPageShell>
            </div>
        );
    }

    const currentMode = normalizeMode(watch('mode'));

    return (
        <form
            className="w-full h-full min-h-0"
            onSubmit={(event) => {
                event.preventDefault();
                flush().catch(() => undefined);
            }}
        >
            <SettingsPageShell
                title={t('proxy.title')}
                description={t('proxy.description')}
                contentClassName="space-y-8"
            >
                <div className="space-y-3">
                    <Label>{t('proxy.modeTitle')}</Label>
                    <div className="w-full md:w-72">
                        <Select
                            value={currentMode}
                            onValueChange={(value: ProxyFormValues['mode']) => {
                                setValue('mode', value, { shouldDirty: true, shouldTouch: true });
                            }}
                        >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="system">{t('proxy.modeSystem')}</SelectItem>
                                <SelectItem value="custom">{t('proxy.modeCustom')}</SelectItem>
                                <SelectItem value="none">{t('proxy.modeNone')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <p className="text-sm text-muted-foreground">{t('proxy.modeDescription')}</p>
                </div>

                {currentMode === 'custom' && (
                    <>
                        <SettingInput
                            title={t('proxy.urlTitle')}
                            description={t('proxy.urlDescription')}
                            value={watch('url') ?? ''}
                            setValue={(value) => setValue('url', value, { shouldDirty: true, shouldTouch: true })}
                            placeHolder="http://127.0.0.1:7890"
                        />
                        <SettingInput
                            title={t('proxy.bypassRulesTitle')}
                            description={t('proxy.bypassRulesDescription')}
                            value={watch('bypassRules') ?? ''}
                            setValue={(value) => setValue('bypassRules', value, { shouldDirty: true, shouldTouch: true })}
                            placeHolder="localhost,127.0.0.1"
                        />
                    </>
                )}
            </SettingsPageShell>
        </form>
    );
};

export default ProxySetting;
