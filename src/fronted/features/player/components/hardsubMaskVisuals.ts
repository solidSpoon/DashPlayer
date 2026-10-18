import type { HardsubMaskRect } from '@/fronted/features/player/playerUiStore';

/**
 * 遮挡贴片的视觉样式。
 *
 * - `blur`：单层失焦，最省事；
 * - `blurSampled`：失焦 + 一层从画面采样来的淡色，纠正模糊导致的偏灰；
 * - `sampled`：用画面采样色画一块上下渐变色块，纯色背景下几乎隐形；
 * - `stretch`：把贴片上沿一小条画面拉伸铺满，字幕被「背景的延续」盖住；
 * - `solid`：固定中性色块，最稳但最像打码。
 */
export type HardsubMaskStyle = 'blur' | 'blurSampled' | 'sampled' | 'stretch' | 'solid';

/** 采样用的离屏画布：缩小到这个尺寸取平均色，既够准又便宜。 */
const SAMPLE_SIZE = 8;

let sampler: HTMLCanvasElement | null = null;

/** 惰性创建采样画布，避免在模块顶层碰 DOM。 */
function samplerCanvas(): HTMLCanvasElement {
    if (!sampler) {
        sampler = document.createElement('canvas');
        sampler.width = SAMPLE_SIZE;
        sampler.height = SAMPLE_SIZE;
    }
    return sampler;
}

/**
 * 把视频里指定的一块区域缩到 8×8 求平均色。
 *
 * @param video 视频元素。
 * @param sx 源区域左上角 x（视频像素）。
 * @param sy 源区域左上角 y（视频像素）。
 * @param sw 源区域宽度（视频像素）。
 * @param sh 源区域高度（视频像素）。
 * @returns `rgb(r, g, b)`；视频还没就绪或读不到像素时返回 null。
 */
function averageColor(video: HTMLVideoElement, sx: number, sy: number, sw: number, sh: number): string | null {
    const canvas = samplerCanvas();
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
        return null;
    }
    try {
        ctx.drawImage(video, sx, sy, Math.max(1, sw), Math.max(1, sh), 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        let r = 0;
        let g = 0;
        let b = 0;
        const count = SAMPLE_SIZE * SAMPLE_SIZE;
        for (let i = 0; i < count; i += 1) {
            r += data[i * 4];
            g += data[i * 4 + 1];
            b += data[i * 4 + 2];
        }
        return `rgb(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)})`;
    } catch {
        // 跨源视频会污染画布，读像素时抛错：此时放弃采样，样式退回纯静态
        return null;
    }
}

/**
 * 采样贴片上下两侧的画面颜色，用作色块的渐变色。
 *
 * 取贴片正上方（接近贴片高度的一半）与正下方（画面内还有空间时）两条带，
 * 让色块的明暗从所在位置的画面自然延续过去。
 *
 * @param video 视频元素。
 * @param rect 贴片在画面内的比例矩形。
 * @returns 上/下两个颜色；视频未就绪时返回 null。
 */
export function sampleAroundPatch(
    video: HTMLVideoElement,
    rect: HardsubMaskRect
): { top: string; bottom: string } | null {
    if (video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
        return null;
    }
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const sx = Math.min(Math.max(rect.x, 0), 0.98) * vw;
    const sw = Math.max(2, Math.min(rect.w, 1) * vw);
    const bandHeight = Math.max(2, rect.h * vh * 0.5);

    const topY = Math.max(0, rect.y * vh - bandHeight);
    const bottomY = Math.min(vh - bandHeight, (rect.y + rect.h) * vh);

    const top = averageColor(video, sx, topY, sw, bandHeight);
    if (!top) {
        return null;
    }
    const bottom = averageColor(video, sx, bottomY, sw, bandHeight) ?? top;
    return { top, bottom };
}

/**
 * 把贴片上沿的一小条画面横向拉伸铺满整块画布。
 *
 * 静态背景（天空、墙面、纯色幕布）下几乎看不出覆盖痕迹；动态场景会拉出拖影。
 *
 * @param canvas 目标画布（尺寸按 CSS 像素 × dpr 设好）。
 * @param video 视频元素。
 * @param rect 贴片在画面内的比例矩形。
 */
export function drawStretchedSlice(
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    rect: HardsubMaskRect
): void {
    if (video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
        return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return;
    }
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const sx = Math.min(Math.max(rect.x, 0), 0.98) * vw;
    const sw = Math.max(2, Math.min(rect.w, 1) * vw);
    // 取贴片上沿往上一点的一条细带，作为要延展的「背景纹理」
    const srcHeight = Math.max(2, Math.round(vh * 0.005));
    const sy = Math.min(Math.max(0, rect.y * vh - srcHeight), vh - srcHeight);
    ctx.drawImage(video, sx, sy, sw, srcHeight, 0, 0, canvas.width, canvas.height);
}

/**
 * 生成四边羽化的遮罩（纯色块可用；有 `backdrop-filter` 的元素不能用，会被削掉模糊）。
 *
 * @param feather 羽化带宽度（像素）。
 * @returns 可直接用于 mask-image 的渐变串。
 */
export function edgeFeatherMask(feather: number): string {
    const stops = `transparent 0, rgba(0,0,0,0.25) ${Math.round(feather * 0.35)}px, rgba(0,0,0,0.7) ${Math.round(feather * 0.7)}px, black ${feather}px`;
    const horizontal = `linear-gradient(to right, ${stops}, black calc(100% - ${feather}px), rgba(0,0,0,0.7) calc(100% - ${Math.round(feather * 0.7)}px), rgba(0,0,0,0.25) calc(100% - ${Math.round(feather * 0.35)}px), transparent 100%)`;
    const vertical = `linear-gradient(to bottom, ${stops}, black calc(100% - ${feather}px), rgba(0,0,0,0.7) calc(100% - ${Math.round(feather * 0.7)}px), rgba(0,0,0,0.25) calc(100% - ${Math.round(feather * 0.35)}px), transparent 100%)`;
    return `${horizontal}, ${vertical}`;
}

/**
 * 给 `rgb(r, g, b)` 字符串套一个透明度。
 *
 * @param rgb 形如 `rgb(12, 34, 56)` 的颜色串。
 * @param alpha 目标透明度（0~1）。
 * @returns 形如 `rgba(12, 34, 56, 0.18)` 的颜色串；解析不出来时原样返回。
 */
export function withAlpha(rgb: string, alpha: number): string {
    const match = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(rgb);
    if (!match) {
        return rgb;
    }
    return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
}
