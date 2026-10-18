/**
 * 视频控制条的「待命区」尺寸。
 *
 * 控制条的呼出感应区是一块透明的横条：贴片压进这块区域时控制条会让位（抬高或退场），
 * 离开这块区域就回到原位。这个高度同时被三处用到，所以集中在这里：
 * 控制条自己（判断要不要让位）、贴片（拖动时把这块区域画出来给用户看）。
 */

/** 普通视图控制条的待命区高度（含与画面底部的间距）。 */
export const CONTROL_BAR_ZONE_PX = 152;

/** 全屏视图控制条的待命区高度（条更扁，没有额外间距）。 */
export const FULLSCREEN_CONTROL_BAR_ZONE_PX = 132;

/**
 * 量出控制条面板的固定几何量（不随抬升动画变化的那些）。
 *
 * 播放区整体套了一层 CSS 缩放，`getBoundingClientRect` 拿到的是缩放后的视觉像素，
 * 而舞台内部按未缩放的 CSS 像素布局；这里统一折算回舞台的 CSS 像素。
 *
 * 只量「面板相对控制条外层」的关系：两者一起随抬升移动，即使在过渡动画中间量也是准的；
 * 面板绝对位置由调用方用「当前抬升量 + 固定偏移」算出来，避免读到动画中的中间值。
 *
 * @param panel 控制条面板元素。
 * @param wrapper 控制条外层容器（面板的定位容器，跟随抬升整体移动）。
 * @returns 高度、面板底边到外层底边的距离、左右内缩量（CSS 像素）；量不出时返回 null。
 */
export function measureControlBarPanelMetrics(
    panel: HTMLElement,
    wrapper: HTMLElement | null
): { height: number; fromWrapperBottom: number; left: number; right: number; scale: number } | null {
    const stage = wrapper?.parentElement as HTMLElement | null;
    if (!wrapper || !stage) {
        return null;
    }
    const stageRect = stage.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const scale = stage.clientHeight > 0 ? stageRect.height / stage.clientHeight : 0;
    if (scale <= 0) {
        return null;
    }
    return {
        height: Math.round(panelRect.height / scale),
        fromWrapperBottom: Math.max(0, Math.round((wrapperRect.bottom - panelRect.bottom) / scale)),
        left: Math.max(0, Math.round((panelRect.left - wrapperRect.left) / scale)),
        right: Math.max(0, Math.round((wrapperRect.right - panelRect.right) / scale)),
        scale,
    };
}
