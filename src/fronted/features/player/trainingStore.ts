import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { useStoreWithEqualityFn } from 'zustand/traditional';

/**
 * 训练模式的数值参数：由「自定义训练参数」弹窗编辑并整体持久化。
 * 与 store 顶层的行为开关分开，避免"恢复默认"连带关掉用户勾选的常开行为。
 */
export interface TrainingModeConfig {
  /** 影子跟读：句末留白暂停时长倍率（本句时长 × 留白倍率，默认 1.5） */
  shadowingRatio: number;
  /** 每句重复 ×N：重复播放遍数（默认 3） */
  repeatTimes: number;
  /** 递进倍速精听：每遍倍速列表（默认 [0.75, 1.0, 1.25]） */
  progressiveRates: number[];
}

interface TrainingModeState {
  config: TrainingModeConfig;
  /** 跳过句间空隙：句末越过当前句结尾后直接 seek 到下一句开头。训练模式的唯一真相，随 store 持久化。 */
  skipGap: boolean;
  /** 暂停后回退句首：恢复播放时若已进入本句超过 0.3s，则 seek 回本句开头。训练模式的唯一真相，随 store 持久化。 */
  rewindOnResume: boolean;
  updateConfig: (partial: Partial<TrainingModeConfig>) => void;
  resetConfig: () => void;
  setSkipGap: (v: boolean) => void;
  setRewindOnResume: (v: boolean) => void;
}

const DEFAULT_CONFIG: TrainingModeConfig = {
  shadowingRatio: 1.5,
  repeatTimes: 3,
  progressiveRates: [0.75, 1.0, 1.25],
};

export const useTrainingModeStore = create(
  persist(
    subscribeWithSelector<TrainingModeState>((set) => ({
      config: DEFAULT_CONFIG,
      skipGap: false,
      rewindOnResume: false,
      updateConfig: (partial) =>
        set((state) => ({
          config: { ...state.config, ...partial },
        })),
      resetConfig: () => set({ config: DEFAULT_CONFIG }),
      setSkipGap: (v) => set({ skipGap: v }),
      setRewindOnResume: (v) => set({ rewindOnResume: v }),
    })),
    {
      name: 'dash-player-training-config',
    }
  )
);

export function useTrainingMode<T>(
  selector: (s: TrainingModeState) => T,
  equalityFn?: (a: T, b: T) => boolean
): T {
  return useStoreWithEqualityFn(useTrainingModeStore, selector, equalityFn);
}
