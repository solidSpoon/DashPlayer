import React, { useEffect, useRef, useState } from 'react';

import type { HardsubMaskRect } from '@/fronted/features/player/playerUiStore';
import {
    drawStretchedSlice,
    edgeFeatherMask,
    sampleAroundPatch,
    withAlpha,
    type HardsubMaskStyle,
} from '@/fronted/features/player/components/hardsubMaskVisuals';

export interface HardsubMaskVisualProps {
    /** 视频元素：取色采样与画面延展都要读它。 */
    video: HTMLVideoElement | null;
    /** 贴片在画面内的比例矩形。 */
    rect: HardsubMaskRect;
    /** 当前选中的样式。 */
    style: HardsubMaskStyle;
    /** 贴片宽度（画面内像素）。 */
    width: number;
    /** 贴片高度（画面内像素）。 */
    height: number;
}

/** 失焦样式的模糊半径（像素）：够把字幕糊成看不出字的一团。 */
const BLUR_PX = 36;

/** 延展样式的重绘间隔（毫秒）：10fps 足够跟上画面变化，又不至于太费。 */
const STRETCH_INTERVAL_MS = 100;

/** 取色采样间隔（毫秒）：色温变化很慢，没必要每帧都采。 */
const SAMPLE_INTERVAL_MS = 500;

/**
 * 遮挡贴片的视觉层：按所选样式决定「用什么把字幕盖掉」。
 *
 * 五种样式的取舍写在 `HardsubMaskStyle` 的注释里；这里只负责各自的渲染与刷新节奏：
 * - `blur` / `blurSampled` 用 `backdrop-filter`，不能叠加 mask（会把模糊削掉）；
 * - `sampled` / `solid` 是实色，可以安全地用 mask 羽化边缘；
 * - `stretch` 每 100ms 把贴片上沿的一小条画面拉伸重绘到 canvas 上。
 *
 * @returns 覆盖在贴片区域上的视觉层。
 */
export default function HardsubMaskVisual({ video, rect, style, width, height }: HardsubMaskVisualProps) {
    const [sample, setSample] = useState<{ top: string; bottom: string } | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // 取色：只在这两种样式下才采样，避免无谓的 drawImage
    useEffect(() => {
        if (!video || (style !== 'sampled' && style !== 'blurSampled')) {
            return undefined;
        }
        const tick = () => setSample(sampleAroundPatch(video, rect));
        tick();
        const id = window.setInterval(tick, SAMPLE_INTERVAL_MS);
        return () => window.clearInterval(id);
    }, [video, style, rect]);

    // 延展：按 10fps 把上沿那一小条画面重新拉伸铺满
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!video || style !== 'stretch' || !canvas) {
            return undefined;
        }
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, Math.round(width * dpr));
        canvas.height = Math.max(1, Math.round(height * dpr));
        const draw = () => drawStretchedSlice(canvas, video, rect);
        draw();
        const id = window.setInterval(draw, STRETCH_INTERVAL_MS);
        return () => window.clearInterval(id);
    }, [video, style, rect, width, height]);

    // 实色样式的四边羽化：必须留出足够大的「实心区」，否则贴片很矮时
    // 羽化带会吃掉大半高度，字幕就从半透明的边里透出来
    const feather = Math.max(4, Math.min(10, Math.round(Math.min(width, height) * 0.15)));
    const featherStyle: React.CSSProperties = {
        maskImage: edgeFeatherMask(feather),
        WebkitMaskImage: edgeFeatherMask(feather),
        maskComposite: 'intersect',
        WebkitMaskComposite: 'source-in',
    };
    const baseClass = 'pointer-events-none absolute inset-0 rounded-xl';

    if (style === 'stretch') {
        return (
            <div data-hardsub-mask-visual="stretch" className={`${baseClass} overflow-hidden`}>
                <canvas ref={canvasRef} className="h-full w-full" />
            </div>
        );
    }

    if (style === 'sampled') {
        const background = sample
            ? `linear-gradient(to bottom, ${sample.top}, ${sample.bottom})`
            : 'rgba(24, 24, 27, 0.92)';
        return (
            <div
                data-hardsub-mask-visual="sampled"
                className={baseClass}
                style={{ background, ...featherStyle }}
            />
        );
    }

    if (style === 'solid') {
        return (
            <div
                data-hardsub-mask-visual="solid"
                className={baseClass}
                style={{ backgroundColor: 'rgb(32, 32, 36)', opacity: 0.94, ...featherStyle }}
            />
        );
    }

    if (style === 'blurSampled') {
        return (
            <div
                data-hardsub-mask-visual="blurSampled"
                className={`${baseClass} backdrop-blur-[36px]`}
                style={{ backgroundColor: sample ? withAlpha(sample.top, 0.18) : 'transparent' }}
            />
        );
    }

    return (
        <div
            data-hardsub-mask-visual="blur"
            className={`${baseClass} backdrop-blur-[${BLUR_PX}px]`}
        />
    );
}
