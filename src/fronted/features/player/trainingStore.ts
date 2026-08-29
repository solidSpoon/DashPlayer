import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { useStoreWithEqualityFn } from 'zustand/traditional';

export interface TrainingModeConfig {
  /** 影子跟读：句末留白暂停时长倍率（本句时长 × 留白倍率，默认 1.5） */
  shadowingRatio: number;
  /** 每句重复 ×N：重复播放遍数（默认 3） */
  repeatTimes: number;
  /** 递进倍速精听：每遍倍速列表（默认 [0.75, 1.0, 1.25]） */
  progressiveRates: number[];
  /** 开启跳过句间空隙 */
  skipGap: boolean;
  /** 开启暂停后回退句首 */
  rewindOnResume: boolean;
}

interface TrainingModeState {
  config: TrainingModeConfig;
  updateConfig: (partial: Partial<TrainingModeConfig>) => void;
  resetConfig: () => void;
}

const DEFAULT_CONFIG: TrainingModeConfig = {
  shadowingRatio: 1.5,
  repeatTimes: 3,
  progressiveRates: [0.75, 1.0, 1.25],
  skipGap: false,
  rewindOnResume: false,
};

export const useTrainingModeStore = create(
  persist(
    subscribeWithSelector<TrainingModeState>((set) => ({
      config: DEFAULT_CONFIG,
      updateConfig: (partial) =>
        set((state) => ({
          config: { ...state.config, ...partial },
        })),
      resetConfig: () => set({ config: DEFAULT_CONFIG }),
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
