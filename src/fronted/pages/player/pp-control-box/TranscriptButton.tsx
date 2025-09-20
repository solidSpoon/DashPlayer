import React from 'react';
import toast from 'react-hot-toast';
import { codeBlock } from 'common-tags';
import { Captions } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import TooltippedButton from '@/fronted/components/common/TooltippedButton';
import useTranscript from '@/fronted/hooks/useTranscript';
import useFile from '@/fronted/hooks/useFile';
import StrUtil from '@/common/utils/str-util';
import { getRendererLogger } from '@/fronted/log/simple-logger';

const logger = getRendererLogger('TranscriptButton');

export default function TranscriptButton() {
  const videoPath = useFile.getState().videoPath;
  const { files } = useTranscript(useShallow((s) => ({ files: s.files })));

  const currentVideoTask = files.find((f) => f.file === videoPath);
  const isInProgress =
    currentVideoTask?.status === 'in_progress' || currentVideoTask?.status === 'init';

  const getStatusText = () => {
    if (!currentVideoTask || !currentVideoTask.status) return '生成字幕';
    switch (currentVideoTask.status) {
      case 'init':
        return '初始化中...';
      case 'in_progress': {
        const message = currentVideoTask.result?.message || '转录中...';
        return message.length > 10 ? message.substring(0, 10) + '...' : message;
      }
      case 'done':
      default:
        return '生成字幕';
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
    const srtPath = useFile.getState().videoPath;
    if (StrUtil.isBlank(srtPath)) {
      toast.error('请先选择一个视频文件');
      return;
    }
    toast('已添加到转录队列', { icon: '👏' });
    await useTranscript.getState().onTranscript(srtPath);
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