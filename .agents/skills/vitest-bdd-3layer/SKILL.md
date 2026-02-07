---
name: vitest-bdd-3layer
description: 'DashPlayer 三层 Vitest-BDD 技能。Use when developers want business-readable BDD scenarios without coupling scenario writing to code implementation details. Triggers on: "BDD 三层", "行为测试分层", "给定当那么", "Vitest BDD", "不想在场景里写实现".'
---

## 目的

在 DashPlayer 中用 **Vitest + 三层模型** 编写 BDD 测试，让“场景编写”与“实现细节”解耦。

目标效果：
- 场景层只写业务句子（给定/当/那么）
- 步骤层维护业务动作词典
- 实现层收敛 mock / fixture / adapter

## 适用范围

- 业务规则清晰、需要可读验收场景的模块
- service + IPC + renderer 契约验证
- 希望后续可扩展为更多业务域（settings / ai-trans / watch-history）

不适用：
- 纯算法工具函数（普通单测更高效）
- 高波动、易 flaky 的强时序用例

## 三层目录规范（必须遵守）

以 `settings` 为例：

1. 场景层（Scenario Layer）
   - `src/backend/application/services/__tests__/Xxx.bdd.test.ts`
   - 只能写 `given/when/then` 业务语句
   - 禁止直接 `new Service`、`vi.spyOn`、`store.set/get`

2. 步骤词典层（Step Dictionary Layer）
   - `src/backend/application/services/__tests__/bdd/xxx.steps.ts`
   - 用英文方法名组织能力：`given* / when* / then*`
   - 场景层仅调用步骤层方法

3. 实现层（Fixture/Adapter Layer）
   - `src/backend/application/services/__tests__/bdd/xxx.fixture.ts`
   - 统一管理 mock、fixture、依赖注入与底层调用

## 工具类约定

复用：`src/test/bdd.ts`

推荐导入方式（避免 ESM `then` 命名导出陷阱）：

```ts
import bdd from '@/test/bdd'
const { scenario, given, when, then } = bdd
```

## 标准落地流程

### 1) 先写场景清单（业务句子）

每条场景必须是一句中文：

`给定<前置条件>，当<触发动作>，那么<业务结果>`

### 2) 定义步骤词典方法

使用英文命名，示例：
- `givenInvalidProviderValues()`
- `whenQueryEngineSelection()`
- `thenProvidersNormalizedToNone()`

规则：
- `given*` 只做前置状态准备
- `when*` 只触发行为
- `then*` 只做业务结果断言

### 3) 在实现层补齐 fixture

实现层负责：
- service 实例创建
- store/mock 初始化
- spy 管理（如 `fs.existsSync`）
- 数据读写 helper（`setValue/getValue`）

### 4) 场景层只编排，不实现

场景层示例：

```ts
scenario('设置：引擎选择行为', () => {
  it('给定 provider 值非法，当查询引擎选择，那么应归一化为 none', async () => {
    await given('给定：provider 值非法', () => steps.givenInvalidProviderValues())
    await when('当：查询引擎选择', () => steps.whenQueryEngineSelection())
    await then('那么：应归一化为 none', () => steps.thenProvidersNormalizedToNone())
  })
})
```

## 评审清单（8项）

- [ ] 场景名是“给定/当/那么”中文句式
- [ ] 场景层无技术细节（无 mock/new/spyon）
- [ ] 步骤方法命名统一 `given/when/then` 前缀
- [ ] 步骤层不堆叠复杂 mock 逻辑
- [ ] 实现层集中管理依赖和替身
- [ ] Then 断言面向业务结果，不是私有实现
- [ ] 场景间状态隔离（beforeEach 重置）
- [ ] `yarn test:bdd` 可通过

## 常见误用（必须避免）

1. 在场景层直接写 mock 或访问 store
2. 步骤方法名中英混用（触发命名规则告警）
3. 一个场景覆盖多个业务承诺
4. 只断言内部调用次数，不断言业务结果
5. 步骤层直接包含大量底层构造逻辑（应下沉实现层）

## 运行命令

```bash
yarn test:bdd
yarn test:bdd:watch
```

## 扩展建议

- 新业务域按同样三层创建：
  - `xxx.bdd.test.ts`
  - `bdd/xxx.steps.ts`
  - `bdd/xxx.fixture.ts`
- 优先复用 `src/test/bdd.ts`，不要重复造 DSL。
