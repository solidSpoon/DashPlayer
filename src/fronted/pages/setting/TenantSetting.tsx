import * as React from 'react';
import SettingInput from '@/fronted/pages/setting/components/form/SettingInput';
import SettingsPageShell from '@/fronted/pages/setting/components/form/SettingsPageShell';
import { cn } from '@/fronted/lib/utils';
import { Button } from '@/fronted/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
import useTranslation from '@/fronted/hooks/useTranslation';
import { useForm, Controller } from 'react-hook-form';
import useSetting from '@/fronted/hooks/useSetting';
import { useShallow } from 'zustand/react/shallow';
import { SettingKeyObj } from '@/common/types/store_schema';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import { useTranslation as useI18nTranslation } from 'react-i18next';

const api = backendClient;

type TenantFormValues = {
    translationEngine: 'tencent' | 'openai';
    tencentSecretId: string;
    tencentSecretKey: string;
};

const normalizeEngine = (value: string | undefined): TenantFormValues['translationEngine'] => {
    return value === 'openai' ? 'openai' : 'tencent';
};

const TenantSetting = () => {
    const { t } = useI18nTranslation('settings');
    const storeValues = useSetting(
        useShallow((state) => {
            return {
                translationEngine:
                    state.values.get('subtitleTranslation.engine')
                    ?? SettingKeyObj['subtitleTranslation.engine'],
                tencentSecretId: state.values.get('apiKeys.tencent.secretId') ?? '',
                tencentSecretKey: state.values.get('apiKeys.tencent.secretKey') ?? '',
            };
        })
    );

    const form = useForm<TenantFormValues>({
        defaultValues: {
            translationEngine: normalizeEngine(storeValues.translationEngine),
            tencentSecretId: storeValues.tencentSecretId,
            tencentSecretKey: storeValues.tencentSecretKey,
        },
    });

    const { control, watch, reset, getValues, formState } = form;
    const { isDirty } = formState;

    const [, setAutoSaveStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [, setAutoSaveError] = React.useState<string | null>(null);
    const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingSaveRef = React.useRef<Promise<void> | null>(null);
    const autoSaveIdleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMountedRef = React.useRef(true);

    React.useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    React.useEffect(() => {
        if (!isDirty) {
            reset(
                {
                    translationEngine: normalizeEngine(storeValues.translationEngine),
                    tencentSecretId: storeValues.tencentSecretId,
                    tencentSecretKey: storeValues.tencentSecretKey,
                },
                { keepValues: true }
            );
        }
    }, [isDirty, reset, storeValues]);

    const saveSettings = React.useCallback(async (values: TenantFormValues) => {
        await api.call('settings/translation/update', {
            engine: values.translationEngine,
            tencentSecretId: values.tencentSecretId,
            tencentSecretKey: values.tencentSecretKey,
        });
    }, []);

    const runSave = React.useCallback(async (values: TenantFormValues) => {
        if (autoSaveIdleTimerRef.current) {
            clearTimeout(autoSaveIdleTimerRef.current);
            autoSaveIdleTimerRef.current = null;
        }
        if (isMountedRef.current) {
            setAutoSaveStatus('saving');
            setAutoSaveError(null);
        }
        const promise = (async () => {
            try {
                await saveSettings(values);
                if (isMountedRef.current) {
                    setAutoSaveStatus('saved');
                    reset(values, { keepValues: true });
                    autoSaveIdleTimerRef.current = setTimeout(() => {
                        if (isMountedRef.current) {
                            setAutoSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
                        }
                    }, 2000);
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                if (isMountedRef.current) {
                    setAutoSaveStatus('error');
                    setAutoSaveError(message);
                }
                throw error;
            }
        })();

        pendingSaveRef.current = promise;
        promise.finally(() => {
            if (pendingSaveRef.current === promise) {
                pendingSaveRef.current = null;
            }
        });
        return promise;
    }, [reset, saveSettings]);

    const flushPendingSave = React.useCallback(async () => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }
        if (pendingSaveRef.current) {
            await pendingSaveRef.current;
            return;
        }
        if (!isDirty) {
            return;
        }
        await runSave(getValues());
        if (pendingSaveRef.current) {
            await pendingSaveRef.current;
        }
    }, [getValues, isDirty, runSave]);

    React.useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
                debounceRef.current = null;
            }
            if (autoSaveIdleTimerRef.current) {
                clearTimeout(autoSaveIdleTimerRef.current);
                autoSaveIdleTimerRef.current = null;
            }
            flushPendingSave().catch(() => undefined);
        };
    }, [flushPendingSave]);

    React.useEffect(() => {
        const subscription = watch(() => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
            if (!formState.isDirty) {
                return;
            }
            debounceRef.current = setTimeout(() => {
                runSave(getValues()).catch(() => undefined);
            }, 600);
        });
        return () => subscription.unsubscribe();
    }, [getValues, runSave, watch, formState.isDirty]);

    const { setEngine } = useTranslation();
    const currentEngine = watch('translationEngine');

    React.useEffect(() => {
        setEngine(currentEngine);
    }, [currentEngine, setEngine]);

    const translationEngine = normalizeEngine(currentEngine);

    return (
        <form className="w-full h-full min-h-0">
            <SettingsPageShell
                title={t('tenant.title')}
                description={t('tenant.description')}
                contentClassName="space-y-6"
                actions={(
                    <Button
                        onClick={async () => {
                            await api.call('system/open-url', 'https://solidspoon.xyz/DashPlayer/');
                        }}
                        variant="secondary"
                        type="button"
                    >
                        {t('common.viewDocs')}
                    </Button>
                )}
            >
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">{t('tenant.translationEngineLabel')}</label>
                        <Controller
                            name="translationEngine"
                            control={control}
                            render={({ field }) => (
                                <Select
                                    value={field.value}
                                    onValueChange={(value) => field.onChange(value as TenantFormValues['translationEngine'])}
                                >
                                    <SelectTrigger className="w-64">
                                        <SelectValue placeholder={t('tenant.selectEnginePlaceholder')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="tencent">{t('tenant.engineTencent')}</SelectItem>
                                        <SelectItem value="openai">{t('tenant.engineOpenAi')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        <div className="text-xs text-gray-500">
                            {t('tenant.engineHelp')}
                        </div>
                    </div>

                    {translationEngine === 'tencent' && (
                        <>
                            <Controller
                                name="tencentSecretId"
                                control={control}
                                render={({ field }) => (
                                    <SettingInput
                                        setValue={(value) => field.onChange(value)}
                                        onBlur={field.onBlur}
                                        title={t('tenant.tencentSecretId')}
                                        inputWidth="w-64"
                                        value={field.value ?? ''}
                                    />
                                )}
                            />
                            <Controller
                                name="tencentSecretKey"
                                control={control}
                                render={({ field }) => (
                                    <SettingInput
                                        type="password"
                                        inputWidth="w-64"
                                        placeHolder="******************"
                                        setValue={(value) => field.onChange(value)}
                                        onBlur={field.onBlur}
                                        title={t('tenant.tencentSecretKey')}
                                        value={field.value ?? ''}
                                    />
                                )}
                            />
                            <div className={cn('text-sm text-gray-500 mt-2 flex flex-row gap-2')}>
                                {t('tenant.tencentHintPrefix')}
                                <a
                                    className={cn('underline')}
                                    onClick={async () => {
                                        await api.call('system/open-url', 'https://solidspoon.xyz/DashPlayer/');
                                    }}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {t('common.docs')}
                                </a>
                            </div>
                        </>
                    )}

                    {translationEngine === 'openai' && (
                        <div className={cn('text-sm text-gray-500 p-4 bg-blue-50 rounded-lg')}>
                            {t('tenant.openaiHintLine1')}
                            <br />
                            {t('tenant.openaiHintLine2')}
                        </div>
                    )}
                </div>
            </SettingsPageShell>
        </form>
    );
};

export default TenantSetting;
