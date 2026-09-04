# 测试规范

> 测试断言真实业务行为，不测 mock 编排。写或改测试前先读本文档。

## 1. 核心原则

1. **测行为，不测实现**：断言的必须是可观测结果——返回值、数据库状态、渲染出的 DOM、抛出的错误。禁止把 `expect(mock).toHaveBeenCalledXxx` 作为主断言（可作为交互边界条件的辅助断言）。
2. **用真实依赖，少 mock**：项目使用 SQLite + drizzle，起内存库（`createMemoryDb()`）比 mock 仓储便宜且真实。服务层测试一律走内存库，禁止 mock 仓储层。
3. **不测第三方库**：`src/fronted/components/ui/`（shadcn 生成）、lucide 图标等第三方代码不写测试。它们坏了应该升级依赖，而不是用测试钉住现状。
4. **测试跟着源码走**：删除或重构模块时，同步删除对应测试文件；不留孤儿测试与死配置。
5. **失败要修根因**：测试挂了先判断是"实现错了"还是"测试错了"。禁止通过加 `.skip`、删断言、放宽期望值让测试变绿。

## 2. 分层策略

| 层 | 位置 | 测什么 | mock 策略 |
|---|---|---|---|
| 纯函数 | `src/common/utils`、`src/backend/utils` | 输入输出、边界条件 | 不 mock，全覆盖 |
| 服务层 | `src/backend/services` | 业务规则与数据库交互的真实行为 | 内存 SQLite，不 mock 仓储 |
| 业务组件 | `src/fronted/components/shared`、`src/fronted/features` | 用户可见的交互行为 | 仅 mock 外部边界（IPC、TTS/网络） |
| IPC 契约 | `src/backend/controllers` | handler 入参/出参形状 | 按需 mock service |
| UI 基础件 | `src/fronted/components/ui` | **不测** | — |

## 3. 依赖注入约定

服务类通过**构造函数注入**依赖（配合 inversify 的 `@inject` 参数装饰器），禁止属性注入：

```typescript
// ✅ 正确：构造函数注入，容器和测试都能直接装配
@injectable()
export class TagServiceImpl implements TagService {
    private readonly repo: FavouriteClipsRepository;

    constructor(
        @inject(TYPES.FavouriteClipsRepository)
        repo: FavouriteClipsRepository
    ) {
        this.repo = repo;
    }
}
```

理由：属性注入迫使测试 `(service as any).repo = mock` 强转私有字段，或 mock inversify 框架本身，两者都会让测试变得脆弱且误导后续维护者。

## 4. 内存数据库基建

`src/test/database.ts` 提供 `createMemoryDb()`：每次调用返回跑完全部 drizzle 迁移的独立 `:memory:` SQLite。测试里直接插入表数据预置场景，或通过真实仓储装配服务：

```typescript
import { createMemoryDb } from '@/test/database';

beforeEach(() => {
    memoryDb = createMemoryDb();
    tagService = new TagServiceImpl(new FavouriteClipsRepositoryImpl(memoryDb.db));
});

afterEach(() => {
    memoryDb.close();
});
```

注意：`better-sqlite3` 被 Electron Forge 按 Electron ABI 重编译后，Node 版 vitest 可能报 `NODE_MODULE_VERSION` 不匹配。解决方式是让跑测试的 Node 与 Electron ABI 匹配（或单独装一份 Node 版依赖），不要为绕开它把内存库测试改成 mock。

## 5. 编写规范

- **describe / it 用中文白话**，表达真实业务行为（如"重复添加同名标签时返回原标签"），避免技术术语堆砌。
- **一个 it 只验证一个行为**；同一业务点的多个断言（如多个非法入参都报同一错误）可以放在一个 it 里。
- **测试文件位置**：与源码同级放在 `__tests__/` 目录，命名 `<被测模块>.test.ts(x)`；同一模块的场景补充用 `<被测模块>.<场景>.test.ts`（如 `SrtUtil.ass.test.ts`）。
- **mock 只落在系统边界**：允许 mock 的对象——Electron IPC、网络请求、文件系统、TTS/ASR 等外部服务；禁止 mock 的是——被测模块内部依赖的仓储/工具、inversify 等框架本身。
- **测试内不写 fallback**：与业务代码一致，测试数据异常应当场失败，不做静默兜底。
- **禁止提交 `.only`**：ESLint 已对测试文件开启 `describe.only` / `it.only` 拦截。

## 6. 门控与环境依赖测试

依赖外部账号、真实模型或网络的长流程测试（如 AI SDK 集成），统一通过环境变量门控，默认 `describe.skip`，并在文件顶部注释说明开启方式。不要各写各的门控开关。

## 7. 运行

```bash
yarn test:run        # 全量跑一次
yarn test:watch      # 迭代
yarn test:coverage   # PR 前检查覆盖率
```

覆盖率只作为发现盲区的工具，不作为 KPI 追求；mock 编排堆出来的覆盖率是负资产（见第 1 节原则 1/2）。
