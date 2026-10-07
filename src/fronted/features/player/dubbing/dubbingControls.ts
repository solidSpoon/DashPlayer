/**
 * 配音录音控制的全局注册通道。
 *
 * useDubbingRecorder 每次渲染把最新动作注册进来，控制条按钮等非 React 上下文的调用方
 * 通过 primary()/cancel() 触发，避免与键盘监听闭包之间产生两套状态。
 */
export interface DubbingControls {
    /** 主操作：空闲时开始录音、录音中停止、回放中跳过回放。 */
    primary: () => void;
    /** 取消当前录音（不保存）。 */
    cancel: () => void;
}

let controls: DubbingControls = {
    primary: () => undefined,
    cancel: () => undefined,
};

/** 注册最新录音控制动作；由 useDubbingRecorder 每次渲染调用。 */
export function registerDubbingControls(next: DubbingControls): void {
    controls = next;
}

/** 触发录音主操作（开始/停止/跳过回放）。 */
export const dubbingControls: DubbingControls = {
    primary: () => controls.primary(),
    cancel: () => controls.cancel(),
};
