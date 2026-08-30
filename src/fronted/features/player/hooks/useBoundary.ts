/**
 * 负责计算字幕容器的可视边界（包含上下安全内边距），并同步给字幕滚动状态机使用。
 */
import { useEffect, useRef } from 'react';
import useSubtitleScroll from './useSubtitleScroll';

export interface Ele {
    /**
     * y 顶部安全边界（基于 viewport 绝对坐标）
     */
    yt: number;
    /**
     * y 底部安全边界（基于 viewport 绝对坐标）
     */
    yb: number;
}

/**
 * 字幕滚动区域上下预留的安全内边距（像素）。
 * 避免字幕行紧贴容器顶底边缘，为用户视觉和交互提供缓冲。
 */
const DEFAULT_SAFE_PADDING_TOP = 16;
const DEFAULT_SAFE_PADDING_BOTTOM = 24;

interface UseBoundaryOptions {
    paddingTop?: number;
    paddingBottom?: number;
}

const useBoundary = (options?: UseBoundaryOptions) => {
    const boundaryRef = useRef<HTMLDivElement>(null);
    const paddingTop = options?.paddingTop ?? DEFAULT_SAFE_PADDING_TOP;
    const paddingBottom = options?.paddingBottom ?? DEFAULT_SAFE_PADDING_BOTTOM;

    useEffect(() => {
        const element = boundaryRef.current;
        if (!element) {
            return;
        }

        const updateBoundary = () => {
            const rect = element.getBoundingClientRect();
            if (!rect || rect.height === 0) {
                return;
            }

            // 统一基于 getBoundingClientRect 坐标系：
            // 容器自身视口顶部 + 上边距，容器视口底部 - 下边距
            useSubtitleScroll.getState().updateBoundary({
                yt: rect.top + paddingTop,
                yb: Math.max(rect.top + paddingTop, rect.bottom - paddingBottom),
            });
        };

        // 首次立即同步一次
        updateBoundary();

        // 使用 ResizeObserver 监听容器尺寸变化（分栏拉伸、全屏、侧边栏折叠等）
        const resizeObserver = new ResizeObserver(() => {
            updateBoundary();
        });
        resizeObserver.observe(element);

        // 兼听全局窗口尺寸变化及滚动
        window.addEventListener('resize', updateBoundary);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', updateBoundary);
        };
    }, [paddingTop, paddingBottom]);

    return {
        setBoundaryRef: boundaryRef,
    };
};

export default useBoundary;

