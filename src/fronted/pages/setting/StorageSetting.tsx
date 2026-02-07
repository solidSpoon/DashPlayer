import * as React from 'react';
import SettingsPageShell from '@/fronted/pages/setting/components/form/SettingsPageShell';
import { Button } from '@/fronted/components/ui/button';
import SettingInput from '@/fronted/pages/setting/components/form/SettingInput';
import { cn } from '@/fronted/lib/utils';
import { FolderOpen } from 'lucide-react';
import Combobox from '@/fronted/pages/setting/components/form/Combobox';
import useSWR from 'swr';
import { apiPath, swrApiMutate } from '@/fronted/lib/swr-util';
import { Label } from '@/fronted/components/ui/label';
import useFile from '@/fronted/hooks/useFile';
import toast from 'react-hot-toast';
import StrUtil from '@/common/utils/str-util';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import Md from '@/fronted/components/shared/markdown/Markdown';
import { codeBlock } from 'common-tags';
import { useForm, Controller } from 'react-hook-form';
import useSetting from '@/fronted/hooks/useSetting';
import { useShallow } from 'zustand/react/shallow';
import { Input } from '@/fronted/components/ui/input';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import { useTranslation as useI18nTranslation } from 'react-i18next';

const api = backendClient;

type StorageFormValues = {
    path: string;
    collection: string;
};

const StorageSetting = () => {
    const { t } = useI18nTranslation('settings');
    const [size, setSize] = React.useState<string>('0 KB');
    const storeValues = useSetting(
        useShallow((state) => ({
            path: state.values.get('storage.path') ?? '',
            collection: state.values.get('storage.collection') ?? 'default',
        }))
    );

    const form = useForm<StorageFormValues>({
        defaultValues: storeValues,
    });

    const { control, getValues, reset, watch, formState, setValue } = form;
    const { isDirty } = formState;

    const [autoSaveStatus, setAutoSaveStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
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
        const init = async () => {
            const s = await api.call('storage/cache/size');
            setSize(s);
        };
        init();
    }, []);

    React.useEffect(() => {
        if (!isDirty) {
            reset(storeValues, { keepValues: true });
        }
    }, [isDirty, reset, storeValues]);

    const saveSettings = React.useCallback(async (values: StorageFormValues) => {
        await api.call('settings/storage/update', {
            path: values.path,
            collection: values.collection,
        });
    }, []);

    const runSave = React.useCallback(async (values: StorageFormValues) => {
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

    async function reloadOss() {
        try {
            await flushPendingSave();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(t('storage.saveSettingsFailed', { message }));
        }
        await api.call('favorite-clips/sync-from-oss');
        await swrApiMutate('favorite-clips/search');
        useFile.setState({
            subtitlePath: null,
        });
    }

    async function reloadWordLearningClips() {
        try {
            await flushPendingSave();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(t('storage.saveSettingsFailed', { message }));
        }
        const result = await api.call('video-learning/sync-from-oss');
        if (!result?.success) {
            throw new Error(t('storage.syncWordClipsFailed'));
        }
        await swrApiMutate('video-learning/search');
    }

    const handleClear = async () => {
        await api.call('system/reset-db');
    };

    const handleOpen = async () => {
        await api.call('system/open-folder/cache');
    };

    const { data: collectionPaths } = useSWR(apiPath('storage/collection/paths'), (url) => api.call(url));

    const canSyncCollections = !formState.isDirty && autoSaveStatus !== 'saving';

    return (
        <div className="w-full h-full min-h-0">
            <SettingsPageShell
                title={t('storage.title')}
                description={
                    <span>
                        {t('storage.descriptionLine1')}
                        <br />
                        {t('storage.descriptionLine2')}
                    </span>
                }
                contentClassName="space-y-6"
                actions={(
                    <>
                        <Button
                            onClick={handleClear}
                            variant="secondary"
                            type="button"
                        >
                            {t('storage.resetDatabase')}
                        </Button>
                        <Button
                            onClick={handleOpen}
                            variant="secondary"
                            type="button"
                        >
                            {t('storage.openLibraryFolder')}
                        </Button>
                    </>
                )}
            >
                <div className="mt-4 flex text-lg flex-row items-center gap-2">
                    <span>{t('storage.occupiedSpace')}</span>
                    <span>{size}</span>
                </div>

                <div className="flex gap-2 items-start">
                    <Controller
                        name="path"
                        control={control}
                        render={({ field }) => (
                            <SettingInput
                                className={cn('w-fit')}
                                type="text"
                                inputWidth="w-96"
                                placeHolder="Documents/DashPlayer"
                                setValue={(value) => field.onChange(value)}
                                onBlur={field.onBlur}
                                title={t('storage.libraryPathTitle')}
                                value={field.value ?? ''}
                                description={t('storage.libraryPathDescription')}
                            />
                        )}
                    />
                    <Button
                        className="mt-5"
                        variant="outline"
                        size="icon"
                        type="button"
                        onClick={async () => {
                            const folder: string[] = await api.call('system/select-folder', { createDirectory: true });
                            if (folder.length > 0) {
                                const f = `${folder[0]}`;
                                setValue('path', f, { shouldDirty: true, shouldTouch: true });
                            }
                        }}
                    >
                        <FolderOpen />
                    </Button>
                </div>
                <div className="flex gap-2 items-end">
                    <div className={cn('grid items-center gap-1.5 pl-2 w-fit')}>
                        <Label>{t('storage.switchCollection')}</Label>
                        <div className="flex gap-2">
                            <Controller
                                name="collection"
                                control={control}
                                render={({ field }) => (
                                    <Combobox
                                        options={collectionPaths?.map((p) => ({ value: p, label: p })) ?? []}
                                        value={field.value ?? ''}
                                        onSelect={(value) => {
                                            if (StrUtil.isNotBlank(value)) {
                                                field.onChange(value);
                                            }
                                        }}
                                    />
                                )}
                            />
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            disabled={!canSyncCollections}
                                            onClick={async () => {
                                                await toast.promise(reloadOss(), {
                                                    loading: t('storage.collectionSync.loading'),
                                                    success: t('storage.collectionSync.success'),
                                                    error: t('storage.collectionSync.error'),
                                                });
                                            }}
                                            variant="outline"
                                            type="button"
                                        >
                                            {t('storage.collectionSync.button')}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="p-8 pb-6 rounded-md shadow-lg bg-white text-gray-800">
                                        <Md>
                                            {codeBlock`
                                            #### ${t('storage.collectionSync.tooltipTitle')}
                                            ${t('storage.collectionSync.tooltipDescription')}
                                            `}
                                        </Md>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>

                        <p className="text-sm text-muted-foreground">
                            {t('storage.collectionHint')}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 items-end">
                    <div className={cn('grid items-center gap-1.5 pl-2 w-fit')}>
                        <Label>{t('storage.wordClipsTitle')}</Label>
                        <div className="flex gap-2 items-center">
                            <Input
                                value="word_video"
                                readOnly
                                className="w-48"
                            />
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            disabled={!canSyncCollections}
                                            onClick={async () => {
                                                await toast.promise(reloadWordLearningClips(), {
                                                    loading: t('storage.wordClipsSync.loading'),
                                                    success: t('storage.wordClipsSync.success'),
                                                    error: t('storage.wordClipsSync.error'),
                                                });
                                            }}
                                            variant="outline"
                                            type="button"
                                        >
                                            {t('storage.wordClipsSync.button')}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="p-8 pb-6 rounded-md shadow-lg bg-white text-gray-800">
                                        <Md>
                                            {codeBlock`
                                            #### ${t('storage.wordClipsSync.tooltipTitle')}
                                            ${t('storage.wordClipsSync.tooltipDescription')}
                                            `}
                                        </Md>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {t('storage.wordClipsHint')}
                        </p>
                    </div>
                </div>
            </SettingsPageShell>
        </div>
    );
};

export default StorageSetting;
