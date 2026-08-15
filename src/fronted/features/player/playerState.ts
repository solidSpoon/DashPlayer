/**
 * 提供播放器 store 的只读订阅入口，便于组件按需选择状态字段。
 *
 * 说明：
 * - 仅用于订阅“状态”，不暴露任何方法（方法请用 PlayerActions 调用）
 * - 高频字段提醒（默认 progressInterval = 50ms）：
 *   - `s.internal.exactPlayTime`：播放时间（秒），随播放器 `onProgress` 高频更新
 *   - `s.seekTime`：仅在 seek 时更新，适合响应主动跳转
 * - 建议在一次取多项时配合 `shallow`，减少对象重建带来的重渲染
 */

import { usePlayer } from '@/fronted/features/player/playerStore';
import { useStoreWithEqualityFn } from 'zustand/traditional';

const playerStore = usePlayer;

/**
 * 按选择器订阅播放器状态，并可选传入自定义比较函数。
 */
export function usePlayerState<T>(
  selector: (s: ReturnType<typeof usePlayer.getState>) => T,
  equalityFn?: (a: T, b: T) => boolean
): T {
  return useStoreWithEqualityFn(playerStore, selector, equalityFn);
}
