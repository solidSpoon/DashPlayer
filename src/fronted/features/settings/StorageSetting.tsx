import * as React from 'react';
import SettingsPageShell from '@/fronted/features/settings/components/form/SettingsPageShell';
import { Button } from '@/fronted/components/ui/button';
import SettingInput from '@/fronted/features/settings/components/form/SettingInput';
import { cn } from '@/fronted/lib/utils';
import { FolderOpen } from 'lucide-react';
import { swrApiMutate } from '@/fronted/lib/swr-util';
import { Label } from '@/fronted/components/ui/label';
import useFile from '@/fronted/features/file-browser/fileStore';
import toast from 'react-hot-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import Md from '@/fronted/components/shared/markdown/Markdown';
import { codeBlock } from 'common-tags';
import { useForm, Controller } from 'react-hook-form';
import { Input } from '@/fronted/components/ui/input';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useAutoSaveSettingsForm } from '@/fronted/features/settings/useAutoSaveSettingsForm';
import useSWR from 'swr';
import { StorageStatusVO } from '@/common/types/vo/StorageStatusVO';
import { StorageSettingVO } from '@/common/contracts/storage-setting-vo';

type StorageFormValues = StorageSettingVO;

/**
 * 存储设置页：通过 detail 接口加载媒体库路径，自动保存到 save 接口。
 */
const StorageSetting = () => {
    const { t } = useI18nTranslation('settings');
    const [size, setSize] = React.useState<string>('--');
    const [storageStatus, setStorageStatus] = React.useState<StorageStatusVO | null>(null);

    const { data: detail } = useSWR<StorageSettingVO>('settings/storage/detail', () =>
        settingsApi.getStorage(),
    );

    const form = useForm<StorageFormValues>();
    const { control, formState, setValue } = form;

    /**
     * 查询媒体库目录状态与占用空间。
     *
     * @param configuredPath 当前配置的媒体库路径；查询失败时用于构造错误状态。
     */
    const loadStorageStatus = React.useCallback(async (configuredPath: string) => {
        try {
            const nextStatus = await settingsApi.getStorageStatus();
            setStorageStatus(nextStatus);

            if (!nextStatus.available) {
                setSize('--');
                return;
            }

            const nextSize = await settingsApi.getCacheSize();
            setSize(nextSize);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setStorageStatus({
                configuredPath,
                resolvedPath: configuredPath,
                exists: false,
                isDirectory: false,
                readable: false,
                writable: false,
                available: false,
                code: 'missing',
                message,
            });
            setSize('--');
        }
    }, []);

    const { status: autoSaveStatus, initialize, flush } = useAutoSaveSettingsForm<StorageFormValues>({
        form,
        onSave: async (values) => {
            await settingsApi.saveStorage(values.path);
            await loadStorageStatus(values.path);
        },
    });

    React.useEffect(() => {
        if (!detail) {
            return;
        }
        initialize(detail);
    }, [initialize, detail]);

    React.useEffect(() => {
        if (!detail) {
            return;
        }
        window.setTimeout(() => {
            loadStorageStatus(detail.path).catch(() => undefined);
        }, 0);
    }, [detail, loadStorageStatus]);

    async function reloadOss() {
        try {
            await flush();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(t('storage.saveSettingsFailed', { message }));
        }
        await settingsApi.syncFavouriteFromOss();
        await swrApiMutate('favorite-clips/search');
        useFile.setState({
            subtitlePath: null,
        });
    }

    async function reloadWordLearningClips() {
        try {
            await flush();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(t('storage.saveSettingsFailed', { message }));
        }
        const result = await settingsApi.syncVideoLearningFromOss();
        if (!result?.success) {
            throw new Error(t('storage.syncWordClipsFailed'));
        }
        await swrApiMutate('video-learning/search');
    }

    const handleClear = async () => {
        await settingsApi.resetDatabase();
    };

    const handleOpen = async () => {
        await settingsApi.openCacheFolder();
    };

    const libraryAvailable = storageStatus?.available ?? false;
    const canSyncCollections = libraryAvailable && !formState.isDirty && autoSaveStatus !== 'saving';
    const canOpenLibrary = libraryAvailable;

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
                            disabled={!canOpenLibrary}
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
                            const folder: string[] = await settingsApi.selectStorageFolder({ createDirectory: true });
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
                            <Input
                                value="default"
                                readOnly
                                className="w-48"
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
