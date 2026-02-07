# 并发内核使用说明

本文档说明 `src/backend/application/kernel/concurrency` 的统一并发能力如何使用，以及重入与锁顺序规则。

## 1. 总览

全局入口：

```ts
import { concurrency } from '@/backend/application/kernel/concurrency';
```

核心能力：

- `withSemaphore`：并发槽位控制。
- `withRateLimit`：速率限制。
- `scheduler().yieldIfNeeded()`：合作式让步。
- `snapshot()`：观测当前并发状态。

## 2. 常用写法

### 2.1 信号量保护（推荐）

```ts
await concurrency.withSemaphore('ffmpeg', async () => {
    await doFfmpegWork();
});
```

### 2.2 速率限制保护

```ts
await concurrency.withRateLimit('gpt', async () => {
    await callGpt();
});
```

### 2.3 长循环中主动让步

```ts
const scheduler = concurrency.scheduler('default');
scheduler.beginFrame();

for (const chunk of chunks) {
    await analyze(chunk);
    await scheduler.yieldIfNeeded();
}
```

## 3. 重入支持

默认是非重入语义。若确实需要同调用链重入，可显式启用：

```ts
await concurrency.withSemaphore('ffmpeg', async () => {
    await concurrency.withSemaphore('ffmpeg', async () => {
        await nestedWork();
    }, { reentrant: true });
}, { reentrant: true });
```

说明：

- 仅在 `reentrant: true` 时启用重入。
- 重入仅适用于同调用链同 key。
- 非必要请勿开启，优先保持非重入设计。

## 4. 锁顺序规则（防死锁）

内核会校验同调用链下的锁获取顺序，逆序会抛 `LockOrderViolationError`。

当前默认顺序基于 key 字典序（由配置键集合生成）：

`ffmpeg < ffprobe < whisper`

实践要求：

- 同一调用链只允许按既定顺序获取。
- 不要在持有高序锁时再获取低序锁。

## 5. 装饰器用法

可使用装饰器简化服务层接入：

```ts
import { WithSemaphore, WithRateLimit } from '@/backend/application/kernel/concurrency/decorators';

class ExampleService {
    @WithSemaphore('ffmpeg')
    async work() {}

    @WithRateLimit('gpt', { timeoutMs: 3000 })
    async ask() {}
}
```

`WithSemaphore` 也支持：

- `reentrant?: boolean`
- `timeoutMs?: number`

## 6. 超时与取消建议

- 对外部依赖调用建议设置 `timeoutMs`，防止许可长期占用。
- 若调用链已有取消语义，优先使用显式 `acquire(..., { signal })`。

## 7. 排障建议

- `concurrency.snapshot()` 用于观察 `inUse/waiting/queued`。
- 遇到死锁疑似场景，先检查是否触发锁顺序违规。
- 遇到吞吐下降，优先检查是否误开了过小 `timeSliceMs`。

