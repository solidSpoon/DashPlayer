import React from 'react';
import toast from 'react-hot-toast';
import { codeBlock } from 'common-tags';
import { Captions } from 'lucide-react';
import TooltippedButton from '@/fronted/components/shared/common/TooltippedButton';
import useFile from '@/fronted/features/file-browser/fileStore';
import StrUtil from '@/common/utils/str-util';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import useSWR from 'swr';
import { SWR_KEY } from '@/fronted/lib/swr-util';
import { transcriptApi } from '@/fronted/features/transcript/transcriptApi';
import { usePlayer } from '@/fronted/features/player/playerStore';

const logger = getRendererLogger('TranscriptButton');

/** 播放器转录按钮属性。 */
interface TranscriptButtonProps {
  /** 外部样式类名。 */
  className?: string;
}

/**
 * 展示当前视频的后端转录状态，并允许直接启动转录。
 *
 * @param props 按钮样式属性。
 * @returns 播放器转录按钮。
 */
export default function TranscriptButton({ className }: TranscriptButtonProps) {
  const { t } = useI18nTranslation('player');
  const videoPath = useFile((s) => s.videoPath);
  const currentPosition = usePlayer((s) => s.internal.exactPlayTime);
  const { data: tasks = [], error, mutate } = useSWR(
    SWR_KEY.TRANSCRIPTION_TASKS,
    transcriptApi.listTasks,
  );
  if (error) {
    throw error;
  }

  const currentVideoTask = tasks.find((task) => task.file === videoPath);
  const isInProgress =
    currentVideoTask?.status === 'in_progress' || currentVideoTask?.status === 'init';

  /**
   * 根据后端任务状态生成按钮短文案。
   *
   * @returns 当前按钮文案。
   */
  const getStatusText = (): string => {
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

  /**
   * 启动当前视频的后端转录任务。
   */
  const handleClick = async (): Promise<void> => {
    const srtPath = videoPath;
    if (StrUtil.isBlank(srtPath)) {
      toast.error(t('transcript.noVideoSelected'));
      return;
    }
    const result = await transcriptApi.startTranscription(srtPath, currentPosition);
    await mutate();
    if (result === 'model_missing') {
      toast.error(t('transcript.modelMissing'));
      return;
    }
    toast(t('transcript.addedToQueue'), { icon: '👏' });
  };

  return (
    <TooltippedButton
      icon={Captions}
      text={getStatusText()}
      disabled={isInProgress}
      onClick={handleClick}
      tooltipMd={tooltipMd}
      variant="ghost"
      className={className}
    />
  );
}
