import {
  OrchestratorOptions,
  PlayerAdapter,
  SeekRange,
  SubtitleOrchestrator,
  SubtitleSession,
  ViewTarget
} from './types';

/**
 * SubtitleOrchestrator 实现
 * - 以"视图"为准控制播放行为（自动暂停、单句复读）
 * - 提供宏动作（调整 + 预览）
 * - 支持 setEnabled：同页多实例时仅激活一个
 */
export function createOrchestrator<T>(
  session: SubtitleSession<T>,
  player: PlayerAdapter,
  opts?: OrchestratorOptions
): SubtitleOrchestrator {
  const options: OrchestratorOptions = {
    singleRepeat: false,
    autoPause: false,
    inertialSeekMs: 200,
    overdueMs: 600,
    ...opts
  };

  let enabled = true;
  let lastUserSeekAt = 0;
  let previewToken = 0;
  let unTime: (() => void) | null = null;

  const isOverdue = () => (Date.now() - lastUserSeekAt) < (options.overdueMs ?? 600);

  function toView(target: ViewTarget | string): ViewTarget {
    return (typeof target === 'string') ? { kind: 'line', id: target } : target;
  }

  function ensureRange(): SeekRange | null {
    const current = session.getState();
    const v = current.activeView
      ?? (current.activeLineId ? { kind: 'line', id: current.activeLineId } as ViewTarget : null);
    if (!v) return null;
    return session.mapSeekRange(v);
  }

  function tick(time: number) {
    if (!enabled) return;

    // 驱动 Session 时间（高亮刷新）
    if (!isOverdue()) {
      // seek 后的保护窗口内：忽略自然进度以避免抖动
    } else {
      session.tick(time);
    }

    const range = ensureRange();
    if (!range) return;

    if (options.autoPause) {
      if (time > range.end) {
        player.pause();
        // 设置下一次播放的起点
        lastUserSeekAt = Date.now();
        player.seekTo(range.start);
        return;
      }
    }

    if (options.singleRepeat) {
      if (time > range.end) {
        lastUserSeekAt = Date.now();
        player.seekTo(range.start);
        player.play();
      }
    }
  }

  function setEnabled(v: boolean) {
    enabled = v;
  }
  function isEnabled() {
    return enabled;
  }

  function playPreview(start: number, durationSec: number, then: 'loop' | 'pause' | 'none', baseRange: SeekRange) {
    const token = ++previewToken;
    lastUserSeekAt = Date.now();
    player.seekTo(start);
    player.play();

    // 使用播放器时间回调，而非 setTimeout，避免倍速误差
    const cancel = player.onTimeUpdate((t) => {
      if (!enabled || token !== previewToken) {
        cancel();
        return;
      }
      if (t >= start + durationSec) {
        cancel();
        if (then === 'loop') {
          lastUserSeekAt = Date.now();
          player.seekTo(baseRange.start);
          player.play();
        } else if (then === 'pause') {
          lastUserSeekAt = Date.now();
          player.seekTo(baseRange.start);
          player.pause();
        } else {
          // none：不额外处理
        }
      }
    });
  }

  const macros = {
    adjustEndAndPeek: (
      target: ViewTarget | string,
      delta: number,
      opt?: { previewSec?: number; then?: 'loop' | 'pause' | 'none' }
    ) => {
      const view = toView(target);
      session.setActiveView(view);

      if (view.kind === 'line') session.adjustLineEnd(view.id, delta);
      else session.adjustGroupEnd(view.id, delta);

      const range = session.mapSeekRange(view);
      const previewSec = Math.max(0.2, opt?.previewSec ?? 1);
      const startPreviewAt = Math.max(range.start, range.end - previewSec);
      playPreview(startPreviewAt, previewSec, opt?.then ?? 'loop', range);
    },

    adjustStartAndPeek: (
      target: ViewTarget | string,
      delta: number,
      opt?: { previewSec?: number; then?: 'loop' | 'pause' | 'none' }
    ) => {
      const view = toView(target);
      session.setActiveView(view);

      if (view.kind === 'line') session.adjustLineStart(view.id, delta);
      else session.adjustGroupStart(view.id, delta);

      const range = session.mapSeekRange(view);
      const previewSec = Math.max(0.2, opt?.previewSec ?? 1);
      // 规则：调整开始时间后，预览头部，不再"回到开头"
      playPreview(range.start, previewSec, opt?.then ?? 'none', range);
    },

    previewTail: (
      target: ViewTarget | string,
      previewSec = 1,
      opt?: { then?: 'loop' | 'pause' | 'none' }
    ) => {
      const view = toView(target);
      const range = session.mapSeekRange(view);
      const startPreviewAt = Math.max(range.start, range.end - previewSec);
      playPreview(startPreviewAt, previewSec, opt?.then ?? 'none', range);
    },

    previewHead: (
      target: ViewTarget | string,
      previewSec = 1,
      opt?: { then?: 'loop' | 'pause' | 'none' }
    ) => {
      const view = toView(target);
      const range = session.mapSeekRange(view);
      playPreview(range.start, previewSec, opt?.then ?? 'none', range);
    }
  };

  function updateOptions(o: Partial<OrchestratorOptions>) {
    Object.assign(options, o);
  }

  function detach() {
    previewToken++;
    unTime?.();
  }

  // 绑定播放器时间源
  unTime = player.onTimeUpdate((t) => tick(t));

  return {
    tick,
    updateOptions,
    setEnabled,
    isEnabled,
    macros,
    detach
  };
}