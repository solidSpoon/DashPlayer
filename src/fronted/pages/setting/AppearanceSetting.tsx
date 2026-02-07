import React from 'react';
import {
    SliderInput,
    Title,
} from '@/fronted/pages/setting/components/form';
import ThemePreview from '@/fronted/pages/setting/components/ThemePreview';
import SettingsPageShell from '@/fronted/pages/setting/components/form/SettingsPageShell';
import { cn } from '@/fronted/lib/utils';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { useForm } from 'react-hook-form';
import useSetting from '@/fronted/hooks/useSetting';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import { Label } from '@/fronted/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { applyLanguageSetting, AppLanguageSetting } from '@/fronted/i18n';

const logger = getRendererLogger('AppearanceSetting');
const api = backendClient;

type AppearanceFormValues = {
    theme: 'dark' | 'light';
    fontSize: 'fontSizeSmall' | 'fontSizeMedium' | 'fontSizeLarge';
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

const fontSizeToLabel = (fontSize: AppearanceFormValues['fontSize']) => {
    return fontSize;
};

const AppearanceSetting = () => {
    const { t } = useI18nTranslation('settings');
    const themeSetting = useSetting((state) =>
        state.values.get('appearance.theme')
    );
    const fontSizeSetting = useSetting((state) =>
        state.values.get('appearance.fontSize')
    );
    const languageSetting = useSetting((state) =>
        state.values.get('i18n.language')
    );
    const setSetting = useSetting((state) => state.setSetting);

    const form = useForm<AppearanceFormValues>({
        defaultValues: {
            theme: normalizeTheme(themeSetting),
            fontSize: normalizeFontSize(fontSizeSetting),
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
        if (!isDirty) {
            reset({
                theme: normalizedTheme,
                fontSize: normalizedFontSize,
            }, {
                keepValues: true,
            });
        }
    }, [themeSetting, fontSizeSetting, reset, isDirty]);

    const saveSettings = React.useCallback(async (values: AppearanceFormValues) => {
        logger.debug('saving appearance settings', values);
        await api.call('settings/appearance/update', {
            theme: values.theme,
            fontSize: values.fontSize,
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
    const fontSizeOptions: Record<AppearanceFormValues['fontSize'], string> = {
        fontSizeSmall: t('appearance.fontSizeSmall'),
        fontSizeMedium: t('appearance.fontSizeMedium'),
        fontSizeLarge: t('appearance.fontSizeLarge'),
    };
    const currentLanguage = (languageSetting === 'zh-CN' || languageSetting === 'en-US' || languageSetting === 'system'
        ? languageSetting
        : 'system') as AppLanguageSetting;

    logger.debug('Current fontSize setting', { fontSize: currentFontSize });

    return (
        <form className="w-full h-full min-h-0">
            <SettingsPageShell
                title={t('appearance.title')}
                description={t('appearance.description')}
                contentClassName="space-y-8"
            >
                <Title title={t('appearance.themeTitle')} description={t('appearance.themeDescription')} />
                <div className="px-3 py-2 h-60 flex-shrink-0 flex overflow-x-scroll scrollbar-thin gap-8 scrollbar-thumb-rounded scrollbar-thumb-gray-400/25">
                    {['dark', 'light'].map((themeOption) => {
                        return (
                            <div
                                key={themeOption}
                                className={cn('h-full flex flex-col gap-2 cursor-pointer')}
                                onClick={() => {
                                    setValue('theme', themeOption as AppearanceFormValues['theme'], {
                                        shouldDirty: true,
                                        shouldTouch: true,
                                    });
                                }}
                            >
                                <div
                                    className={cn(
                                        'p-1 h-full rounded-lg',
                                        currentTheme === themeOption
                                            ? 'border-2 border-primary'
                                            : 'border-2 border-secondary'
                                    )}
                                >
                                    <ThemePreview
                                        theme={themeOption}
                                        className={cn(
                                            `${themeOption} w-80 flex-1 flex-shrink-0 rounded overflow-hidden h-full`
                                        )}
                                    />
                                </div>
                                <div className="text-center">{themeOption}</div>
                            </div>
                        );
                    })}
                </div>
                <Title title={t('appearance.fontSizeTitle')} description={t('appearance.fontSizeDescription')} />
                <SliderInput
                    title={t('appearance.fontSizeLabel')}
                    values={['fontSizeSmall', 'fontSizeMedium', 'fontSizeLarge']}
                    valueLabelMap={fontSizeOptions}
                    defaultValue={fontSizeToLabel(currentFontSize)}
                    inputWidth="w-56"
                    setValue={(v) => {
                        if (v === 'fontSizeSmall') {
                            setValue('fontSize', 'fontSizeSmall', { shouldDirty: true, shouldTouch: true });
                        }
                        if (v === 'fontSizeMedium') {
                            setValue('fontSize', 'fontSizeMedium', { shouldDirty: true, shouldTouch: true });
                        }
                        if (v === 'fontSizeLarge') {
                            setValue('fontSize', 'fontSizeLarge', { shouldDirty: true, shouldTouch: true });
                        }
                    }}
                />
                <div className="space-y-3">
                    <div>
                        <h1 className="text-lg font-bold mb-2">{t('appearance.languageTitle')}</h1>
                        <p className="text-base text-gray-600">{t('appearance.languageDescription')}</p>
                    </div>
                    <div className="max-w-sm">
                        <Label className="mb-2 block">{t('appearance.languageTitle')}</Label>
                        <Select
                            value={currentLanguage}
                            onValueChange={(value: AppLanguageSetting) => {
                                setSetting('i18n.language', value).catch(() => undefined);
                                applyLanguageSetting(value).catch(() => undefined);
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="system">{t('appearance.languageSystem')}</SelectItem>
                                <SelectItem value="zh-CN">{t('appearance.languageZhCN')}</SelectItem>
                                <SelectItem value="en-US">{t('appearance.languageEnUS')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </SettingsPageShell>
        </form>
    );
};

export default AppearanceSetting;
