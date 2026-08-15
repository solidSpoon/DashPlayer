import { cn } from '@/fronted/lib/utils';
import React from 'react';
import ConvertFileSelector from './components/ConvertFileSelector';
import ConvertFolderSelector from './components/ConvertFolderSelector';
import ConvertItem from './components/ConvertItem';
import useConvert from './convertStore';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/fronted/components/ui/button';
import { DpTaskState } from '@/common/contracts/dp-task';
import Eb from '@/fronted/components/shared/common/Eb';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { convertApi } from './convertApi';
import PageHeader from '@/fronted/components/shared/common/PageHeader';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { Wrench } from 'lucide-react';

const logger = getRendererLogger('Convert');

/** 展示转码队列并组织文件、文件夹选择与批量转换操作。 */
const ConvertPage = () => {
    const { t } = useI18nTranslation('pages');
    const {
        files,
        folders,
        addFiles,
        addFolders,
        taskStats,
        convertFolder,
        deleteFolder,
        deleteFile
    } = useConvert(useShallow(s => ({
        files: s.files,
        folders: s.folders,
        addFiles: s.addFiles,
        addFolders: s.addFolders,
        deleteFolder: s.deleteFolder,
        deleteFile: s.deleteFile,
        taskStats: s.taskStats,
        convertFolder: s.convertFolder
    })));

    const isEmpty = files.length === 0 && folders.length === 0;

    return (
        <div className="w-full h-full flex flex-col overflow-hidden select-none bg-background text-foreground">
            <div className="px-6 pt-6 pb-4 border-b border-border/50">
                <PageHeader
                    title={t('formatConverter.title')}
                    description={t('formatConverter.description')}
                    rightSlot={
                        <div className="flex gap-2 shrink-0">
                            <ConvertFileSelector
                                onSelected={async (ps) => {
                                    addFiles(ps);
                                }}
                            />
                            <ConvertFolderSelector
                                onSelected={async (fp) => {
                                    const folderList = await convertApi.scanFolders(fp);
                                    addFolders(folderList);
                                }}
                            />
                        </div>
                    }
                />
            </div>

            <div className={cn(
                'flex-1 h-0 px-6 pb-6',
                isEmpty
                    ? 'flex items-center justify-center'
                    : 'overflow-y-auto scrollbar-none pt-5'
            )}>
                {isEmpty ? (
                    <div className="flex flex-col items-center gap-4 text-muted-foreground">
                        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                            <Wrench size={28} className="text-muted-foreground/60" />
                        </div>
                        <div className="text-center space-y-1.5">
                            <p className="text-sm font-medium text-foreground">
                                {t('formatConverter.empty.title')}
                            </p>
                            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                                {t('formatConverter.empty.guide')}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {folders.map((folder) => {
                            const hasP = folder.videos.some(v => taskStats.get(v) === DpTaskState.IN_PROGRESS);
                            const allP = folder.videos.every(v => taskStats.get(v) === DpTaskState.IN_PROGRESS);
                            return (
                                <Eb key={folder.folder}>
                                    <div className="flex flex-col gap-4 border p-4 rounded-xl bg-muted/50">
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-sm font-medium text-foreground truncate flex-1 min-w-0">
                                                {folder?.folder}
                                            </h2>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => deleteFolder(folder.folder)}
                                            >
                                                {hasP ? t('formatConverter.cancel') : t('formatConverter.delete')}
                                            </Button>
                                            <Button
                                                disabled={allP}
                                                size="sm"
                                                onClick={() => convertFolder(folder.folder)}
                                            >
                                                {t('formatConverter.fix')}
                                            </Button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            {folder.videos.map((file) => (
                                                <Eb key={file}>
                                                    <ConvertItem
                                                        buttonVariant="small"
                                                        className="bg-background drop-shadow"
                                                        file={file}
                                                        onSelected={() => {
                                                            logger.debug('File selected in convert folder', { file });
                                                        }}
                                                        onDeleted={() => {
                                                            deleteFolder(folder.folder, file);
                                                        }}
                                                    />
                                                </Eb>
                                            ))}
                                        </div>
                                    </div>
                                </Eb>
                            );
                        })}

                        {files.map((file) => (
                            <Eb key={file}>
                                <ConvertItem
                                    className="border rounded-xl"
                                    file={file}
                                    onSelected={() => {
                                        logger.debug('File selected in convert files', { file });
                                    }}
                                    onDeleted={() => {
                                        deleteFile(file);
                                    }}
                                />
                            </Eb>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConvertPage;
