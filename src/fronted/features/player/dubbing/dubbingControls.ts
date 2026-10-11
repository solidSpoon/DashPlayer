/**
 * 配音录音控制的全局注册通道。
 *
 * useDubbingRecorder 每次渲染把最新动作注册进来，控制条按钮等非 React 上下文的调用方
 * 通过这里触发，避免与键盘监听闭包之间产生两套状态。录音键是“按住录音”，所以对外
 * 暴露的是按下/松开两个事件，而不是一个点击动作。
 */
export interface DubbingControls {
    /** 按下（快捷键或录音按钮）：开始长按判定，此时不开麦、界面不动 */
    pressStart: () => void;
    /** 松开：长按成立则停止录音并保存；短按则试听本句已有录音（没录过则无动作） */
    pressEnd: () => void;
    /** 取消当前录音（不保存） */
    cancel: () => void;
}

let controls: DubbingControls = {
    pressStart: () => undefined,
    pressEnd: () => undefined,
    cancel: () => undefined,
};

/** 注册最新录音控制动作；由 useDubbingRecorder 每次渲染调用。 */
export function registerDubbingControls(next: DubbingControls): void {
    controls = next;
}

/** 触发录音控制的全局入口（按下/松开/取消）。 */
export const dubbingControls: DubbingControls = {
    pressStart: () => controls.pressStart(),
    pressEnd: () => controls.pressEnd(),
    cancel: () => controls.cancel(),
};
