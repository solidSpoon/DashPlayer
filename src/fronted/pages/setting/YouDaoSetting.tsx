import * as React from 'react';
import SettingInput from '@/fronted/pages/setting/setting/SettingInput';
import FooterWrapper from '@/fronted/pages/setting/setting/FooterWrapper';
import ItemWrapper from '@/fronted/pages/setting/setting/ItemWrapper';
import Header from '@/fronted/pages/setting/setting/Header';
import { cn } from '@/fronted/lib/utils';
import { Button } from '@/fronted/components/ui/button';
import { useForm, Controller } from 'react-hook-form';
import useSetting from '@/fronted/hooks/useSetting';
import { useShallow } from 'zustand/react/shallow';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';

const api = backendClient;

type YouDaoFormValues = {
    secretId: string;
    secretKey: string;
};

const YouDaoSetting = () => {
    const storeValues = useSetting(
        useShallow((state) => ({
            secretId: state.values.get('apiKeys.youdao.secretId') ?? '',
            secretKey: state.values.get('apiKeys.youdao.secretKey') ?? '',
        }))
    );

    const form = useForm<YouDaoFormValues>({
        defaultValues: storeValues,
    });

    const { control, getValues, reset, watch, formState } = form;
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
            reset(storeValues, { keepValues: true });
        }
    }, [isDirty, reset, storeValues]);

    const saveSettings = React.useCallback(async (values: YouDaoFormValues) => {
        await api.call('settings/youdao/update', {
            secretId: values.secretId,
            secretKey: values.secretKey,
        });
    }, []);

    const runSave = React.useCallback(async (values: YouDaoFormValues) => {
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

    return (
        <form className="w-full h-full flex flex-col gap-4">
            <Header title="查单词" description="配置有道密钥以启用查词功能" />
            <ItemWrapper>
                <Controller
                    name="secretId"
                    control={control}
                    render={({ field }) => (
                        <SettingInput
                            inputWidth="w-64"
                            setValue={(value) => field.onChange(value)}
                            onBlur={field.onBlur}
                            title="secretId"
                            value={field.value ?? ''}
                        />
                    )}
                />
                <Controller
                    name="secretKey"
                    control={control}
                    render={({ field }) => (
                        <SettingInput
                            inputWidth="w-64"
                            setValue={(value) => field.onChange(value)}
                            onBlur={field.onBlur}
                            title="secretKey"
                            value={field.value ?? ''}
                            type="password"
                        />
                    )}
                />
                <div className={cn('text-sm text-gray-500 mt-2 flex flex-row gap-2')}>
                    你需要有道智云的密钥才能使用查单词功能，详见
                    <a
                        className={cn('underline')}
                        onClick={async () => {
                            await api.call('system/open-url', 'https://solidspoon.xyz/DashPlayer/');
                        }}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        文档
                    </a>
                </div>
            </ItemWrapper>
            <FooterWrapper>
                <Button
                    onClick={async () => {
                        await api.call('system/open-url', 'https://solidspoon.xyz/DashPlayer/');
                    }}
            variant="secondary"
            type="button"
        >
            查看文档
        </Button>
        </FooterWrapper>
    </form>
);
};

export default YouDaoSetting;
