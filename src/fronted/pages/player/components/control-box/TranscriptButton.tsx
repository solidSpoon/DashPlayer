import React from 'react';
import toast from 'react-hot-toast';
import { codeBlock } from 'common-tags';
import { Captions } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import TooltippedButton from '@/fronted/components/shared/common/TooltippedButton';
import useTranscript from '@/fronted/hooks/useTranscript';
import useFile from '@/fronted/hooks/useFile';
import StrUtil from '@/common/utils/str-util';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { useTranslation as useI18nTranslation } from 'react-i18next';

const logger = getRendererLogger('TranscriptButton');

interface TranscriptButtonProps {
  className?: string;
}

export default function TranscriptButton({ className }: TranscriptButtonProps) {
  const { t } = useI18nTranslation('player');
  const videoPath = useFile((s) => s.videoPath);
  const { files, onTranscript } = useTranscript(
    useShallow((s) => ({
      files: s.files,
      onTranscript: s.onTranscript,
    }))
  );

  const currentVideoTask = files.find((f) => f.file === videoPath);
  const isInProgress =
    currentVideoTask?.status === 'in_progress' || currentVideoTask?.status === 'init';

  const getStatusText = () => {
    if (!currentVideoTask || !currentVideoTask.status) return t('transcript.button');
    switch (currentVideoTask.status) {
      case 'init':
        return t('transcript.statusInit');
      case 'in_progress': {
        const message = currentVideoTask.result?.message || t('transcript.statusInProgress');
        return message.length > 10 ? message.substring(0, 10) + '...' : message;
      }
      case 'done':
      default:
        return t('transcript.button');
    }
  };

  logger.debug('transcript task status', {
    videoPath,
    currentVideoTask,
    isInProgress,
    statusText: getStatusText()
  });

  const tooltipMd = codeBlock`
  #### ${t('transcript.tooltipTitle')}
  ${t('transcript.tooltipBody')}
  `;

  const handleClick = async () => {
    const srtPath = videoPath;
    if (StrUtil.isBlank(srtPath)) {
      toast.error(t('transcript.noVideoSelected'));
      return;
    }
    toast(t('transcript.addedToQueue'), { icon: '👏' });
    await onTranscript(srtPath);
  };

  return (
    <TooltippedButton
      icon={Captions}
      text={getStatusText()}
      disabled={isInProgress}
      onClick={handleClick}
      tooltipMd={tooltipMd}
      tooltipClassName="p-8 pb-6 rounded-md shadow-lg"
      variant="ghost"
      className={className}
    />
  );
}
