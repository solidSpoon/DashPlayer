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
    if (fontSize === 'fontSizeSmall') {
        return '小';
    }
    if (fontSize === 'fontSizeLarge') {
        return '大';
    }
    return '中';
};

const AppearanceSetting = () => {
    const themeSetting = useSetting((state) =>
        state.values.get('appearance.theme')
    );
    const fontSizeSetting = useSetting((state) =>
        state.values.get('appearance.fontSize')
    );

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

    logger.debug('Current fontSize setting', { fontSize: currentFontSize });

    return (
        <form className="w-full flex flex-col">
            <SettingsPage title="外观" description="设置主题与字号">
            <ItemWrapper>
                <Title title="Theme" description="设置主题" />
                <div className="px-3 py-2 h-60 flex-shrink-0 flex overflow-x-scroll scrollbar-thin gap-8 scrollbar-thumb-rounded scrollbar-thumb-gray-400/25">
                    {['dark', 'light'].map((t) => {
                        return (
                            <div
                                key={t}
                                className={cn('h-full flex flex-col gap-2 cursor-pointer')}
                                onClick={() => {
                                    setValue('theme', t as AppearanceFormValues['theme'], {
                                        shouldDirty: true,
                                        shouldTouch: true,
                                    });
                                }}
                            >
                                <div
                                    className={cn(
                                        'p-1 h-full rounded-lg',
                                        currentTheme === t
                                            ? 'border-2 border-primary'
                                            : 'border-2 border-secondary'
                                    )}
                                >
                                    <ThemePreview
                                        theme={t}
                                        className={cn(
                                            `${t} w-80 flex-1 flex-shrink-0 rounded overflow-hidden h-full`
                                        )}
                                    />
                                </div>
                                <div className="text-center">{t}</div>
                            </div>
                        );
                    })}
                </div>
                <Title title="Font Size" description="设置字号" />
                <SliderInput
                    title="字体大小"
                    values={['小', '中', '大']}
                    defaultValue={fontSizeToLabel(currentFontSize)}
                    inputWidth="w-56"
                    setValue={(v) => {
                        if (v === '小') {
                            setValue('fontSize', 'fontSizeSmall', { shouldDirty: true, shouldTouch: true });
                        }
                        if (v === '中') {
                            setValue('fontSize', 'fontSizeMedium', { shouldDirty: true, shouldTouch: true });
                        }
                        if (v === '大') {
                            setValue('fontSize', 'fontSizeLarge', { shouldDirty: true, shouldTouch: true });
                        }
                    }}
                />
            </ItemWrapper>
            </SettingsPage>
        </form>
    );
};

export default AppearanceSetting;
