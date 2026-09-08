import React from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, FolderOpen } from 'lucide-react';
import { Button } from '@/fronted/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
import { SettingBlockHeader } from '@/fronted/features/settings/components/form';
import LocalModelCard from '@/fronted/features/settings/components/LocalModelCard';
import type { TranscriptionEngine } from '@/common/contracts/transcription-engine';
import type { ModelInstallationStatusVO } from '@/common/types/vo/model-installation-vo';
import type { ModelDownloadPhase } from '@/common/contracts/model-download-phase';

export interface LocalTranscriptionCardProps {
    transcriptionEngine: TranscriptionEngine;
    onChangeEngine: (engine: TranscriptionEngine) => void;
    // whisper.cpp 模型状态
    whisperCppStatus: ModelInstallationStatusVO | null;
    whisperCppDownloading: boolean;
    whisperCppDeleting: boolean;
    whisperCppProgress: number;
    whisperCppPhase: ModelDownloadPhase;
    onDownloadWhisperCpp: () => void;
    onCancelWhisperCppDownload: () => void;
    onDeleteWhisperCpp: () => void;
    // sherpa-onnx 模型状态
    parakeetStatus: ModelInstallationStatusVO | null;
    parakeetDownloading: boolean;
    parakeetDeleting: boolean;
    parakeetProgress: number;
    parakeetPhase: ModelDownloadPhase;
    onDownloadParakeet: () => void;
    onCancelParakeetDownload: () => void;
    onDeleteParakeet: () => void;
    // 通用文件夹/链接动作
    onOpenFolder: (path?: string) => void;
    onCopy: (text: string) => void;
    onOpenUrl: (url: string) => void;
}

/**
 * 本地模型卡片中的"字幕语音识别"区块：识别方式切换 + 当前方式所需的模型下载。
 *
 * 只渲染区块内容，外层"本地模型"卡片由页面提供；具体引擎与模型信息
 * 收敛到手动下载教程里。
 */
export const LocalTranscriptionCard: React.FC<LocalTranscriptionCardProps> = ({
    transcriptionEngine,
    onChangeEngine,
    whisperCppStatus,
    whisperCppDownloading,
    whisperCppDeleting,
    whisperCppProgress,
    whisperCppPhase,
    onDownloadWhisperCpp,
    onCancelWhisperCppDownload,
    onDeleteWhisperCpp,
    parakeetStatus,
    parakeetDownloading,
    parakeetDeleting,
    parakeetProgress,
    parakeetPhase,
    onDownloadParakeet,
    onCancelParakeetDownload,
    onDeleteParakeet,
    onOpenFolder,
    onCopy,
    onOpenUrl,
}) => {
    const { t } = useTranslation('settings');

    const activeStatus = transcriptionEngine === 'whisper-cpp' ? whisperCppStatus : parakeetStatus;
    const cardTitle = t('serviceCredentials.transcription.cardTitle');

    return (
        <div className="p-4 space-y-4">
            <SettingBlockHeader
                title={cardTitle}
                description={t('serviceCredentials.transcription.cardDescription')}
                icon={Cpu}
                action={
                    activeStatus?.ready ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenFolder(activeStatus.archivePath)}
                        >
                            <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                            {t('common.openFolder')}
                        </Button>
                    ) : null
                }
            />

            {/* 识别方式切换 */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                    <div className="text-sm font-medium text-foreground">
                        {t('serviceCredentials.transcription.engineLabel')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {t('serviceCredentials.transcription.engineNotice')}
                    </div>
                </div>
                <Select
                    value={transcriptionEngine}
                    onValueChange={(val) => onChangeEngine(val as TranscriptionEngine)}
                >
                    <SelectTrigger className="w-full sm:w-48">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="whisper-cpp">
                            {t('serviceCredentials.transcription.engineHardware')}
                        </SelectItem>
                        <SelectItem value="sherpa-onnx">
                            {t('serviceCredentials.transcription.engineCompat')}
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* 当前识别方式对应的模型下载 */}
            {transcriptionEngine === 'whisper-cpp' ? (
                <LocalModelCard
                    status={whisperCppStatus}
                    downloading={whisperCppDownloading}
                    deleting={whisperCppDeleting}
                    progress={whisperCppProgress}
                    phase={whisperCppPhase}
                    title={cardTitle}
                    modelFileLabel={t('serviceCredentials.transcription.whisperCppModelFile')}
                    onDownload={onDownloadWhisperCpp}
                    onCancelDownload={onCancelWhisperCppDownload}
                    onDelete={onDeleteWhisperCpp}
                    onOpenFolder={() => onOpenFolder(whisperCppStatus?.archivePath)}
                    onCopy={onCopy}
                    onOpenUrl={onOpenUrl}
                />
            ) : (
                <LocalModelCard
                    status={parakeetStatus}
                    downloading={parakeetDownloading}
                    deleting={parakeetDeleting}
                    progress={parakeetProgress}
                    phase={parakeetPhase}
                    title={cardTitle}
                    modelFileLabel={t('serviceCredentials.transcription.sherpaOnnxModelFile')}
                    onDownload={onDownloadParakeet}
                    onCancelDownload={onCancelParakeetDownload}
                    onDelete={onDeleteParakeet}
                    onOpenFolder={() => onOpenFolder(parakeetStatus?.archivePath)}
                    onCopy={onCopy}
                    onOpenUrl={onOpenUrl}
                />
            )}
        </div>
    );
};
