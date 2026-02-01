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
import useI18n from '@/fronted/i18n/useI18n';

const logger = getRendererLogger('TranscriptButton');

export default function TranscriptButton() {
  const { t } = useI18n();
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
    if (!currentVideoTask || !currentVideoTask.status) return t('player.transcript.title');
    switch (currentVideoTask.status) {
      case 'init':
        return t('player.transcript.init');
      case 'in_progress': {
        const message = currentVideoTask.result?.message || t('player.transcript.inProgress');
        return message.length > 10 ? message.substring(0, 10) + '...' : message;
      }
      case 'done':
      default:
        return t('player.transcript.title');
    }
  };

  logger.debug('transcript task status', {
    videoPath,
    currentVideoTask,
    isInProgress,
    statusText: getStatusText()
  });

  const tooltipMd = codeBlock`
  #### 生成字幕
  使用人工智能为当前视频生成字幕，保存在视频文件夹中，完成时自动加载。
  `;

  const handleClick = async () => {
    const srtPath = videoPath;
    if (StrUtil.isBlank(srtPath)) {
      toast.error(t('toast.selectVideoFirst'));
      return;
    }
    toast(t('toast.transcriptQueued'), { icon: '👏' });
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
    />
  );
}
