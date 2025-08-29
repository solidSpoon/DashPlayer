/**
 * 前端Controller接口
 * 类似后端Controller，用于集中管理前端API处理逻辑
 */

import { RendererApiMap } from '@/common/api/renderer-api-def';

/**
 * 前端Controller基础接口
 */
export default interface RendererController {
    /**
     * 注册当前Controller的所有API处理方法
     * 返回取消注册的函数
     */
    registerApis(): () => void;

    /**
     * Controller的名称，用于日志和调试
     */
    readonly name: string;
}

/**
 * API处理函数类型
 */
export type ApiHandler<K extends keyof RendererApiMap> = RendererApiMap[K];

/**
 * Controller注册信息
 */
export interface ControllerRegistry {
    name: string;
    controller: RendererController;
    unregister: () => void;
}