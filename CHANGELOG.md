# Changelog

All notable changes to this project are documented in this file.

## [6.8.0](https://github.com/solidSpoon/DashPlayer/compare/v6.7.0...v6.8.0) (2026-09-05)


### Features

* **storage:** 设置页存储用量升级为分类环形图统计 ([11411f6](https://github.com/solidSpoon/DashPlayer/commit/11411f6efa8cb9e5ee6fb99cbfbcdcea14820acb))
* **storage:** 设置页存储用量升级为分类环形图统计 ([ae40f9e](https://github.com/solidSpoon/DashPlayer/commit/ae40f9e24d505ade6eb54fede13e68d9560b3c3c))
* 收藏片段页当前句接入单词级词典弹窗与生词高亮 ([825f531](https://github.com/solidSpoon/DashPlayer/commit/825f531988e268bf385a699b4ffd8c7c90d265b8))
* 收藏片段页当前句接入单词级词典弹窗与生词高亮 ([a3213e7](https://github.com/solidSpoon/DashPlayer/commit/a3213e702c207b6f8f6def8c04d4d3c67456f0f8))
* 收藏片段页当前句接入单词级词典弹窗与生词高亮 ([a3213e7](https://github.com/solidSpoon/DashPlayer/commit/a3213e702c207b6f8f6def8c04d4d3c67456f0f8))
* 词典弹窗星标支持取消收藏，点击切换生词表收录 ([405d317](https://github.com/solidSpoon/DashPlayer/commit/405d3173e5fcc4db46d5a8dc358df71c0b015853))
* 重置数据库增加二次确认弹窗 ([1fd6131](https://github.com/solidSpoon/DashPlayer/commit/1fd61310165dd733675eec86379440aa2722e74a))
* 重置数据库增加二次确认弹窗 ([41ddeeb](https://github.com/solidSpoon/DashPlayer/commit/41ddeeb472f7ad898e1937cbc64db987b5a285c6))


### Bug Fixes

* **ci:** Node 版本改为 22.x，满足 npm-run-all2 的引擎要求 ([a93d7d8](https://github.com/solidSpoon/DashPlayer/commit/a93d7d8d2f5a8680bc170d4ff6b2dca310642314))
* **ci:** 发版构建改为 workflow_call 链式调用 ([1cdf4cb](https://github.com/solidSpoon/DashPlayer/commit/1cdf4cb96f3d78e5f879b62a313491e59b6c4e3d))
* **ci:** 发版构建改为 workflow_call 链式调用 ([01101a7](https://github.com/solidSpoon/DashPlayer/commit/01101a7344dd7a9df7487f664d49177f27631f22))
* **ci:** 构建进程放宽 Node 堆上限，防 Vite 构建 OOM ([fa8af50](https://github.com/solidSpoon/DashPlayer/commit/fa8af50da3796f3c2dc4530ec97d5257c1f93a75))
* **ci:** 构建进程放宽 Node 堆上限至 4GB，防 Vite 构建 OOM ([9470aeb](https://github.com/solidSpoon/DashPlayer/commit/9470aeb255bc4abb198593db227602c056758c39))
* **ffmpeg:** 归一化 ffprobe 返回的字符串时长 ([93e591b](https://github.com/solidSpoon/DashPlayer/commit/93e591b77b08b1e4ecc0f0adb452c58df272c149))
* **models:** 必需条目按路径存在性检查，修复 Sherpa 已装模型被误报损坏 ([c074b51](https://github.com/solidSpoon/DashPlayer/commit/c074b5195a169e5618938acc8649b594b130e733))
* **storage:** 恢复抽象存储类的 [@injectable](https://github.com/injectable) 注解，修复容器解析崩溃 ([a92eb7a](https://github.com/solidSpoon/DashPlayer/commit/a92eb7a6145f9bd8618f2da64c2d6e0b5670bcb9))
* **update-check:** ETag 条件请求省限额，开发环境跳过检查，失败原因错误码化 ([2ce4b9b](https://github.com/solidSpoon/DashPlayer/commit/2ce4b9b0f76f8a3c5283b6f4f0d1410afc1b51c6))
* **update-check:** ETag 条件请求省限额，开发环境跳过检查，失败原因错误码化 ([fa053f9](https://github.com/solidSpoon/DashPlayer/commit/fa053f99c88f60404181174878efb6462ea3bd8c))
* 仓储层单词精确匹配替换未转义的 LIKE ([d33b7e6](https://github.com/solidSpoon/DashPlayer/commit/d33b7e6f1120bcb0802de90d650c595e6800f1c7))
* 修复 FFmpeg 转码兼容性问题并重构字幕提取选流 ([58329fe](https://github.com/solidSpoon/DashPlayer/commit/58329fe57e7bc85f67465987124ec8c2cab8d79c))
* 修复 FFmpeg 转码兼容性问题并重构字幕提取选流 ([29d8bbc](https://github.com/solidSpoon/DashPlayer/commit/29d8bbc804caac4aebde96cbd5b7b73e6c6ee69c))
* 导入词表统一小写归一，避免大小写变体撞唯一约束 ([47834e3](https://github.com/solidSpoon/DashPlayer/commit/47834e365c80803114a9da7ce7230f4cf0b73928))
* 收藏生词复用弹窗词典释义，不再强制二次调用词典 AI ([9672169](https://github.com/solidSpoon/DashPlayer/commit/967216942a626432a169d6bcbdbf15c78deccda9))
* 生词管理链路修复与优化（收藏释义复用、热路径 Set、裁切状态重检等） ([bc51bf4](https://github.com/solidSpoon/DashPlayer/commit/bc51bf4d9ca82fbbd050403afef563a30e3fb032))
* 结构化输出提示词补充 JSON 字样，修复收藏单词报错 ([a051d3f](https://github.com/solidSpoon/DashPlayer/commit/a051d3fc1b23a7f51e379e408bdaae26582de09b))
* 结构化输出提示词补充 JSON 字样，修复收藏单词报错 ([a664619](https://github.com/solidSpoon/DashPlayer/commit/a6646194ed2e2069c451ed3563cca4458856182a))
* 词汇工坊页面反馈优化：请求并行、toast 替换 alert、失败可见 ([7e08692](https://github.com/solidSpoon/DashPlayer/commit/7e08692a11123be5875a22136e093d6b20c7689a))
* 词表变化后自动重检当前视频的生词片段裁切状态 ([680714c](https://github.com/solidSpoon/DashPlayer/commit/680714cc71939f60deb13dca645de019e9a85ffd))
* 词表变化后重新拉起字幕生词分析，避免裁切状态卡在分析中 0% ([3d36b7c](https://github.com/solidSpoon/DashPlayer/commit/3d36b7cef9c12583caf78c99cc9d70cf85b6a687))


### Performance Improvements

* 生词表改用 Set 存储，消除字幕渲染热路径的数组全表扫描 ([939e782](https://github.com/solidSpoon/DashPlayer/commit/939e78258071548c640b337de1ca33e716898b6c))

## [6.7.0](https://github.com/solidSpoon/DashPlayer/compare/v6.6.0...v6.7.0) (2026-09-04)


### Features

* **log:** 转录任务补 done/cancelled/failed 收尾日志 ([1dec5de](https://github.com/solidSpoon/DashPlayer/commit/1dec5dec3926d54cd08ea129ad54ebff79ebebca))


### Bug Fixes

* **ci:** release-please 改用纯版本号 tag ([91ae929](https://github.com/solidSpoon/DashPlayer/commit/91ae9297460684076a4cdecdc6fbc3d6045291a8))
* **ci:** release-please 改用纯版本号 tag，匹配既有 v6.x.x 命名 ([5281eca](https://github.com/solidSpoon/DashPlayer/commit/5281eca803544638ed4940935f108bc6108a08a5))
* **log:** Error 序列化保留 statusCode 与 responseBody ([782d7f3](https://github.com/solidSpoon/DashPlayer/commit/782d7f313761e4be2d00aa37505cc1f208e3d04b))
* **log:** 周报问题修复——日志降噪、转录收尾、Error 证据与两处坏味道 ([b2f473c](https://github.com/solidSpoon/DashPlayer/commit/b2f473ce7086c46de1de4da8b292822f1f2b401f))
* **log:** 转录需求上报失败不再静默吞掉 ([3e6c744](https://github.com/solidSpoon/DashPlayer/commit/3e6c7444f9d6fad6e302335962ad5906357927f5))
* **log:** 降噪播放 ready 回调与字幕翻译回推链路日志 ([f035743](https://github.com/solidSpoon/DashPlayer/commit/f0357432ee9d67e59be2e3a559626d05f58e9fbe))
* 修复 issue 模板 frontmatter、日志路径指引，移除无效的 requiredHeaders ([3423d15](https://github.com/solidSpoon/DashPlayer/commit/3423d1543ec0060495baa65ee0b56c5f313e0fd1))
* 收藏片段直翻腾讯补 tencent 限流 ([c8a1864](https://github.com/solidSpoon/DashPlayer/commit/c8a18643499f0148d68aa7ff99b52045e2efeb2d))

## [Unreleased]

### Changed

- Refactored logging to remove tag-based filtering and APIs.
- Added `src/vite-env.d.ts` to fix `import.meta.env` TypeScript typing.
