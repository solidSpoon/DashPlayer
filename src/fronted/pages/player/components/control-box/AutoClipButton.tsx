import React, { useEffect } from 'react';
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
import { useTranslation as useI18nTranslation } from 'react-i18next';

const logger = getRendererLogger('AutoClipButton');

type ClipStatus = 'pending' | 'in_progress' | 'completed' | 'analyzing';

interface ClipStatusState extends VideoLearningClipStatusVO {
  message?: string;
}

interface AutoClipButtonProps {
  className?: string;
}

export default function AutoClipButton({ className }: AutoClipButtonProps) {
  const { t } = useI18nTranslation('player');
  const videoPath = useFile((state) => state.videoPath);
  const srtHash = useFile((state) => state.srtHash);
  const subtitlePath = useFile((state) => state.subtitlePath);

  const clipTaskKey = videoPath && srtHash ? `${videoPath}::${srtHash}` : null;
  const clipTaskRequestedAtByKey = useFile((state) => state.clipTaskRequestedAtByKey);
  const markClipTaskRequested = useFile((state) => state.markClipTaskRequested);
  const clearClipTaskRequested = useFile((state) => state.clearClipTaskRequested);
  const clipRequested = clipTaskKey ? !!clipTaskRequestedAtByKey[clipTaskKey] : false;
  const canQuery = !!(videoPath && srtHash && subtitlePath);

  // 使用 SWR 获取裁切状态
  const { data: clipStatus, mutate: mutateClipStatus } = useSWR(
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
      // 切回已访问过的视频时，SWR 默认可能直接复用旧 cache（比如初始 0%），这里强制重新拉一次
      revalidateOnMount: true,
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      // 更激进的兜底：分析/裁切进行中时每 1s 拉一次，避免错过 push 导致进度停住
      refreshInterval: (data) => {
        if (data?.status === 'analyzing' || data?.status === 'in_progress') {
          return 1000;
        }
        return 0;
      },
      shouldRetryOnError: true,
      errorRetryCount: 3,
      errorRetryInterval: 1500,
      onError: (error) => {
        logger.error('检测裁切状态失败:', error);
      }
    }
  );

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
        seq?: number;
      }) => {
        if (params.srtKey === srtHash) {
          const applyUpdate = (prev: ClipStatusState | undefined): ClipStatusState | undefined => {
            if (prev?.seq !== undefined && params.seq !== undefined && params.seq <= prev.seq) {
              return prev;
            }

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
              analyzingProgress,
              seq: params.seq ?? prev?.seq,
            };
          };

          // 单一真相源：SWR cache。push 直接写回 cache，避免“切回复用旧 0%”问题。
          void mutateClipStatus((prev) => applyUpdate(prev), { revalidate: false });
        }
      }
    );
    return () => unregister();
  }, [srtHash, mutateClipStatus]);

  const pendingCount = clipStatus?.pendingCount ?? 0;
  const inProgressCount = clipStatus?.inProgressCount ?? 0;
  const analyzingProgress = clipStatus?.analyzingProgress ?? 0;

  const hasExistingClipTask = clipStatus?.status === 'in_progress' || clipRequested;
  const canClip = clipStatus?.status === 'pending' && pendingCount > 0 && !hasExistingClipTask;

  const getButtonText = () => {
    if (!clipStatus?.status) return canQuery ? t('autoClip.detecting') : t('autoClip.button');
    switch (clipStatus.status) {
      case 'analyzing':
        return t('autoClip.analyzing', { progress: analyzingProgress });
      case 'in_progress':
        return t('autoClip.inProgress', { count: inProgressCount });
      case 'pending':
        return pendingCount > 0
          ? (hasExistingClipTask
            ? t('autoClip.inProgress', { count: inProgressCount || pendingCount })
            : t('autoClip.pendingCount', { count: pendingCount }))
          : t('autoClip.noneAvailable');
      case 'completed':
      default:
        return t('autoClip.noneAvailable');
    }
  };

  const isDisabled = !canClip;

  const disabledReason = (() => {
    if (!clipStatus?.status) return canQuery ? t('autoClip.disabledDetecting') : t('autoClip.disabledWaitingAnalysis');
    if (clipStatus.status === 'analyzing') return t('autoClip.disabledAnalyzing');
    if (clipStatus.status === 'in_progress') return t('autoClip.disabledInProgress');
    if (clipRequested) return t('autoClip.disabledRequested');
    if (!canClip) return t('autoClip.noneAvailable');
    return '';
  })();

  const handleClick = async () => {
    if (!videoPath || !srtHash || !subtitlePath) {
      toast.error(t('autoClip.noVideoOrSubtitle'));
      return;
    }
    if (hasExistingClipTask) {
      toast(t('autoClip.taskExists'), { icon: 'ℹ️' });
      return;
    }
    if (!canClip) {
      toast(t('autoClip.noneAvailable'), { icon: 'ℹ️' });
      return;
    }
    try {
      toast(t('autoClip.starting'), { icon: '✂️' });
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
      toast.error(t('autoClip.failed'));
    }
  };

  const tooltipMd = codeBlock`
  #### ${t('autoClip.tooltipTitle')}
  _${t('autoClip.tooltipSubtitle')}_

  ${t('autoClip.currentStatus', { status: clipStatus?.message || t('autoClip.statusWaiting') })}
  ${disabledReason ? `\n**${t('autoClip.noticePrefix', { reason: disabledReason })}**` : ''}

  ${t('autoClip.workflowTitle')}
  1. ${t('autoClip.workflow1')}
  2. ${t('autoClip.workflow2')}
  3. ${t('autoClip.workflow3')}
  4. ${t('autoClip.workflow4')}

  ${t('autoClip.suitableTitle')}
  - ${t('autoClip.suitable1')}
  - ${t('autoClip.suitable2')}
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
      className={className}
    />
  );
}
