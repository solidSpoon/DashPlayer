# Changelog

All notable changes to this project are documented in this file.

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
