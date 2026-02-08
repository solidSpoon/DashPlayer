# DashPlayer 国际化文案规范（中英）

## 1. 目标

本规范用于统一 DashPlayer 的中英文文案质量，避免“直译感”“单词堆砌”和语义缺失。

核心目标：

- 文案可操作：用户看完知道“当前状态 + 下一步动作”。
- 文案可维护：同一业务语义，在各页面表达一致。
- 文案可扩展：新增功能时可快速沿用既有风格与术语。

---

## 2. 文案分层规则

### 2.1 标题与按钮（短）

- 建议 2–8 个词（英文）/ 2–10 个字（中文）。
- 只表达核心动作或对象，不塞背景信息。

示例：

- ✅ `下载当前 Whisper 模型` / `Download current Whisper model`
- ❌ `马上下载你当前在设置里选择的 Whisper 模型并应用到转录功能`

### 2.2 描述与说明（中等）

- 表达“用途 + 影响 + 注意事项”。
- 面向业务语义，不写技术实现细节。

示例：

- ✅ `用于字幕翻译、词典与云端转录能力。`
- ✅ `Used for subtitle translation, dictionary lookup, and cloud transcription.`

### 2.3 错误与提示（完整）

- 结构：`发生了什么` + `建议怎么做`。
- 失败提示要可执行，避免空泛句式。

示例：

- ✅ `本地转录尚未配置完成（模型未下载），请先去“服务凭据”页面下载对应 Whisper 模型。`

---

## 3. 左侧菜单专门规则（重点）

左侧主菜单英文禁止单词级命名，必须使用语义短语（2–4 词）：

- ✅ `Playback Lab`
- ✅ `Subtitle Workspace`
- ✅ `Vocabulary Studio`
- ❌ `Player`
- ❌ `Transcript`
- ❌ `Vocabulary`

要求：

- 同层级英文长度节奏尽量接近。
- 中文与英文语义等价，不强求逐字对应。

---

## 4. Key 命名规范

### 4.1 语义命名，不按字面翻译

- ✅ `engineSelection.subtitleTranslation.hiddenHint`
- ❌ `engineSelection.notUseOpenaiText`

### 4.2 命名空间

- `nav`：导航与全局入口
- `settings`：设置页
- `toast`：轻量反馈
- `errors`：通用错误
- `player`：播放器专属

### 4.3 键值结构

同一对象优先保持一致结构：

- `title`
- `description`
- `label`
- `button`
- `hint`
- `success/error/loading`

---

## 5. 术语表（首批）

- 字幕翻译：`Subtitle Translation`
- 词典查询：`Dictionary Lookup`
- 字幕转录：`Speech-to-Subtitle`
- 整句学习：`Sentence Learning`
- 服务凭据：`Service Credentials`
- 功能设置：`Feature Controls`
- 存储路径（Library Path）：`Storage path (Library Path)`

说明：术语一旦定稿，新增页面必须复用，不得同义替换。

---

## 6. 文案长度建议

- 主标题：短（便于扫读）
- 副标题：中（交代业务语义）
- Tooltip：中偏长（解释风险/用途）
- Toast：短标题 + 中描述 + 明确 action

不要把所有信息塞进标题；保持“标题短、解释完整”的分层。

---

## 7. 质量检查清单（提交前）

每次新增/修改文案需自查：

1. 是否全部通过 `t('...')`，无硬编码 UI 文案。
2. 中英文是否语义等价（不是机械直译）。
3. 错误文案是否包含“下一步建议”。
4. 左侧菜单英文是否为 2–4 词语义短语。
5. 是否复用了既有术语（避免同义词漂移）。
6. 是否补齐 `zh-CN` 与 `en-US` 两套词典。

---

## 8. 推荐流程（开发协作）

1. 先写中文业务语义稿（确定信息完整性）。
2. 再写英文自然表达（保证可读，不逐字翻）。
3. 按 namespace 落词典 key。
4. 页面接入 `t(...)` 后进行 UI 扫读与回归。
5. 在 PR 描述中附“新增 key 列表 + 术语变更说明”。

---

## 9. 反例速查

- 反例：`保存失败`（无动作建议）
  - 改进：`保存失败，请检查网络或凭据配置后重试。`

- 反例：`OpenAI`（作为菜单名）
  - 改进：`Service Credentials`（菜单层）

- 反例：同一功能多种叫法（如“字幕翻译/翻译字幕/翻译功能”）
  - 改进：统一术语 `字幕翻译 / Subtitle Translation`

