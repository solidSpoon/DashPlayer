import React from 'react';
import {
    ItemWrapper,
    SliderInput,
    Title,
} from '@/fronted/pages/setting/components/form';
import ThemePreview from '@/fronted/pages/setting/components/ThemePreview';
import { cn } from '@/fronted/lib/utils';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { useForm } from 'react-hook-form';
import useSetting from '@/fronted/hooks/useSetting';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import SettingsPage from '@/fronted/pages/setting/components/SettingsPage';
import useI18n from '@/fronted/i18n/useI18n';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/fronted/components/ui/select';

const logger = getRendererLogger('AppearanceSetting');
const api = backendClient;

type AppearanceFormValues = {
    theme: 'dark' | 'light';
    fontSize: 'fontSizeSmall' | 'fontSizeMedium' | 'fontSizeLarge';
    uiLanguage: 'system' | 'zh-CN' | 'en-US';
};

const normalizeTheme = (value: string | undefined): AppearanceFormValues['theme'] => {
    return value === 'light' ? 'light' : 'dark';
};

const normalizeFontSize = (value: string | undefined): AppearanceFormValues['fontSize'] => {
    if (value === 'fontSizeSmall' || value === 'fontSizeLarge') {
        return value;
    }
    return 'fontSizeMedium';
};

const normalizeUiLanguage = (value: string | undefined): AppearanceFormValues['uiLanguage'] => {
    if (value === 'zh-CN' || value === 'en-US' || value === 'system') {
        return value;
    }
    return 'system';
};

const AppearanceSetting = () => {
    const { t } = useI18n();
    const themeSetting = useSetting((state) =>
        state.values.get('appearance.theme')
    );
    const fontSizeSetting = useSetting((state) =>
        state.values.get('appearance.fontSize')
    );
    const uiLanguageSetting = useSetting((state) =>
        state.values.get('appearance.uiLanguage')
    );

    const form = useForm<AppearanceFormValues>({
        defaultValues: {
            theme: normalizeTheme(themeSetting),
            fontSize: normalizeFontSize(fontSizeSetting),
            uiLanguage: normalizeUiLanguage(uiLanguageSetting),
        },
    });

    const { watch, setValue, getValues, formState, reset } = form;
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
        const normalizedTheme = normalizeTheme(themeSetting);
        const normalizedFontSize = normalizeFontSize(fontSizeSetting);
        const normalizedUiLanguage = normalizeUiLanguage(uiLanguageSetting);
        if (!isDirty) {
            reset({
                theme: normalizedTheme,
                fontSize: normalizedFontSize,
                uiLanguage: normalizedUiLanguage,
            }, {
                keepValues: true,
            });
        }
    }, [themeSetting, fontSizeSetting, uiLanguageSetting, reset, isDirty]);

    const saveSettings = React.useCallback(async (values: AppearanceFormValues) => {
        logger.debug('saving appearance settings', values);
        await api.call('settings/appearance/update', {
            theme: values.theme,
            fontSize: values.fontSize,
            uiLanguage: values.uiLanguage,
        });
    }, []);

    const runSave = React.useCallback(async (values: AppearanceFormValues) => {
        if (autoSaveIdleTimerRef.current) {
            clearTimeout(autoSaveIdleTimerRef.current);
            autoSaveIdleTimerRef.current = null;
        }
        if (isMountedRef.current) {
            setAutoSaveStatus('saving');
            setAutoSaveError(null);
        }
        const savePromise = (async () => {
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
        pendingSaveRef.current = savePromise;
        savePromise.finally(() => {
            if (pendingSaveRef.current === savePromise) {
                pendingSaveRef.current = null;
            }
        });
        return savePromise;
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
                runSave(getValues()).catch((error) => {
                    logger.error('auto save appearance settings failed', { error });
                });
            }, 600);
        });
        return () => subscription.unsubscribe();
    }, [getValues, runSave, watch, formState.isDirty]);

    const currentTheme = normalizeTheme(watch('theme'));
    const currentFontSize = normalizeFontSize(watch('fontSize'));
    const currentUiLanguage = normalizeUiLanguage(watch('uiLanguage'));

    logger.debug('Current fontSize setting', { fontSize: currentFontSize });

    return (
        <form className="w-full flex flex-col">
            <SettingsPage
                title={t('settings.appearance.title')}
                description={t('settings.appearance.description')}
            >
            <ItemWrapper>
                <Title
                    title={t('settings.appearance.theme.title')}
                    description={t('settings.appearance.theme.description')}
                />
                <div className="px-3 py-2 h-60 flex-shrink-0 flex overflow-x-scroll scrollbar-thin gap-8 scrollbar-thumb-rounded scrollbar-thumb-gray-400/25">
                    {['dark', 'light'].map((theme) => {
                        return (
                            <div
                                key={theme}
                                className={cn('h-full flex flex-col gap-2 cursor-pointer')}
                                onClick={() => {
                                    setValue('theme', theme as AppearanceFormValues['theme'], {
                                        shouldDirty: true,
                                        shouldTouch: true,
                                    });
                                }}
                            >
                                <div
                                    className={cn(
                                        'p-1 h-full rounded-lg',
                                        currentTheme === theme
                                            ? 'border-2 border-primary'
                                            : 'border-2 border-secondary'
                                    )}
                                >
                                    <ThemePreview
                                        theme={theme}
                                        className={cn(
                                            `${theme} w-80 flex-1 flex-shrink-0 rounded overflow-hidden h-full`
                                        )}
                                    />
                                </div>
                                <div className="text-center">
                                    {theme === 'dark'
                                        ? t('settings.appearance.theme.dark')
                                        : t('settings.appearance.theme.light')}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <Title
                    title={t('settings.appearance.fontSize.title')}
                    description={t('settings.appearance.fontSize.description')}
                />
                <SliderInput
                    title={t('settings.appearance.fontSize.label')}
                    options={[
                        { value: 'fontSizeSmall', label: t('settings.appearance.fontSize.small') },
                        { value: 'fontSizeMedium', label: t('settings.appearance.fontSize.medium') },
                        { value: 'fontSizeLarge', label: t('settings.appearance.fontSize.large') },
                    ]}
                    defaultValue={currentFontSize}
                    inputWidth="w-56"
                    setValue={(v) => {
                        setValue('fontSize', normalizeFontSize(v), { shouldDirty: true, shouldTouch: true });
                    }}
                />
                <Title
                    title={t('settings.appearance.uiLanguage.title')}
                    description={t('settings.appearance.uiLanguage.description')}
                />
                <div className="flex items-center gap-4 text-gray-700 select-none">
                    <div className="text-right w-28">{t('settings.appearance.uiLanguage.title')} :</div>
                    <div className="w-56">
                        <Select
                            value={currentUiLanguage}
                            onValueChange={(value) => {
                                setValue('uiLanguage', normalizeUiLanguage(value), { shouldDirty: true, shouldTouch: true });
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={t('settings.appearance.uiLanguage.system')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="system">{t('settings.appearance.uiLanguage.system')}</SelectItem>
                                <SelectItem value="zh-CN">{t('settings.appearance.uiLanguage.zhCN')}</SelectItem>
                                <SelectItem value="en-US">{t('settings.appearance.uiLanguage.enUS')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </ItemWrapper>
            </SettingsPage>
        </form>
    );
};

export default AppearanceSetting;
