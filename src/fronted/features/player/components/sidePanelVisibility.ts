/**
 * 判断「随英文字幕隐藏」此刻是否真的把右侧字幕栏收起来了。
 *
 * 同一个状态要在三处说清楚：播放控制面板的「侧栏」组、控制条字幕弹窗的行提示、
 * 侧栏里的「译文已隐藏」chip。三处各写一遍 `syncSide && !showEn` 迟早会分叉，
 * 变成「面板说侧栏已收起、侧栏却还亮着」这种自相矛盾的界面，因此判定只留这一份实现。
 *
 * @param syncSide 是否让侧栏跟随英文字幕一起隐藏。
 * @param showEn 当前是否显示英文字幕。
 * @returns 侧栏正被英文字幕开关收起时为 true（此时侧栏内容淡出，悬停才短暂出现）。
 */
export function isSidebarHiddenByEnglish(syncSide: boolean, showEn: boolean): boolean {
  return syncSide && !showEn;
}
