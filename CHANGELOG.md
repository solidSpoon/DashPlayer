# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Changed

- Refactored logging to remove tag-based filtering and APIs.
- Standardized debug filtering on log level + module include/exclude + focus token.
- Added `withFocus()` support for main/renderer loggers and `[FOCUS:<token>]` compatibility.
- Updated renderer-to-main log event payload to use `focus` (removed `tags`).
- Added `log-focus-debug` skill for AI-assisted temporary log focus workflow.
- Added `src/vite-env.d.ts` to fix `import.meta.env` TypeScript typing.

