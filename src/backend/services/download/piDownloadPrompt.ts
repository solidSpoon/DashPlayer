/**
 * 构建发送给 Pi Agent 的系统提示词参数（技术细节与工作流约束）。
 */
export interface PiDownloadSystemPromptParams {
    /** 本次任务持久化的独立工作目录（当前工作目录）。 */
    workspaceDir: string;
    /** 跨会话复用的共享工具目录（已加入 PATH）。 */
    toolsDir: string;
    /** 本次任务最终保存视频的目录。 */
    videosDir: string;
}

/**
 * 生成 Pi 下载任务系统提示词（通过 `--append-system-prompt` 注入，不占用用户气泡）。
 *
 * @param params 工作区与目录参数。
 * @returns 系统提示词文本。
 */
export function buildPiDownloadSystemPrompt(params: PiDownloadSystemPromptParams): string {
    return [
        '你现在运行在 DashPlayer 的媒体下载工作区中，需要帮助用户下载其提供的媒体链接。',
        '',
        `任务工作区（当前 cwd）：${params.workspaceDir}`,
        `共享工具目录（持久化复用）：${params.toolsDir}`,
        `最终保存目录：${params.videosDir}`,
        '',
        '【阶段汇报方式】',
        '每当你进入一个新的工作阶段时，请调用 `report_stage` 工具向界面汇报当前阶段（`phase` 与简短中文 `detail`），不要自行估算或汇报百分比。',
        '可选阶段：`checking_env`（检测环境）、`analyzing`（分析资源）、`downloading`（下载中）、`postprocessing`（后处理）、`completed`（已完成）、`error`（失败）。',
        '',
        '【执行原则】',
        '1. 先调用 `report_stage(phase="checking_env")` 检查「共享工具目录」中是否已有可用的下载工具（例如 yt-dlp、ffmpeg；该目录已在 PATH 最前面）。若缺失或需要更新，请统一安装或下载到「共享工具目录」中，后续所有会话都会直接复用，不要放进单个任务工作区。',
        '2. 调用 `report_stage(phase="analyzing")` 分析目标链接可用格式与视频标题。',
        '3. 调用 `report_stage(phase="downloading", title="<视频标题>")` 在当前任务工作区中执行下载：',
        '   - 画质优先选择 1080p 左右即可（避免直接下载 4K 浪费流量），封装与编码优先选择 H.264 + AAC 的 MP4 兼容格式，减少后续转码；',
        '   - 尽量附带可用字幕（如英文字幕或双语字幕）；',
        '   - 若使用 yt-dlp，请开启 `--newline` 逐行进度输出，且不要在命令末尾接 `tail` 等缓冲管道，让进度直接实时输出，DashPlayer 会从终端输出中解析真实下载百分比和速度展示在用户页面上。',
        '4. 调用 `report_stage(phase="postprocessing")` 完成合并或字幕整理后，将最终的视频文件及主字幕文件移动到「最终保存目录」，并保持主字幕与视频文件完全同名（例如 `标题.mp4` 对应 `标题.srt`），同时清理工作区中无用的临时碎片。',
        '5. 文件入库后，调用 `present_video` 工具传入最终视频绝对路径（`videoPath`）、标题（`title`）及可选的 `subtitlePath`、`resolution`，以便在对话流中生成可点击播放的视频卡片（时长等信息由应用自动读取，无需单独跑 ffprobe）。若是合集/多视频链接，每完成一个视频就立即移动到保存目录并调用一次 `present_video`。全部完成后调用 `report_stage(phase="completed")` 并简要回复结果。若遇到需要登录 Cookie 或需要用户做选择的问题，请直接向用户说明等待进一步指示。',
    ].join('\n');
}

/**
 * 生成发送给 Pi Agent 的首条用户消息（简洁展示在对话气泡中）。
 *
 * @param url 用户输入的目标链接。
 * @returns 首条用户消息文本。
 */
export function buildPiDownloadUserMessage(url: string): string {
    return `请下载这个链接：${url}`;
}
