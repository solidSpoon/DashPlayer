/**
 * whisper.cpp 离线识别运行时的构建参数与发布坐标（单一事实来源）。
 *
 * 这份常量被三处消费，改这里就等于换配方：
 * - `scripts/download.mjs`：按同一个 tag 从运行时 Release 下载现成归档（本地与 CI 同一条路径，
 *   不再本地编译，开发机因此不需要 cmake / glslc / Vulkan SDK / 编译器）；
 * - `.github/workflows/whisper-runtime.yml`：按同一个 ref 与 Vulkan 版本构建，发布到同一个 tag；
 * - 运行时目录里的 `.runtime-source` 标记：由 ref + 配方拼成，装错配方时比对失败即重装。
 *
 * 因此**改任何一项都必须重新跑 whisper-runtime.yml 发新 tag**：tag 不可变，旧 tag 不会静默
 * 变成新内容，否则本地/CI 会拿到与源码约定不匹配的二进制。
 */

/** 本仓库（运行时 Release 也发在这里）：owner/repo 形式，下载 URL 与 CI 共用。 */
export const DASHPLAYER_REPOSITORY = 'solidSpoon/DashPlayer';

/** whisper.cpp 源码仓库：运行时由该仓库的 parakeet-cli 目标构建。 */
export const WHISPER_CPP_REPOSITORY = 'ggml-org/whisper.cpp';

/**
 * 运行时基于固定版本的 whisper.cpp 构建；parakeet-cli 输出格式是
 * 解析契约（见 WhisperCppCli.parseOutput），升级前需重新验证。
 */
export const WHISPER_CPP_REF = '52a939a2a762224e255d366c1182b2af4dd1a032';

/**
 * Vulkan SDK 版本：必须 1.4.x（1.3.290 不带 SPIRV-Headers 的 cmake config），
 * 与 llama.cpp 保持一致。Windows 随包分发的 vulkan-1.dll 也从同版本的官方运行包里取。
 */
export const VULKAN_RUNTIME_VERSION = '1.4.357.0';

/**
 * 运行时配方版本：构建参数一变就必须手动 +1；随包 loader 的版本由
 * `VULKAN_RUNTIME_VERSION` 自动并入标记，升级 loader 不必再手动 bump
 * （r3 = Windows 静态 CRT + OpenMP + 附带 vulkan-1.dll/vcomp140.dll）。同一 ref 不同配方产出的
 * 二进制不可互换，标记里带上它，已装的旧配方运行时才会被重装而不是继续沿用。
 */
export const WHISPER_RUNTIME_RECIPE = `r3+vk${VULKAN_RUNTIME_VERSION}`;

/**
 * 运行时 Release 的 tag：直接等于配方号（`+` 换成 `-`，避免出现在 URL 路径里引发歧义），
 * 同一配方永远指向同一份不可变资产。
 * 该 Release 必须标记为 prerelease：应用的更新检查走 `/releases/latest` 并过滤
 * 稳定版（见 services/CheckUpdate.ts），否则运行时包会被当成 app 新版本推给用户。
 */
export const WHISPER_RUNTIME_RELEASE_TAG = `whisper-runtime-${WHISPER_RUNTIME_RECIPE.replaceAll('+', '-')}`;

/** 运行时 Release 里的校验和文件名，内容为 `<sha256>  <资产名>` 逐行排列。 */
export const WHISPER_RUNTIME_CHECKSUMS_FILE = 'SHA256SUMS.txt';

/**
 * whisper.cpp 运行时资产名，与 whisper-runtime.yml 的 Package 步骤产出一一对应：
 * Windows 打包为 zip（exe + vulkan-1.dll + vcomp140.dll + 许可证），其余平台 tar.gz。
 *
 * @param {string} platform 目标平台（process.platform 取值）。
 * @param {string} arch 目标架构（x64 / arm64）。
 * @returns {string} 资产文件名。
 */
export const whisperRuntimeAssetName = (platform, arch) =>
    `whisper-cpp-${platform}-${arch}.${platform === 'win32' ? 'zip' : 'tar.gz'}`;

/**
 * 拼出运行时 Release 里的资产下载地址（tag 固定，不经过 GitHub API，避免匿名限额）。
 *
 * @param {string} assetName 资产文件名，见 whisperRuntimeAssetName。
 * @returns {string} 可直接 GET 的下载地址。
 */
export const whisperRuntimeReleaseAssetUrl = (assetName) =>
    `https://github.com/${DASHPLAYER_REPOSITORY}/releases/download/${WHISPER_RUNTIME_RELEASE_TAG}/${assetName}`;
