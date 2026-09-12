import React from 'react';
import { codeBlock } from 'common-tags';
import { Captions } from 'lucide-react';
import TooltippedButton from '@/fronted/components/shared/common/TooltippedButton';
import useFile from '@/fronted/features/file-browser/fileStore';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import useSWR from 'swr';
import { SWR_KEY } from '@/fronted/lib/swr-util';
import { transcriptApi } from '@/fronted/features/transcript/transcriptApi';
import { useSubtitleSuspicionNudge } from '@/fronted/features/player/hooks/useSubtitleSuspicionNudge';
import { startTranscriptionForCurrentVideo } from '@/fronted/features/player/startTranscription';

/** 播放器转录按钮属性。 */
interface TranscriptButtonProps {
  /** 外部样式类名。 */
  className?: string;
}

/**
 * 展示当前视频的后端转录状态，并允许直接启动转录。
 *
 * 字幕可疑（可能挂错或缺失）且该视频没有排队中/运行中的转录任务时，
 * 图标右上角显示小圆点，提示用户生成字幕。
 *
 * @param props 按钮样式属性。
 * @returns 播放器转录按钮。
 */
export default function TranscriptButton({ className }: TranscriptButtonProps) {
  const { t } = useI18nTranslation('player');
  const videoPath = useFile((s) => s.videoPath);
  const showSubtitleNudge = useSubtitleSuspicionNudge();
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
        const result = currentVideoTask.result;
        if (result?.phase === 'preparing') {
          return t('transcript.statusPreparing');
        }
        if (result?.phase === 'finishing') {
          return t('transcript.statusFinishing');
        }
        if (result?.phase === 'generating') {
          if (typeof result.currentChunk === 'number' && typeof result.totalChunks === 'number' && result.totalChunks > 0) {
            const percent = Math.min(99, Math.floor((result.currentChunk / result.totalChunks) * 100));
            return t('transcript.statusGenerating', { progress: percent });
          }
        }
        const message = result?.message || t('transcript.statusInProgress');
        return message.length > 10 ? message.substring(0, 10) + '...' : message;
      }
      case 'done':
      default:
        return t('transcript.button');
    }
  };

  const tooltipMd = codeBlock`
  #### ${t('transcript.tooltipTitle')}
  ${t('transcript.tooltipBody')}
  `;

  /**
   * 启动当前视频的后端转录任务。
   */
  const handleClick = async (): Promise<void> => {
    await startTranscriptionForCurrentVideo();
    await mutate();
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
      dot={showSubtitleNudge}
    />
  );
}
