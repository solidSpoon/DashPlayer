// src/fronted/hooks/usePlayerV2State.ts
// 说明：
// - 仅用于订阅"状态"，不暴露任何方法（方法请用 PlayerV2Actions 调用）
// - 高频字段提醒（默认 progressInterval = 50ms）：
//   - s.internal.exactPlayTime：播放时间（秒），随播放器 onProgress 高频更新；尽量在小组件内订阅
//   - s.seekTime：仅在 seek 时更新（非高频，但会在主动跳转时瞬间变化）
// - 建议在需要一次取多项时配合 shallow，减少对象重建导致的重渲染

import { usePlayerV2 } from '@/fronted/hooks/usePlayerV2';
import { useStoreWithEqualityFn } from 'zustand/traditional';

export function usePlayerV2State<T>(
  selector: (s: ReturnType<typeof usePlayerV2.getState>) => T,
  equalityFn?: (a: T, b: T) => boolean
): T {
  return useStoreWithEqualityFn(usePlayerV2, selector, equalityFn);
}
