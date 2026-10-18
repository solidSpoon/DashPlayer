import { CONTROL_BAR_TOP_MARGIN_PX } from '@/fronted/features/player/components/controlBarZone';
import { usePlayerUi } from '@/fronted/features/player/playerUiStore';

/** 一条控制条的尺寸：面板高度、待命区高度、与画面底部的间距（均为像素）。 */
export interface HardsubMaskBarMetrics {
    panelHeightPx: number;
    zonePx: number;
    gapPx: number;
}

/** 遮挡贴片对本条控制条的影响，控制条据此决定让位、幽灵态与抬起量。 */
export interface HardsubMaskBarAdjust {
    /** 贴片压进了本条的待命区（不看鼠标，纯几何判断）。 */
    zoneTakenByMask: boolean;
    /** 鼠标压在贴片上、本条应让位隐藏；已扣掉「控制条钉住」的情况。 */
    hiddenByMask: boolean;
    /** 正在拖动贴片：本条降为半透明幽灵，充当自己的位置替身。 */
    ghost: boolean;
    /** 需要抬起的高度（像素）：让整条落在贴片上沿之上，上限保证不被顶出画面。 */
    liftPx: number;
}

/**
 * 算出遮挡贴片对某一条控制条的布局影响。
 *
 * 两条控制条（普通视图、全屏）用的是同一份判断，只是面板尺寸不同，
 * 所以逻辑在这里收一处，避免两边各写一套阈值与上限后悄悄错位。
 *
 * @param metrics 本条控制条的尺寸（见 `controlBarZone.ts`）。
 * @returns 让位、幽灵态与抬起量。
 */
export function useHardsubMaskBarAdjust({
    panelHeightPx,
    zonePx,
    gapPx,
}: HardsubMaskBarMetrics): HardsubMaskBarAdjust {
    const maskOn = usePlayerUi((s) => s.hardsubMaskOn);
    const hovering = usePlayerUi((s) => s.hardsubMaskHovering);
    const dragging = usePlayerUi((s) => s.hardsubMaskDragging);
    const patchTopInset = usePlayerUi((s) => s.hardsubMaskPatchTopInset);
    const patchBottomInset = usePlayerUi((s) => s.hardsubMaskPatchBottomInset);
    const stageHeight = usePlayerUi((s) => s.hardsubMaskStageHeight);
    const pinned = usePlayerUi((s) => s.controlBarPinned);

    // 贴片下沿还在待命区内才算「占用」；挪到画面中上部、底部空出来时本条就待在原位
    const zoneTakenByMask = maskOn && patchBottomInset < zonePx;
    // 钉住是用户明确要求常显，此时不再让位
    const hiddenByMask = zoneTakenByMask && hovering && !pinned;
    const maxLift = Math.max(0, stageHeight - panelHeightPx - gapPx - CONTROL_BAR_TOP_MARGIN_PX);

    return {
        zoneTakenByMask,
        hiddenByMask,
        ghost: dragging,
        liftPx: zoneTakenByMask ? Math.min(maxLift, Math.max(0, patchTopInset)) : 0,
    };
}
