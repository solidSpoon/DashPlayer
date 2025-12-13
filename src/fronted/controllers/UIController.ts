/**
 * UI Controller - 处理UI相关的后端请求
 */

import { BaseRendererController } from './BaseRendererController';

export class UIController extends BaseRendererController {
    readonly name = 'UIController';

    protected setupApis(): void {
        this.batchRegisterApis({
            'ui/show-notification': async (params) => {
                this.logger.debug('Show notification', { params });

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
                this.logger.debug('Show confirmation dialog', { params });
                return true;
            },

            'ui/update-progress': async (params) => {
                this.logger.debug('Update progress', { params });

                // 触发自定义事件，供其他组件监听
                const event = new CustomEvent('progress-update', { detail: params });
                window.dispatchEvent(event);
            },

            'ui/show-toast': async (params) => {
                this.logger.debug('Show toast', { params });

                const event = new CustomEvent('show-toast', { detail: params });
                window.dispatchEvent(event);
            },

            'settings/whisper-model-download-progress': async (params) => {
                this.logger.debug('Whisper model download progress', { params });

                const event = new CustomEvent('whisper-model-download-progress', { detail: params });
                window.dispatchEvent(event);
            },

            'settings/tts-model-download-progress': async (params) => {
                this.logger.debug('TTS model download progress', { params });

                const event = new CustomEvent('tts-model-download-progress', { detail: params });
                window.dispatchEvent(event);
            },
        });
    }
}
