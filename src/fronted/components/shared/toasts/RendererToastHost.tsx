import { useEffect } from 'react';
import { showNotification, NotificationVariant } from '@/fronted/components/shared/toasts/notification';

/** main 进程经 renderer API 'ui/show-toast' 推送的提示参数。 */
type RendererToastEventDetail = {
    title?: string;
    message: string;
    variant?: NotificationVariant;
    duration?: number;
    bubble?: boolean;
    dedupeKey?: string;
    id?: string;
};

/**
 * 订阅 'show-toast' 全局事件并转发给统一提示出口。
 *
 * 本组件只负责桥接：main 进程 -> renderer API -> CustomEvent -> notification helper；
 * 去重、合并计数与视觉均由 showNotification 承担。
 */
export default function RendererToastHost() {
    useEffect(() => {
        const handler = (event: Event) => {
            const customEvent = event as CustomEvent<RendererToastEventDetail>;
            const detail = customEvent.detail;
            if (!detail || !detail.message) return;
            showNotification(detail);
        };

        window.addEventListener('show-toast', handler);
        return () => window.removeEventListener('show-toast', handler);
    }, []);

    return null;
}
