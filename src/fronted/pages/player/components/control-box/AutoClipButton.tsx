import React, { useEffect, useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { codeBlock } from 'common-tags';
import { Scissors } from 'lucide-react';
import TooltippedButton from '@/fronted/components/shared/common/TooltippedButton';
import useFile from '@/fronted/hooks/useFile';
import { VideoLearningClipStatusVO } from '@/common/types/vo/VideoLearningClipStatusVO';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import { rendererApiRegistry } from '@/fronted/application/bootstrap/rendererApiRegistry';

const logger = getRendererLogger('AutoClipButton');

type ClipStatus = 'pending' | 'in_progress' | 'completed' | 'analyzing';

interface ClipStatusState extends VideoLearningClipStatusVO {
  message?: string;
}

export default function AutoClipButton() {
  const videoPath = useFile((state) => state.videoPath);
  const srtHash = useFile((state) => state.srtHash);
  const subtitlePath = useFile((state) => state.subtitlePath);

  const clipTaskKey = videoPath && srtHash ? `${videoPath}::${srtHash}` : null;
  const clipTaskRequestedAtByKey = useFile((state) => state.clipTaskRequestedAtByKey);
  const markClipTaskRequested = useFile((state) => state.markClipTaskRequested);
  const clearClipTaskRequested = useFile((state) => state.clearClipTaskRequested);
  const clipRequested = clipTaskKey ? !!clipTaskRequestedAtByKey[clipTaskKey] : false;

  // 使用 SWR 获取裁切状态
  const { data: clipStatusData } = useSWR(
    videoPath && srtHash && subtitlePath
      ? ['video-learning/detect-clip-status', videoPath, srtHash, subtitlePath]
      : null,
    async ([, videoPathParam, srtHashParam, subtitlePathParam]) => {
      const result = await backendClient.call('video-learning/detect-clip-status', {
        videoPath: videoPathParam,
        srtKey: srtHashParam,
        srtPath: subtitlePathParam || undefined
      });
      return result as ClipStatusState;
    },
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: true,
      errorRetryCount: 3,
      errorRetryInterval: 1500,
      onError: (error) => {
        logger.error('检测裁切状态失败:', error);
      }
    }
  );

  const [clipStatus, setClipStatus] = useState<ClipStatusState | null>(null);

  useEffect(() => {
    if (videoPath && srtHash && subtitlePath) {
      setClipStatus({ status: 'analyzing', analyzingProgress: 0 });
    } else {
      setClipStatus(null);
    }
  }, [videoPath, srtHash, subtitlePath]);

  // 同步 SWR 数据到本地状态
  useEffect(() => {
    if (clipStatusData) {
      setClipStatus((prev) => {
        const isAnalyzing = clipStatusData.status === 'analyzing';
        const analyzingProgress = isAnalyzing
          ? clipStatusData.analyzingProgress ?? prev?.analyzingProgress ?? 0
          : clipStatusData.analyzingProgress;

        return {
          ...clipStatusData,
          pendingCount:
            clipStatusData.status === 'pending'
              ? clipStatusData.pendingCount ?? 0
              : clipStatusData.pendingCount,
          inProgressCount:
            clipStatusData.status === 'in_progress'
              ? clipStatusData.inProgressCount ?? 0
              : clipStatusData.inProgressCount,
          analyzingProgress
        };
      });
    }
  }, [clipStatusData]);

  useEffect(() => {
    if (clipStatus?.status === 'completed' && clipTaskKey) {
      clearClipTaskRequested(clipTaskKey);
    }
  }, [clipStatus?.status, clipTaskKey, clearClipTaskRequested]);

  // 监听来自后端的状态更新
  useEffect(() => {
    const unregister = rendererApiRegistry.register(
      'video-learning/clip-status-update',
      (params: {
        videoPath: string;
        srtKey: string;
        status: ClipStatus;
        pendingCount?: number;
        inProgressCount?: number;
        completedCount?: number;
        message?: string;
        analyzingProgress?: number;
      }) => {
        if (params.videoPath === videoPath && params.srtKey === srtHash) {
          setClipStatus((prev) => {
            const isAnalyzing = params.status === 'analyzing';
            const analyzingProgress = isAnalyzing
              ? params.analyzingProgress ?? prev?.analyzingProgress ?? 0
              : params.analyzingProgress;

            return {
              status: params.status,
              pendingCount:
                params.status === 'pending'
                  ? params.pendingCount ?? 0
                  : params.pendingCount,
              inProgressCount:
                params.status === 'in_progress'
                  ? params.inProgressCount ?? 0
                  : params.inProgressCount,
              completedCount: params.completedCount,
              message: params.message,
              analyzingProgress
            };
          });
        }
      }
    );
    return () => unregister();
  }, [videoPath, srtHash]);

  const pendingCount = clipStatus?.pendingCount ?? 0;
  const inProgressCount = clipStatus?.inProgressCount ?? 0;
  const analyzingProgress = clipStatus?.analyzingProgress ?? 0;

  const hasExistingClipTask = clipStatus?.status === 'in_progress' || clipRequested;
  const canClip = clipStatus?.status === 'pending' && pendingCount > 0 && !hasExistingClipTask;

  const getButtonText = () => {
    if (!clipStatus?.status) return '裁切生词视频';
    switch (clipStatus.status) {
      case 'analyzing':
        return `分析中 ${analyzingProgress}%`;
      case 'in_progress':
        return `裁切中 (${inProgressCount})`;
      case 'pending':
        return pendingCount > 0
          ? (hasExistingClipTask ? `裁切中 (${inProgressCount || pendingCount})` : `裁切 ${pendingCount} 个生词片段`)
          : '暂无可裁切片段';
      case 'completed':
      default:
        return '暂无可裁切片段';
    }
  };

  const isDisabled = !canClip;

  const disabledReason = (() => {
    if (!clipStatus?.status) return '等待字幕分析完成';
    if (clipStatus.status === 'analyzing') return '正在分析视频内容，请等待完成';
    if (clipStatus.status === 'in_progress') return '正在裁切生词视频中，请等待完成';
    if (clipRequested) return '已创建裁切任务，等待后端开始处理';
    if (!canClip) return '暂无可裁切的生词片段';
    return '';
  })();

  const handleClick = async () => {
    if (!videoPath || !srtHash || !subtitlePath) {
      toast.error('请先加载视频和字幕');
      return;
    }
    if (hasExistingClipTask) {
      toast('已存在裁切任务，请等待完成', { icon: 'ℹ️' });
      return;
    }
    if (!canClip) {
      toast('暂无可裁切的生词片段', { icon: 'ℹ️' });
      return;
    }
    try {
      toast('开始裁切生词视频...', { icon: '✂️' });
      if (clipTaskKey) {
        markClipTaskRequested(clipTaskKey);
      }
      await backendClient.call('video-learning/auto-clip', {
        videoPath,
        srtKey: srtHash,
        srtPath: subtitlePath
      });
    } catch (error) {
      logger.error('生词视频裁切失败:', error);
      if (clipTaskKey) {
        clearClipTaskRequested(clipTaskKey);
      }
      toast.error('生词视频裁切失败，请重试');
    }
  };

  const tooltipMd = codeBlock`
  #### 裁切生词视频
  _根据生词表自动裁切包含生词的视频片段_

  当前状态：${clipStatus?.message || '等待检测...'}
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
      onClick={canClip ? handleClick : undefined}
      tooltipMd={tooltipMd}
      tooltipClassName="p-8 pb-6 rounded-md shadow-lg"
      variant="ghost"
      fullWidth
    />
  );
}
