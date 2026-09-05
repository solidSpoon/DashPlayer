import * as React from 'react';
import SettingsPageShell from '@/fronted/features/settings/components/form/SettingsPageShell';
import { SettingCard, SettingRow, SettingsLoadingSkeleton } from '@/fronted/features/settings/components/form';
import StorageUsageCard from '@/fronted/features/settings/components/StorageUsageCard';
import { Button } from '@/fronted/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/fronted/components/ui/alert-dialog';
import { FolderOpen, HardDrive, RefreshCw, Trash2, FolderSync } from 'lucide-react';
import { swrApiMutate } from '@/fronted/lib/swr-util';
import useFile from '@/fronted/features/file-browser/fileStore';
import toast from 'react-hot-toast';
import { useForm, Controller } from 'react-hook-form';
import { Input } from '@/fronted/components/ui/input';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useAutoSaveSettingsForm } from '@/fronted/features/settings/useAutoSaveSettingsForm';
import useSWR from 'swr';
import { StorageStatusVO } from '@/common/types/vo/StorageStatusVO';
import { StorageSettingVO } from '@/common/contracts/storage-setting-vo';
import { StorageUsageVO } from '@/common/contracts/storage-usage-vo';

type StorageFormValues = StorageSettingVO;

/**
 * 存储设置页：通过 detail 接口加载媒体库路径，自动保存到 save 接口。
 */
const StorageSetting = () => {
    const { t } = useI18nTranslation('settings');
    const [storageStatus, setStorageStatus] = React.useState<StorageStatusVO | null>(null);
    const [usage, setUsage] = React.useState<StorageUsageVO | null>(null);
    // 初始即为待加载状态，避免首次查询完成前误显示“目录不可用”。
    const [usageLoading, setUsageLoading] = React.useState(true);

    const { data: detail } = useSWR<StorageSettingVO>('settings/storage/detail', () =>
        settingsApi.getStorage(),
    );

    const form = useForm<StorageFormValues>();
    const { control, formState, setValue } = form;

    /**
     * 查询媒体库目录状态与存储用量明细。
     */
    const loadStorageStatus = React.useCallback(async (configuredPath: string) => {
        try {
            const nextStatus = await settingsApi.getStorageStatus();
            setStorageStatus(nextStatus);

            if (!nextStatus.available) {
                setUsage(null);
                return;
            }

            setUsageLoading(true);
            try {
                setUsage(await settingsApi.getStorageUsage());
            } finally {
                setUsageLoading(false);
            }
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
            setUsage(null);
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
            await settingsApi.syncFavouriteFromOss();
            await swrApiMutate('favorite-clips/search');
            useFile.setState({ subtitlePath: null });
            toast.success(t('storage.collectionSync.success'));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            toast.error(`${t('storage.collectionSync.error')}\n${message}`);
        }
    }

    async function reloadWordLearningClips() {
        try {
            await flush();
            const result = await settingsApi.syncVideoLearningFromOss();
            if (!result?.success) {
                throw new Error(t('storage.syncWordClipsFailed'));
            }
            await swrApiMutate('video-learning/search');
            toast.success(t('storage.wordClipsSync.success'));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            toast.error(`${t('storage.wordClipsSync.error')}\n${message}`);
        }
    }

    const handleClear = async () => {
        try {
            await settingsApi.resetDatabase();
            toast.success(t('storage.resetSuccess', { defaultValue: '数据库已成功重置' }));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            toast.error(`${t('storage.resetFailed', { defaultValue: '数据库重置失败' })}\n${message}`);
        }
    };

    const handleOpen = async () => {
        await settingsApi.openCacheFolder();
    };

    /**
     * 手动刷新存储状态与用量明细。
     */
    const handleRefreshUsage = React.useCallback(() => {
        if (!detail) {
            return;
        }
        loadStorageStatus(detail.path).catch(() => undefined);
    }, [detail, loadStorageStatus]);

    const libraryAvailable = storageStatus?.available ?? false;
    const canSyncCollections = libraryAvailable && !formState.isDirty && autoSaveStatus !== 'saving';
    const canOpenLibrary = libraryAvailable;

    if (!detail) {
        return (
            <SettingsLoadingSkeleton
                title={t('storage.title')}
                description={`${t('storage.descriptionLine1')} ${t('storage.descriptionLine2')}`}
            />
        );
    }

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
                    <div className="flex gap-2">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    type="button"
                                >
                                    <Trash2 className="h-4 w-4 mr-1.5" />
                                    {t('storage.resetDatabase')}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>{t('storage.resetConfirmTitle')}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        {t('storage.resetConfirmDescription')}
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>{t('storage.resetConfirmCancel')}</AlertDialogCancel>
                                    <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={() => handleClear().catch(() => undefined)}
                                    >
                                        {t('storage.resetConfirmOk')}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        <Button
                            onClick={handleOpen}
                            variant="outline"
                            size="sm"
                            type="button"
                            disabled={!canOpenLibrary}
                        >
                            <FolderOpen className="h-4 w-4 mr-1.5" />
                            {t('storage.openLibraryFolder')}
                        </Button>
                    </div>
                )}
            >
                {/* 媒体库路径卡片 */}
                <SettingCard
                    title={t('storage.libraryPathTitle')}
                    icon={HardDrive}
                >
                    <SettingRow
                        title={t('storage.libraryPathTitle')}
                        description={t('storage.libraryPathDescription')}
                        icon={FolderOpen}
                    >
                        <div className="flex gap-2 items-center">
                            <Controller
                                name="path"
                                control={control}
                                render={({ field }) => (
                                    <Input
                                        className="w-72 font-mono text-xs"
                                        placeholder="Documents/DashPlayer"
                                        value={field.value ?? ''}
                                        onChange={(e) => field.onChange(e.target.value)}
                                        onBlur={field.onBlur}
                                    />
                                )}
                            />
                            <Button
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
                                <FolderOpen className="h-4 w-4" />
                            </Button>
                        </div>
                    </SettingRow>
                </SettingCard>

                {/* 存储用量卡片 */}
                <StorageUsageCard
                    usage={usage}
                    loading={usageLoading}
                    onRefresh={handleRefreshUsage}
                />

                {/* 资源同步卡片 */}
                <SettingCard
                    title={t('storage.switchCollection')}
                    icon={FolderSync}
                >
                    <SettingRow
                        title={t('storage.switchCollection')}
                        description={t('storage.collectionHint')}
                        icon={RefreshCw}
                    >
                        <Button
                            disabled={!canSyncCollections}
                            onClick={reloadOss}
                            variant="outline"
                            size="sm"
                            type="button"
                        >
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                            {t('storage.collectionSync.button')}
                        </Button>
                    </SettingRow>

                    <SettingRow
                        title={t('storage.wordClipsTitle')}
                        description={t('storage.wordClipsHint')}
                        icon={RefreshCw}
                    >
                        <Button
                            disabled={!canSyncCollections}
                            onClick={reloadWordLearningClips}
                            variant="outline"
                            size="sm"
                            type="button"
                        >
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                            {t('storage.wordClipsSync.button')}
                        </Button>
                    </SettingRow>
                </SettingCard>
            </SettingsPageShell>
        </div>
    );
};

export default StorageSetting;
