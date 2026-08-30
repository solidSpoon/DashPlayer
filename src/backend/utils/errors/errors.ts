import { ExtendableError } from 'ts-error';
import { CANCEL_BY_USER_ERROR_NAME } from '@/common/utils/cancellation';

/**
 * 任务被用户取消。
 *
 * name 显式固定为共享常量，而不是依赖 ts-error 从 `constructor.name` 推导：
 * 生产构建会 mangle 类名，推导结果失真会让基于类型名的取消判定静默失效。
 */
export class CancelByUserError extends ExtendableError {
    constructor(message?: string) {
        super(message);
        Object.defineProperty(this, 'name', { value: CANCEL_BY_USER_ERROR_NAME });
    }
}
