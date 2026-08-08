import * as React from 'react';
import SettingsPageShell from '@/fronted/pages/setting/components/form/SettingsPageShell';
import SettingInput from '@/fronted/pages/setting/components/form/SettingInput';
import { Label } from '@/fronted/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
import useSetting from '@/fronted/hooks/useSetting';
import { useShallow } from 'zustand/react/shallow';
import { useForm } from 'react-hook-form';
import { useAutoSaveSettingsForm } from '@/fronted/hooks/useAutoSaveSettingsForm';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import { useTranslation as useI18nTranslation } from 'react-i18next';

type ProxyMode = 'system' | 'custom' | 'none';

type ProxyFormValues = {
    mode: ProxyMode;
    url: string;
    bypassRules: string;
};

const normalizeMode = (value: string | undefined): ProxyMode => {
    if (value === 'custom' || value === 'none') {
        return value;
    }
    return 'system';
};

const ProxySetting = () => {
    const { t } = useI18nTranslation('settings');
    const storeValues = useSetting(
        useShallow((state) => ({
            mode: state.values.get('proxy.mode') ?? '',
            url: state.values.get('proxy.url') ?? '',
            bypassRules: state.values.get('proxy.bypass_rules') ?? '',
        }))
    );

    const form = useForm<ProxyFormValues>({});
    const { watch, setValue } = form;

    const { initialize, flush } = useAutoSaveSettingsForm<ProxyFormValues>({
        form,
        onSave: async (values) => {
            await backendClient.call('settings/proxy/update', {
                mode: values.mode,
                url: values.url,
                bypassRules: values.bypassRules,
            });
        },
    });

    React.useEffect(() => {
        initialize({
            mode: normalizeMode(storeValues.mode),
            url: storeValues.url,
            bypassRules: storeValues.bypassRules,
        });
    }, [initialize, storeValues.mode, storeValues.url, storeValues.bypassRules]);

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
                            onValueChange={(value: ProxyMode) => {
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
