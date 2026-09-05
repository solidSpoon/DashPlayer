import React, { useEffect, useRef } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import toast from 'react-hot-toast';
import { codeBlock } from 'common-tags';
import { Scissors } from 'lucide-react';
import TooltippedButton from '@/fronted/components/shared/common/TooltippedButton';
import useFile from '@/fronted/features/file-browser/fileStore';
import { GlobalVideoLearningClipQueueStatusVO, VideoLearningClipStatusVO } from '@/common/types/vo/VideoLearningClipStatusVO';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { videoLearningApi } from '@/fronted/features/video-learning/videoLearningApi';
import { useVocabularyState } from '@/fronted/features/player/vocabularyStore';
import { registerRendererApi } from '@/fronted/infrastructure/electron/rendererApiRegistry';
import { useTranslation as useI18nTranslation } from 'react-i18next';

const logger = getRendererLogger('AutoClipButton');

type ClipStatus = 'pending' | 'in_progress' | 'completed' | 'analyzing';

interface ClipStatusState extends VideoLearningClipStatusVO {
  message?: string;
}

interface AutoClipButtonProps {
  className?: string;
}

/**
 * 生词视频自动裁切按钮。
 *
 * 展示规则：
 * - 优先展示全局裁切队列状态。
 * - 全局无裁切任务时，再展示当前视频自己的分析/待裁切状态。
 */
export default function AutoClipButton({ className }: AutoClipButtonProps) {
  const { t } = useI18nTranslation('player');
  const { mutate: mutateSWRCache } = useSWRConfig();
  const videoPath = useFile((state) => state.videoPath);
  const srtHash = useFile((state) => state.srtHash);
  const subtitlePath = useFile((state) => state.subtitlePath);
  const canQuery = !!(videoPath && srtHash && subtitlePath);

  const { data: globalQueueStatus, mutate: mutateGlobalQueueStatus } = useSWR<GlobalVideoLearningClipQueueStatusVO>(
    'video-learning/clip-queue-status',
    async () => {
      return await videoLearningApi.getClipQueueStatus();
    },
    {
      revalidateOnMount: true,
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: (data: GlobalVideoLearningClipQueueStatusVO | undefined) => (data?.hasQueuedTasks ? 1000 : 0),
      shouldRetryOnError: true,
      errorRetryCount: 3,
      errorRetryInterval: 1500,
      onError: (error) => {
        logger.error('检测全局裁切队列状态失败', { error });
      }
    }
  );

  // 使用 SWR 获取当前视频裁切状态
  const { data: clipStatus, mutate: mutateClipStatus } = useSWR<ClipStatusState>(
    videoPath && srtHash && subtitlePath
      ? ['video-learning/detect-clip-status', videoPath, srtHash, subtitlePath]
      : null,
    async ([, videoPathParam, srtHashParam, subtitlePathParam]: [string, string, string, string]) => {
      const result = await videoLearningApi.getClipStatus(
        videoPathParam,
        srtHashParam,
        subtitlePathParam || undefined,
      );
      return result as ClipStatusState;
    },
    {
      // 切回已访问过的视频时，SWR 默认可能直接复用旧 cache（比如初始 0%），这里强制重新拉一次
      revalidateOnMount: true,
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: (data) => (data?.status === 'analyzing' ? 1000 : 0),
      shouldRetryOnError: true,
      errorRetryCount: 3,
      errorRetryInterval: 1500,
      onError: (error) => {
        logger.error('检测裁切状态失败', { error });
      }
    }
  );

  /**
   * 词表变化后重新检测当前视频的裁切状态。
   *
   * 收藏生词等改动会让后端词表快照失效，但不会主动重跑检测；
   * 这里监听前端词表版本，变化时主动拉一次状态，
   * 让新收录的生词能及时反映为“待裁切”而非等用户手点。
   */
  const vocabularyVersion = useVocabularyState((state) => state.version);
  const lastVocabularyVersionRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = lastVocabularyVersionRef.current;
    lastVocabularyVersionRef.current = vocabularyVersion;
    if (prev === null || prev === vocabularyVersion || !canQuery) {
      return;
    }
    void mutateClipStatus();
  }, [vocabularyVersion, canQuery, mutateClipStatus]);

  /**
   * 监听当前字幕对应的后端状态推送。
   */
  useEffect(() => {
    const unregister = registerRendererApi(
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
  const globalQueuedCount = globalQueueStatus?.queuedCount ?? 0;
  const isGlobalClipping = globalQueuedCount > 0;

  const canClip = !isGlobalClipping && clipStatus?.status === 'pending' && pendingCount > 0;

  /**
   * 根据当前优先级规则生成按钮文案。
   */
  const getButtonText = () => {
    if (isGlobalClipping) {
      return t('autoClip.cancelInProgress', { count: globalQueuedCount });
    }
    if (!clipStatus?.status) return canQuery ? t('autoClip.detecting') : t('autoClip.button');
    switch (clipStatus.status) {
      case 'analyzing':
        return t('autoClip.analyzing', { progress: analyzingProgress });
      case 'in_progress':
        return t('autoClip.inProgress', { count: inProgressCount });
      case 'pending':
        return pendingCount > 0 ? t('autoClip.pendingCount', { count: pendingCount }) : t('autoClip.noneAvailable');
      case 'completed':
      default:
        return t('autoClip.noneAvailable');
    }
  };

  const isDisabled = !isGlobalClipping && !canClip;

  const disabledReason = (() => {
    if (isGlobalClipping) return t('autoClip.clickToCancel');
    if (!clipStatus?.status) return canQuery ? t('autoClip.disabledDetecting') : t('autoClip.disabledWaitingAnalysis');
    if (clipStatus.status === 'analyzing') return t('autoClip.disabledAnalyzing');
    if (!canClip) return t('autoClip.noneAvailable');
    return '';
  })();

  /**
   * 处理按钮点击。
   *
   * 行为说明：
   * - 全局裁切队列非空时，点击即清空队列。
   * - 否则对当前视频发起自动裁切。
   * - 全局队列状态等待后端确认，避免取消请求先于任务入队。
   * - 取消成功后清除全部视频状态缓存，切回旧视频时重新检测。
   */
  const handleClick = async () => {
    if (isGlobalClipping) {
      try {
        toast(t('autoClip.cancelling'), { icon: '🛑' });
        await videoLearningApi.cancelAllAutoClip();
        await mutateGlobalQueueStatus({ queuedCount: 0, hasQueuedTasks: false }, { revalidate: false });
        await mutateSWRCache(
          (key) => Array.isArray(key) && key[0] === 'video-learning/detect-clip-status',
          undefined,
          { revalidate: false },
        );
        void mutateClipStatus();
        toast.success(t('autoClip.cancelled'));
      } catch (error) {
        logger.error('取消全局生词视频裁切队列失败', { error });
        void mutateGlobalQueueStatus();
        void mutateClipStatus();
        toast.error(t('autoClip.cancelFailed'));
      }
      return;
    }

    if (!videoPath || !srtHash || !subtitlePath) {
      toast.error(t('autoClip.noVideoOrSubtitle'));
      return;
    }
    if (!canClip) {
      toast(t('autoClip.noneAvailable'), { icon: 'ℹ️' });
      return;
    }
    try {
      toast(t('autoClip.starting'), { icon: '✂️' });
      await mutateClipStatus(
        (prev) => prev ? {
          ...prev,
          status: 'in_progress',
          pendingCount: 0,
          inProgressCount: pendingCount,
        } : prev,
        { revalidate: false }
      );
      await videoLearningApi.startAutoClip(videoPath, srtHash, subtitlePath);
      await mutateGlobalQueueStatus();
    } catch (error) {
      logger.error('生词视频裁切失败', { error });
      void mutateGlobalQueueStatus();
      void mutateClipStatus();
      toast.error(t('autoClip.failed'));
    }
  };

  const tooltipStatus = isGlobalClipping
    ? t('autoClip.globalQueueStatus', { count: globalQueuedCount })
    : (clipStatus?.message || t('autoClip.statusWaiting'));

  const tooltipMd = codeBlock`
  #### ${t('autoClip.tooltipTitle')}
  _${t('autoClip.tooltipSubtitle')}_

  ${t('autoClip.currentStatus', { status: tooltipStatus })}
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
      onClick={!isDisabled ? handleClick : undefined}
      tooltipMd={tooltipMd}
      variant="ghost"
      className={className}
    />
  );
}
