import { PlayerAdapter } from './types';

/**
 * ReactPlayer 适配器
 * - 将 ReactPlayer 的实例（ref）映射为统一 PlayerAdapter
 * - 内部包含"合并快速 seek"的策略（默认 200ms）
 *
 * 注意：
 * - 该适配器自身不直接订阅 ReactPlayer 的 onProgress。
 * - 需要外部在 ReactPlayer.onProgress 中调用 adapterProgressPipe(playedSeconds)，
 *   或者由 orchestrator 使用 player.onTimeUpdate 返回的取消函数来监听。
 * - 若希望复用你现有的 updateExactPlayTime，可通过 chainProgress 进行链式调用。
 */
export function createReactPlayerAdapter(
  ref: React.RefObject<any>,
  options?: { inertialSeekMs?: number; chainProgress?: (t: number) => void }
): PlayerAdapter & { adapterProgressPipe: (t: number) => void } {
  const inertial = Math.max(0, options?.inertialSeekMs ?? 200);

  let seekTimer: any = null;
  let pendingSeek: number | null = null;

  // 进度订阅管理（允许多个订阅者）
  const timeSubs = new Set<(t: number) => void>();

  function flushSeek() {
    if (pendingSeek == null) return;
    ref.current?.seekTo?.(pendingSeek, 'seconds');
    pendingSeek = null;
    if (seekTimer) {
      clearTimeout(seekTimer);
      seekTimer = null;
    }
  }

  return {
    onTimeUpdate: (cb) => {
      timeSubs.add(cb);
      return () => timeSubs.delete(cb);
    },
    now: () => {
      const el = ref.current?.getInternalPlayer?.() as HTMLVideoElement | undefined;
      return el?.currentTime ?? 0;
    },
    seekTo: (time: number) => {
      pendingSeek = time;
      if (!seekTimer) {
        seekTimer = setTimeout(flushSeek, inertial);
      }
    },
    play: () => {
      const el = ref.current?.getInternalPlayer?.() as HTMLVideoElement | undefined;
      el?.play?.();
    },
    pause: () => {
      const el = ref.current?.getInternalPlayer?.() as HTMLVideoElement | undefined;
      el?.pause?.();
    },
    /**
     * 外部应在 ReactPlayer.onProgress 调用此方法，将 playedSeconds 喂入
     */
    adapterProgressPipe: (t: number) => {
      timeSubs.forEach((cb) => cb(t));
      options?.chainProgress?.(t);
    }
  };
}