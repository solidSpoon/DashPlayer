/**
 * UI Controller - 处理UI相关的后端请求
 */

import { BaseRendererController } from './BaseRendererController';

export class UIController extends BaseRendererController {
    readonly name = 'UIController';

    protected setupApis(): void {
        this.batchRegisterApis({
            'ui/show-notification': async (params) => {
                console.log('显示通知:', params);

                // 使用浏览器原生通知API
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification(params.title, {
                        body: params.message,
                        icon: '/icon.png'
                    });
                } else {
                    // 降级到alert或自定义通知组件
                    alert(`${params.title}: ${params.message}`);
                }
            },

            'ui/show-confirm-dialog': async (params) => {
                console.log('显示确认对话框:', params);
                return true;
            },

            'ui/update-progress': async (params) => {
                console.log('更新进度:', params);

                // 触发自定义事件，供其他组件监听
                const event = new CustomEvent('progress-update', { detail: params });
                window.dispatchEvent(event);
            },

            'ui/show-toast': async (params) => {
                console.log('显示Toast:', params);

                const event = new CustomEvent('show-toast', { detail: params });
                window.dispatchEvent(event);
            }
        });
    }
}
