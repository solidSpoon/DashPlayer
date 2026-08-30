import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import FallBack from '@/fronted/components/shared/common/FallBack';
import { describeForSignature, reportSuppressedError } from '@/fronted/log/suppressedError';

/** ErrorBoundary 子树包装。 */
interface EbProps {
    /** 被保护的子树。 */
    children?: React.ReactNode;
}

/**
 * 记录 React 渲染期崩溃。
 *
 * `componentStack` 是 window error 拿不到的唯一信息，能直接指出崩在哪个组件路径上；
 * 同一组件树会触发多个边界（例如逐词包装的场景），因此按"异常 + 组件栈"合并重复上报。
 * @param error 被边界捕获的异常。
 * @param info React 提供的组件栈信息；React 无法定位组件树时 componentStack 可能缺省。
 */
function handleBoundaryError(error: Error, info: React.ErrorInfo): void {
    const componentStack = info.componentStack ?? 'unknown';
    reportSuppressedError({
        module: 'ErrorBoundary',
        signature: `${describeForSignature(error)} :: ${componentStack}`,
        level: 'error',
        msg: 'react render error',
        data: {
            error,
            componentStack,
            pageUrl: window.location.href,
        },
    });
}

/**
 * 页面级/组件级错误边界包装，崩溃时展示兜底 UI 并把异常写进日志。
 * @param props 需要保护的子树。
 * @returns 带兜底与日志的错误边界。
 */
const Eb = ({ children }: EbProps) => {
    return (
        <ErrorBoundary FallbackComponent={FallBack} onError={handleBoundaryError}>
            {children}
        </ErrorBoundary>
    );
};

export default Eb;
