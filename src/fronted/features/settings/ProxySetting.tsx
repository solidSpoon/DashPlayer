import * as React from 'react';
import useSWR from 'swr';
import SettingsPageShell from '@/fronted/features/settings/components/form/SettingsPageShell';
import { SettingCard, SettingRow, SettingsLoadingSkeleton } from '@/fronted/features/settings/components/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
import { Input } from '@/fronted/components/ui/input';
import { Textarea } from '@/fronted/components/ui/textarea';
import { Globe, Shield, Wifi } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { useAutoSaveSettingsForm } from '@/fronted/features/settings/useAutoSaveSettingsForm';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
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
        settingsApi.getProxy(),
    );

    const form = useForm<ProxyFormValues>();
    const { setValue } = form;
    const currentMode = normalizeMode(useWatch({ control: form.control, name: 'mode' }));
    const [url, bypassRules] = useWatch({ control: form.control, name: ['url', 'bypassRules'] });

    const { ready, status: autoSaveStatus, error: autoSaveError, initialize, flush } = useAutoSaveSettingsForm<ProxyFormValues>({
        form,
        onSave: async (values) => {
            await settingsApi.saveProxy({
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
            <SettingsLoadingSkeleton
                title={t('proxy.title')}
                description={t('proxy.description')}
            />
        );
    }

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
                contentClassName="space-y-6"
            >
                {autoSaveStatus === 'error' && autoSaveError && (
                    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                        {autoSaveError}
                    </div>
                )}

                <SettingCard
                    title={t('proxy.modeTitle')}
                    icon={Globe}
                >
                    <SettingRow
                        title={t('proxy.modeTitle')}
                        description={t('proxy.modeDescription')}
                        icon={Wifi}
                    >
                        <Select
                            value={currentMode}
                            onValueChange={(value: ProxyFormValues['mode']) => {
                                setValue('mode', value, { shouldDirty: true, shouldTouch: true });
                            }}
                        >
                            <SelectTrigger className="w-48">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="system">{t('proxy.modeSystem')}</SelectItem>
                                <SelectItem value="custom">{t('proxy.modeCustom')}</SelectItem>
                                <SelectItem value="none">{t('proxy.modeNone')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </SettingRow>

                    {currentMode === 'custom' && (
                        <>
                            <SettingRow
                                title={t('proxy.urlTitle')}
                                description={t('proxy.urlDescription')}
                                icon={Globe}
                            >
                                <Input
                                    value={url ?? ''}
                                    placeholder="http://127.0.0.1:7890"
                                    onChange={(event) => {
                                        setValue('url', event.target.value, {
                                            shouldDirty: true,
                                            shouldTouch: true,
                                        });
                                    }}
                                    className="w-64"
                                />
                            </SettingRow>
                            <SettingRow
                                title={t('proxy.bypassRulesTitle')}
                                description={t('proxy.bypassRulesDescription')}
                                icon={Shield}
                                alignTop
                            >
                                <Textarea
                                    value={bypassRules ?? ''}
                                    placeholder="localhost,127.0.0.1"
                                    rows={2}
                                    onChange={(event) => {
                                        setValue('bypassRules', event.target.value, {
                                            shouldDirty: true,
                                            shouldTouch: true,
                                        });
                                    }}
                                    className="w-64 resize-none text-xs"
                                />
                            </SettingRow>
                        </>
                    )}
                </SettingCard>
            </SettingsPageShell>
        </form>
    );
};

export default ProxySetting;
