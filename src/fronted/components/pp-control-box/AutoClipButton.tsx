import React, { useEffect, useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { codeBlock } from 'common-tags';
import { Scissors } from 'lucide-react';
import TooltippedButton from '@/fronted/components/common/TooltippedButton';
import useFile from '@/fronted/hooks/useFile';
import { VideoLearningClipStatusVO } from '@/common/types/vo/VideoLearningClipStatusVO';
import { getRendererLogger } from '@/fronted/log/simple-logger';

const api = window.electron;
const logger = getRendererLogger('AutoClipButton');

type ClipStatus = 'pending' | 'in_progress' | 'completed';

interface ClipStatusState extends VideoLearningClipStatusVO {
  message?: string;
}

export default function AutoClipButton() {
  const videoPath = useFile.getState().videoPath;
  const srtHash = useFile.getState().srtHash;

  // 使用 SWR 获取裁切状态
  const { data: clipStatusData = { status: 'completed' as const }, mutate: mutateClipStatus } = useSWR(
    videoPath && srtHash ? `video-learning/detect-clip-status-${videoPath}-${srtHash}` : null,
    async () => {
      if (!videoPath || !srtHash) return { status: 'completed' as const };
      try {
        const result = await api.call('video-learning/detect-clip-status', {
          videoPath,
          srtKey: srtHash
        });
        return result as ClipStatusState;
      } catch (error) {
        logger.error('检测裁切状态失败:', error);
        return { status: 'completed' as const };
      }
    },
    { fallbackData: { status: 'completed' as const } }
  );

  const [clipStatus, setClipStatus] = useState<ClipStatusState>({ status: 'completed' as const });

  // 同步 SWR 数据到本地状态
  useEffect(() => {
    if (clipStatusData) setClipStatus(clipStatusData);
  }, [clipStatusData]);

  // 监听来自后端的状态更新
  useEffect(() => {
    const unregister = window.electron.registerRendererApi(
      'video-learning/clip-status-update',
      (params: {
        videoPath: string;
        srtKey: string;
        status: ClipStatus;
        pendingCount?: number;
        inProgressCount?: number;
        completedCount?: number;
        message?: string;
      }) => {
        if (params.videoPath === videoPath && params.srtKey === srtHash) {
          setClipStatus({
            status: params.status,
            pendingCount: params.pendingCount,
            inProgressCount: params.inProgressCount,
            completedCount: params.completedCount,
            message: params.message
          });
          mutateClipStatus(); // 保持与后端同步
        }
      }
    );
    return () => unregister();
  }, [videoPath, srtHash, mutateClipStatus]);

  const getButtonText = () => {
    if (!clipStatus?.status) return '裁切生词视频';
    switch (clipStatus.status) {
      case 'pending':
        return `裁切生词 (${clipStatus.pendingCount || 0})`;
      case 'in_progress':
        return `裁切中 (${clipStatus.inProgressCount || 0})`;
      case 'completed':
      default:
        return '裁切生词视频';
    }
  };

  const isDisabled = clipStatus?.status === 'in_progress' || clipStatus?.status === 'completed';

  const disabledReason =
    clipStatus?.status === 'in_progress'
      ? '正在裁切生词视频中，请等待完成'
      : clipStatus?.status === 'completed'
        ? '生词视频裁切已完成，无需重复操作'
        : '';

  const handleClick = async () => {
    if (!videoPath || !srtHash) {
      toast.error('请先加载视频和字幕');
      return;
    }
    try {
      toast('开始裁切生词视频...', { icon: '✂️' });
      await api.call('video-learning/auto-clip', { videoPath, srtKey: srtHash });
    } catch (error) {
      logger.error('生词视频裁切失败:', error);
      toast.error('生词视频裁切失败，请重试');
    }
  };

  const tooltipMd = codeBlock`
  #### 裁切生词视频
  _根据生词表自动裁切包含生词的视频片段_

  当前状态：${clipStatus.message || '等待检测...'}
  ${disabledReason ? `\n**注意：${disabledReason}**` : ''}

  此功能会：
  1. 读取当前视频的字幕内容
  2. 匹配生词表中的生词
  3. 自动裁切包含生词的视频片段
  4. 保存到视频学习库中

  适用于：
  - 快速创建生词相关的学习视频
  - 批量生成生词学习片段
  `;

  return (
    <TooltippedButton
      icon={Scissors}
      text={getButtonText()}
      disabled={isDisabled}
      onClick={handleClick}
      tooltipMd={tooltipMd}
      tooltipClassName="p-8 pb-6 rounded-md shadow-lg"
      variant="ghost"
      fullWidth
    />
  );
}