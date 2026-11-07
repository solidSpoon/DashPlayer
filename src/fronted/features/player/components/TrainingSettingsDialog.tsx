import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/fronted/components/ui/dialog';
import { Button } from '@/fronted/components/ui/button';
import { Input } from '@/fronted/components/ui/input';
import { Slider } from '@/fronted/components/ui/slider';
import { Mic, Repeat, Gauge, Sliders, RotateCcw } from 'lucide-react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTrainingModeStore } from '@/fronted/features/player/trainingStore';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import { usePlayer } from '@/fronted/features/player/playerStore';

interface TrainingSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 训练参数设置弹窗：外壳只负责开关，表单本体交给 TrainingSettingsForm。
 *
 * 表单状态（三项编辑中的值）放在内层：DialogContent 关闭时会卸载内容，
 * 内层随之重挂，state 自然按 store 里的当前配置重新初始化。
 * 这样就不需要在 effect 里监听 open 同步表单——那是 effect 内同步 setState，
 * 会触发级联渲染，也会被 react-hooks/set-state-in-effect 拦下。
 *
 * @param open 弹窗是否打开（受控）。
 * @param onOpenChange 开关回调。
 */
export function TrainingSettingsDialog({ open, onOpenChange }: TrainingSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <TrainingSettingsForm onRequestClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * 训练参数表单本体。
 *
 * 本地编辑态只在挂载时从 store 读一次初值：挂载后再改 store 不会覆盖用户
 * 正在编辑的值；「恢复默认」由 handleReset 显式写回本地态。
 *
 * @param onRequestClose 保存或取消后关闭弹窗。
 */
function TrainingSettingsForm({ onRequestClose }: { onRequestClose: () => void }) {
  const { t } = useI18nTranslation('player');
  const config = useTrainingModeStore((s) => s.config);
  const updateConfig = useTrainingModeStore((s) => s.updateConfig);
  const resetConfig = useTrainingModeStore((s) => s.resetConfig);

  const sentenceLoop = usePlayer((s) => s.sentenceLoop);

  // 本地临时表单状态
  const [shadowingRatio, setShadowingRatio] = useState(config.shadowingRatio);
  const [repeatTimes, setRepeatTimes] = useState(config.repeatTimes);
  const [progressiveRatesStr, setProgressiveRatesStr] = useState(config.progressiveRates.join(', '));

  const handleSave = () => {
    // 解析递进倍速
    const parsedRates = progressiveRatesStr
      .split(/[,，\s]+/)
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n) && n > 0 && n <= 4);

    const safeRates = parsedRates.length > 0 ? parsedRates : [0.75, 1.0, 1.25];
    const safeRepeat = Math.max(Math.min(repeatTimes, 10), 1);
    const safeRatio = Math.max(Math.min(shadowingRatio, 5), 0.5);

    updateConfig({
      shadowingRatio: safeRatio,
      repeatTimes: safeRepeat,
      progressiveRates: safeRates,
    });

    // 如果当前正在运行重复或精听计划，则热更新
    if (sentenceLoop) {
      if (sentenceLoop.rates) {
        playerActions.setSentenceLoop({ times: safeRates.length, rates: safeRates });
      } else {
        playerActions.setSentenceLoop({ times: safeRepeat });
      }
    }

    onRequestClose();
  };

  const handleReset = () => {
    resetConfig();
    setShadowingRatio(1.5);
    setRepeatTimes(3);
    setProgressiveRatesStr('0.75, 1.0, 1.25');
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base">
          <Sliders className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          {t('trainingSettings.title')}
        </DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-5 py-3 text-xs">
        {/* 1. 影子跟读 */}
        <div className="flex flex-col gap-2 p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between font-medium">
            <span className="flex items-center gap-1.5 text-stone-900 dark:text-stone-100">
              <Mic className="w-3.5 h-3.5 text-emerald-500" />
              {t('trainingSettings.shadowingRatio')}
            </span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
              {shadowingRatio.toFixed(1)}x
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t('trainingSettings.shadowingRatioHint', { ratio: shadowingRatio.toFixed(1) })}
          </p>
          <Slider
            value={[shadowingRatio]}
            min={0.5}
            max={3.0}
            step={0.1}
            onValueChange={([v]) => setShadowingRatio(v)}
            className="mt-1"
          />
        </div>

        {/* 2. 每句重复遍数 */}
        <div className="flex flex-col gap-2 p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between font-medium">
            <span className="flex items-center gap-1.5 text-stone-900 dark:text-stone-100">
              <Repeat className="w-3.5 h-3.5 text-amber-500" />
              {t('trainingSettings.repeatTimes')}
            </span>
            <span className="font-mono text-amber-600 dark:text-amber-400 font-semibold">
              {t('trainingSettings.repeatTimesCount', { times: repeatTimes })}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t('trainingSettings.repeatTimesHint')}
          </p>
          <Slider
            value={[repeatTimes]}
            min={1}
            max={10}
            step={1}
            onValueChange={([v]) => setRepeatTimes(v)}
            className="mt-1"
          />
        </div>

        {/* 3. 递进倍速精听 */}
        <div className="flex flex-col gap-2 p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between font-medium">
            <span className="flex items-center gap-1.5 text-stone-900 dark:text-stone-100">
              <Gauge className="w-3.5 h-3.5 text-purple-500" />
              {t('trainingSettings.progressiveRates')}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t('trainingSettings.progressiveRatesHint')}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Input
              value={progressiveRatesStr}
              onChange={(e) => setProgressiveRatesStr(e.target.value)}
              placeholder={t('trainingSettings.progressiveRatesPlaceholder')}
              className="h-8 text-xs font-mono"
            />
          </div>
        </div>
      </div>

      <DialogFooter className="flex items-center justify-between sm:justify-between w-full pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
        >
          <RotateCcw className="w-3 h-3" />
          {t('trainingSettings.reset')}
        </Button>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRequestClose}
            className="text-xs"
          >
            {t('trainingSettings.cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {t('trainingSettings.save')}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
