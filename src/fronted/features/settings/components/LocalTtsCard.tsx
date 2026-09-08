import React from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, FolderOpen } from 'lucide-react';
import { Button } from '@/fronted/components/ui/button';
import { SettingBlockHeader } from '@/fronted/features/settings/components/form';
import LocalModelCard from '@/fronted/features/settings/components/LocalModelCard';
import type { ModelInstallationStatusVO } from '@/common/types/vo/model-installation-vo';
import type { ModelDownloadPhase } from '@/common/contracts/model-download-phase';

export interface LocalTtsCardProps {
    status: ModelInstallationStatusVO | null;
    downloading: boolean;
    deleting: boolean;
    progress: number;
    phase: ModelDownloadPhase;
    onDownload: () => void;
    onCancelDownload: () => void;
    onDelete: () => void;
    onOpenFolder: (path?: string) => void;
    onCopy: (text: string) => void;
    onOpenUrl: (url: string) => void;
}

/**
 * 本地模型卡片中的"单词与例句发音"区块：离线发音模型的下载与删除。
 *
 * 只渲染区块内容，外层"本地模型"卡片由页面提供。
 */
export const LocalTtsCard: React.FC<LocalTtsCardProps> = ({
    status,
    downloading,
    deleting,
    progress,
    phase,
    onDownload,
    onCancelDownload,
    onDelete,
    onOpenFolder,
    onCopy,
    onOpenUrl,
}) => {
    const { t } = useTranslation('settings');
    const cardTitle = t('serviceCredentials.localTts.cardTitle');

    return (
        <div className="p-4 space-y-4">
            <SettingBlockHeader
                title={cardTitle}
                description={t('serviceCredentials.localTts.cardDescription')}
                icon={Cpu}
                action={
                    status?.ready ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenFolder(status.archivePath)}
                        >
                            <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                            {t('common.openFolder')}
                        </Button>
                    ) : null
                }
            />

            <LocalModelCard
                status={status}
                downloading={downloading}
                deleting={deleting}
                progress={progress}
                phase={phase}
                title={cardTitle}
                modelFileLabel={t('serviceCredentials.localTts.modelFile')}
                onDownload={onDownload}
                onCancelDownload={onCancelDownload}
                onDelete={onDelete}
                onOpenFolder={() => onOpenFolder(status?.archivePath)}
                onCopy={onCopy}
                onOpenUrl={onOpenUrl}
            />
        </div>
    );
};
