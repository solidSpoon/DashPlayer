/**
 * 公共类型定义
 */

/**
 * 视图目标：
 * - line：单行（id 为行唯一 ID）
 * - group：虚拟组合并（id 为虚拟组 ID）
 */
export type ViewTarget =
  | { kind: 'line'; id: string }
  | { kind: 'group'; id: string };

/**
 * 播放区间（秒）
 */
export interface SeekRange {
  start: number;
  end: number;
}

/**
 * 虚拟组：
 * - 仅包含成员行 ID 列表与 meta 信息
 * - 实际范围通过成员行的有效范围 + 组级微调实时计算
 */
export interface VirtualGroup {
  id: string;
  lineIds: string[];
  meta?: Record<string, any>;
}

/**
 * 可选：外部时间源（若不使用 Orchestrator，可用它驱动 SubtitleSession）
 */
export interface SubtitleClock {
  /**
   * 订阅时间更新（返回取消函数）
   */
  onTimeUpdate: (cb: (time: number) => void) => () => void;
  /**
   * 获取当前时间
   */
  now: () => number;
}

/**
 * SubtitleSession 构造选项
 */
export interface SubtitleSessionOptions<T> {
  /**
   * 会话唯一 ID（用于多实例场景）
   */
  id: string;

  /**
   * 初始字幕行
   */
  lines: T[];

  /**
   * 行唯一 ID 提取函数（需稳定且唯一）
   */
  getId: (line: T) => string;

  /**
   * 行起始时间与结束时间提取函数（秒）
   */
  getStart: (line: T) => number;
  getEnd: (line: T) => number;

  /**
   * 可选：已调整时间（若存在则用作"基线"）
   * - 若返回 null 或 undefined，则使用原始 start/end
   */
  getAdjustedStart?: (line: T) => number | null | undefined;
  getAdjustedEnd?: (line: T) => number | null | undefined;

  /**
   * 时间分桶粒度（秒），用于加速 getByTime，默认 10 秒
   */
  bucketSeconds?: number;
}

/**
 * Session 的可观察状态，用于跨组件共享
 */
export interface SubtitleSessionState {
  /**
   * 当前时间（由 tick/attachClock/orchestrator 驱动）
   */
  time: number;

  /**
   * 当前高亮行 ID（严格按时间反查）
   */
  activeLineId: string | null;

  /**
   * 当前视图目标（line/group）；若为 null，表示"跟随 activeLine"
   */
  activeView: ViewTarget | null;

  /**
   * 所有虚拟组（仅包含 id + lineIds + meta）
   */
  groups: VirtualGroup[];

  /**
   * 当前"视图优先"的播放区间：
   * - 若 activeView != null，则为该视图的范围；
   * - 若 activeView == null 且 activeLine 有值，则为 activeLine 的范围；
   * - 否则为 null。
   */
  activeViewRange: SeekRange | null;
}

/**
 * Session 接口
 */
export interface SubtitleSession<T = any> {
  // ---- 基本查询 ----
  /**
   * 根据时间获取当前行 ID（高效查找）
   */
  getByTime: (time: number) => string | null;

  /**
   * 根据行 ID 获取原始行对象
   */
  getLine: (id: string) => T | null;

  /**
   * 获取行的当前有效区间（含行级微调）
   */
  getLineRange: (id: string) => SeekRange;

  /**
   * 计算任意目标（时间/行ID/行对象/视图）的播放区间
   * - number：按时间落点找到对应行并返回其区间
   * - string：可为行ID或组ID（先匹配行，后匹配组）
   * - T：传入原始行对象（通过 getId 获取 ID）
   * - ViewTarget：指定行/组
   */
  mapSeekRange: (target: number | string | T | ViewTarget) => SeekRange;

  // ---- 视图 ----
  /**
   * 设置当前视图目标（为 null 表示"跟随 activeLine"）
   */
  setActiveView: (target: ViewTarget | null) => void;

  /**
   * 获取当前视图目标
   */
  getActiveView: () => ViewTarget | null;

  // ---- 虚拟组（逻辑合并）----
  /**
   * 创建虚拟组（id 自动生成），返回 groupId
   */
  createGroup: (lineIds: string[], meta?: Record<string, any>) => string;

  /**
   * 更新虚拟组成员行
   */
  updateGroup: (groupId: string, lineIds: string[]) => void;

  /**
   * 移除虚拟组
   */
  removeGroup: (groupId: string) => void;

  /**
   * 列出所有虚拟组
   */
  listGroups: () => VirtualGroup[];

  /**
   * 查询某行所属的虚拟组 ID 列表
   */
  groupsOfLine: (lineId: string) => string[];

  // ---- 时间微调（行/组）----
  /**
   * 行级开始/结束时间微调（delta：+为推后，-为提前，单位秒）
   */
  adjustLineStart: (id: string, delta: number) => void;
  adjustLineEnd: (id: string, delta: number) => void;

  /**
   * 清除行级微调（恢复到基线：adjustedStart/adjustedEnd 或 start/end）
   */
  clearLineAdjust: (id: string) => void;

  /**
   * 组级开始/结束时间微调（单位秒）
   * - 仅影响组视图的整体范围，不改变成员行的时间
   */
  adjustGroupStart: (groupId: string, delta: number) => void;
  adjustGroupEnd: (groupId: string, delta: number) => void;

  /**
   * 清除组级微调
   */
  clearGroupAdjust: (groupId: string) => void;

  /**
   * 查询时间偏移量（相对于基线）：
   * - 对行：返回行级偏移（start/end）
   * - 对组：返回组级偏移（start/end）
   */
  timeDiff: (target: ViewTarget | string | T) => { start: number; end: number };

  /**
   * 判断行是否被调整（阈值默认为 0.05 秒）
   */
  isLineAdjusted: (id: string, deltaThreshold?: number) => boolean;

  // ---- 更新与优先级 ----
  /**
   * 更新行对象（ID 必须稳定不变）
   * - 会保留当前有效时间（在新基线基础上平移）
   */
  updateLine: (newLine: T) => void;

  /**
   * 提升行的优先级（影响同桶内搜索次序，最近被"碰"的排前）
   */
  bumpLine: (id: string) => void;

  // ---- 时间驱动（可选，不使用 Orchestrator 时）----
  /**
   * 手动推进时间，更新 activeLineId/activeViewRange
   */
  tick: (time: number) => void;

  /**
   * 绑定外部时间源（返回取消函数）
   */
  attachClock: (clock: SubtitleClock) => () => void;

  // ---- 状态订阅与读取 ----
  /**
   * 获取当前状态快照
   */
  getState: () => SubtitleSessionState;

  /**
   * 订阅状态片段（selector -> listener），返回取消函数
   */
  subscribe: <S>(
    selector: (s: SubtitleSessionState) => S,
    listener: (next: S, prev: S) => void
  ) => () => void;
}

/**
 * Orchestrator 行为参数
 */
export interface OrchestratorOptions {
  /**
   * 视图范围内循环（单句复读/组复读）
   */
  singleRepeat?: boolean;

  /**
   * 视图结束自动暂停（优先级高于 singleRepeat）
   */
  autoPause?: boolean;

  /**
   * seek 合并时间窗口（毫秒），建议与 PlayerAdapter 对齐
   */
  inertialSeekMs?: number;

  /**
   * seek 后忽略自然进度的时间窗口（毫秒）
   */
  overdueMs?: number;
}

/**
 * 播放器适配接口（外部播放器需要实现）
 */
export interface PlayerAdapter {
  /**
   * 订阅播放器时间更新（返回取消函数）
   * - 需以与播放器进度回调相近的频率调用 cb（例如 50ms）
   */
  onTimeUpdate: (cb: (time: number) => void) => () => void;

  /**
   * 读取当前播放时间（秒）
   */
  now: () => number;

  /**
   * 定位到指定时间（秒）
   * - 建议在适配器内部做"合并快速 seek"
   */
  seekTo: (time: number) => void;

  /**
   * 播放与暂停
   */
  play: () => void;
  pause: () => void;
}

/**
 * Orchestrator 接口
 */
export interface SubtitleOrchestrator {
  /**
   * 使用外部时间推进（若未绑定 onTimeUpdate）
   */
  tick: (time: number) => void;

  /**
   * 更新行为参数（增量）
   */
  updateOptions: (opts: Partial<OrchestratorOptions>) => void;

  /**
   * 启用/禁用（用于同页多实例，仅激活一个）
   */
  setEnabled: (enabled: boolean) => void;
  isEnabled: () => boolean;

  /**
   * 宏动作（高级行为）
   */
  macros: {
    /**
     * 调整结束时间，并在结束处预览 previewSec 秒，之后 then：
     * - 'loop'：回起点并继续循环
     * - 'pause'：回起点并暂停
     * - 'none'：不做额外处理（由当前行为接管）
     * 默认 previewSec=1，then='loop'
     */
    adjustEndAndPeek: (
      target: ViewTarget | string,
      delta: number,
      opt?: { previewSec?: number; then?: 'loop' | 'pause' | 'none' }
    ) => void;

    /**
     * 调整开始时间，并预览头部 previewSec 秒
     * - 默认 then='none'（不回到起点；"已经在开头"的规则）
     */
    adjustStartAndPeek: (
      target: ViewTarget | string,
      delta: number,
      opt?: { previewSec?: number; then?: 'loop' | 'pause' | 'none' }
    ) => void;

    /**
     * 预览尾部 previewSec 秒（默认 then='none'）
     */
    previewTail: (
      target: ViewTarget | string,
      previewSec?: number,
      opt?: { then?: 'loop' | 'pause' | 'none' }
    ) => void;

    /**
     * 预览头部 previewSec 秒（默认 then='none'）
     */
    previewHead: (
      target: ViewTarget | string,
      previewSec?: number,
      opt?: { then?: 'loop' | 'pause' | 'none' }
    ) => void;
  };

  /**
   * 释放资源
   */
  detach: () => void;
}