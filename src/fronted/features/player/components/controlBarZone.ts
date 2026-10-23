/**
 * 视频控制条的尺寸常量。
 *
 * 控制条的呼出感应区是一块透明的横条：贴片压进这块区域时控制条会让位（抬高或退场），
 * 离开这块区域就回到原位。待命区由「面板高度 + 底部间距」派生，面板高度只有这里一处定义，
 * 免得改了面板高度、两处判断还各写一个写死的数字。
 */

/** 普通视图控制条面板高度（对应样式 `h-36`）。 */
export const CONTROL_BAR_PANEL_HEIGHT_PX = 144;

/** 全屏视图控制条面板高度（对应样式 `h-32`）。 */
export const FULLSCREEN_CONTROL_BAR_PANEL_HEIGHT_PX = 128;

/** 普通视图控制条与画面底部的间距（对应样式 `bottom-2`）。 */
export const CONTROL_BAR_GAP_PX = 8;

/** 控制条抬起时与画面顶部保留的余量（像素）：保证贴片再高也不会把条顶出画面。 */
export const CONTROL_BAR_TOP_MARGIN_PX = 48;

/** 普通视图控制条的待命区高度：面板高度 + 底部间距。 */
export const CONTROL_BAR_ZONE_PX = CONTROL_BAR_PANEL_HEIGHT_PX + CONTROL_BAR_GAP_PX;

/** 全屏视图控制条的待命区高度：条贴底，没有额外间距。 */
export const FULLSCREEN_CONTROL_BAR_ZONE_PX = FULLSCREEN_CONTROL_BAR_PANEL_HEIGHT_PX;
