import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/fronted/components/ui/dialog';
import { Button } from '@/fronted/components/ui/button';
import { Input } from '@/fronted/components/ui/input';
import { Label } from '@/fronted/components/ui/label';
import { Slider } from '@/fronted/components/ui/slider';
import { Mic, Repeat, Gauge, Sliders, RotateCcw } from 'lucide-react';
import { useTrainingModeStore } from '@/fronted/features/player/trainingStore';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import { usePlayer } from '@/fronted/features/player/playerStore';

interface TrainingSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TrainingSettingsDialog({ open, onOpenChange }: TrainingSettingsDialogProps) {
  const config = useTrainingModeStore((s) => s.config);
  const updateConfig = useTrainingModeStore((s) => s.updateConfig);
  const resetConfig = useTrainingModeStore((s) => s.resetConfig);

  const sentenceLoop = usePlayer((s) => s.sentenceLoop);

  // 本地临时表单状态
  const [shadowingRatio, setShadowingRatio] = useState(config.shadowingRatio);
  const [repeatTimes, setRepeatTimes] = useState(config.repeatTimes);
  const [progressiveRatesStr, setProgressiveRatesStr] = useState(config.progressiveRates.join(', '));

  useEffect(() => {
    if (open) {
      setShadowingRatio(config.shadowingRatio);
      setRepeatTimes(config.repeatTimes);
      setProgressiveRatesStr(config.progressiveRates.join(', '));
    }
  }, [open, config]);

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

    onOpenChange(false);
  };

  const handleReset = () => {
    resetConfig();
    setShadowingRatio(1.5);
    setRepeatTimes(3);
    setProgressiveRatesStr('0.75, 1.0, 1.25');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sliders className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            精听与训练模式参数配置
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-3 text-xs">
          {/* 1. 影子跟读 */}
          <div className="flex flex-col gap-2 p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between font-medium">
              <span className="flex items-center gap-1.5 text-stone-900 dark:text-stone-100">
                <Mic className="w-3.5 h-3.5 text-emerald-500" />
                影子跟读留白倍率
              </span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                {shadowingRatio.toFixed(1)}x
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              当前句播放完毕后原地暂停留白时长 = 原句时长 × {shadowingRatio.toFixed(1)}
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
                每句重复模式遍数
              </span>
              <span className="font-mono text-amber-600 dark:text-amber-400 font-semibold">
                {repeatTimes} 遍
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              开启“每句重复”后，每句连续循环播放的次数
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
                递进精听倍速序列
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              每句按以下倍速依次递进播放，用逗号分隔（范围 0.25x ~ 4.0x）
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={progressiveRatesStr}
                onChange={(e) => setProgressiveRatesStr(e.target.value)}
                placeholder="例如: 0.75, 1.0, 1.25"
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
            恢复默认
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              取消
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              保存配置
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
