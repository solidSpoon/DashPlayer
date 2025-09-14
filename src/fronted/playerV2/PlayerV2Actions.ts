// src/fronted/playerV2/PlayerV2Actions.ts
// 说明：
// - 将所有"行为/命令"集中在此类里，内部仅转调 usePlayerV2.getState()，不改变原有逻辑
// - 组件侧不需要从 hook 读取方法，统一从这里调用，减少 selector 组装带来的额外重渲染

import { usePlayerV2, SeekAction } from '@/fronted/hooks/usePlayerV2';
import { Sentence } from '@/common/types/SentenceC';

export class PlayerV2Actions {
  private get s() {
    return usePlayerV2.getState();
  }

  // 源与字幕
  setSource(src: string | null) { this.s.setSource(src); }
  loadSubtitles(sentences: Sentence[]) { this.s.loadSubtitles(sentences); }
  clearSubtitles() { this.s.clearSubtitles(); }

  // 播放控制
  play() { this.s.play(); }
  pause() { this.s.pause(); }
  togglePlay() { this.s.togglePlay(); }

  // seek
  seekTo(seekTime: SeekAction) { this.s.seekTo(seekTime); }
  seekToTarget(opts: { time: number; target?: Sentence; overrideMs?: number; lockMs?: number }) {
    this.s.seekToTarget(opts);
  }

  // 基础参数
  setDuration(duration: number) { this.s.setDuration(duration); }
  setMuted(muted: boolean) { this.s.setMuted(muted); }
  setVolume(volume: number) { this.s.setVolume(volume); }
  setPlaybackRate(rate: number) { this.s.setPlaybackRate(rate); }

  // 模式
  setAutoPause(v: boolean) { this.s.setAutoPause(v); }
  setSingleRepeat(v: boolean) { this.s.setSingleRepeat(v); }
  setAutoPlayNext(v: boolean) { this.s.setAutoPlayNext(v); }

  /**
   * 高频：updateExactPlayTime
   * - 来源：PlayerEngineV2 -> ReactPlayer.onProgress
   * - 频率：默认 progressInterval = 50ms（可配置）
   * - 建议：避免在大型组件中直接订阅 s.internal.exactPlayTime，
   *   可将进度条/时间显示拆成小组件单独订阅。
   */
  updateExactPlayTime(currentTime: number) { this.s.updateExactPlayTime(currentTime); }

  /**
   * 高频读：getExactPlayTime()
   * - 仅读取当前播放时间；更推荐在 UI 中用只读状态 hook 订阅 s.internal.exactPlayTime。
   */
  getExactPlayTime() { return this.s.getExactPlayTime(); }

  // 范围辅助
  mapCurrentRange() { return this.s.mapCurrentRange(); }
  getVirtualGroupRange() { return this.s.getVirtualGroupRange(); }
  getLoopRange() { return this.s.getLoopRange(); }

  // 播放起点延迟（配合 autoPause）
  onPlaySeek(time: number | null) { this.s.onPlaySeek(time); }

  // 虚拟组
  setVirtualGroupBySentences(ss: Sentence[]) { this.s.setVirtualGroupBySentences(ss); }
  setVirtualGroupByIndexRange(startIndex: number, endIndex: number) { this.s.setVirtualGroupByIndexRange(startIndex, endIndex); }
  clearVirtualGroup() { this.s.clearVirtualGroup(); }

  // 高级 API —— 跳转/重复/调校
  nextSentence(step?: number) { this.s.nextSentence(step); }
  prevSentence(step?: number) { this.s.prevSentence(step); }
  gotoSentenceIndex(index: number) { this.s.gotoSentenceIndex(index); }
  gotoSentence(s: Sentence) { this.s.gotoSentence(s); }
  repeatCurrent(options?: { loop?: boolean }) { this.s.repeatCurrent(options); }
  seekToCurrentStart() { this.s.seekToCurrentStart(); }
  seekToCurrentEnd(epsilon?: number) { this.s.seekToCurrentEnd(epsilon); }

  adjustCurrentBegin(deltaSeconds: number) { this.s.adjustCurrentBegin(deltaSeconds); }
  adjustCurrentEnd(deltaSeconds: number, options?: { previewMs?: number }) { this.s.adjustCurrentEnd(deltaSeconds, options); }
  bumpBegin(deltaSeconds: number) { this.s.bumpBegin(deltaSeconds); }
  bumpEnd(deltaSeconds: number) { this.s.bumpEnd(deltaSeconds); }

  // 只读选择器
  getFocusedSentencePublic() { return this.s.getFocusedSentencePublic(); }
  getFocusedIndex() { return this.s.getFocusedIndex(); }
  getSentenceCount() { return this.s.getSentenceCount(); }
  isAtFirstSentence() { return this.s.isAtFirstSentence(); }
  isAtLastSentence() { return this.s.isAtLastSentence(); }
}

// 单例导出：组件与业务模块统一从这里调用动作
export const playerV2Actions = new PlayerV2Actions();