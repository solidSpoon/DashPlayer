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
            {/* 顶栏标题区：无分割线 */}
            <div className="px-6 pt-5 pb-2">
                <PageHeader
                    title={t('formatConverter.title')}
                    description={t('formatConverter.description')}
                    rightSlot={
                        <div className="flex items-center gap-2.5 shrink-0">
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
                'flex-1 min-h-0 px-6 pb-5 pt-1',
                isEmpty
                    ? 'flex items-center justify-center'
                    : 'overflow-y-auto scrollbar-thin'
            )}>
                {isEmpty ? (
                    <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-center p-10 text-center rounded-2xl border border-dashed border-border/70 bg-card/40 shadow-2xs">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground border border-border/60 mb-3 shadow-2xs">
                            <Wrench className="h-7 w-7 stroke-1 text-muted-foreground/80" />
                        </div>
                        <h3 className="text-sm font-medium text-foreground mb-1">
                            {t('formatConverter.empty.title')}
                        </h3>
                        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                            {t('formatConverter.empty.guide')}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {folders.map((folder) => {
                            const hasP = folder.videos.some(v => taskStats.get(v) === DpTaskState.IN_PROGRESS);
                            const allP = folder.videos.every(v => taskStats.get(v) === DpTaskState.IN_PROGRESS);
                            return (
                                <Eb key={folder.folder}>
                                    <div className="flex flex-col gap-3.5 border border-border/70 p-4 rounded-2xl bg-card shadow-2xs">
                                        <div className="flex items-center gap-2 pb-1 border-b border-border/40">
                                            <h2 className="text-xs font-semibold text-foreground truncate flex-1 min-w-0 tracking-wide">
                                                {folder?.folder}
                                            </h2>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                                                onClick={() => deleteFolder(folder.folder)}
                                            >
                                                {hasP ? t('formatConverter.cancel') : t('formatConverter.delete')}
                                            </Button>
                                            <Button
                                                disabled={allP}
                                                size="sm"
                                                className="h-7 px-3 text-xs font-medium"
                                                onClick={() => convertFolder(folder.folder)}
                                            >
                                                {t('formatConverter.fix')}
                                            </Button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {folder.videos.map((file) => (
                                                <Eb key={file}>
                                                    <ConvertItem
                                                        buttonVariant="small"
                                                        className="border border-border/50 bg-muted/20 hover:bg-muted/35 transition-colors"
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

                        {files.length > 0 && (
                            <div className="flex flex-col gap-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {files.map((file) => (
                                        <Eb key={file}>
                                            <ConvertItem
                                                className="border border-border/70 rounded-2xl bg-card shadow-2xs hover:border-border transition-colors"
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
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConvertPage;
