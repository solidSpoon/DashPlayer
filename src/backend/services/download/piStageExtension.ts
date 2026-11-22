import fsp from 'fs/promises';
import path from 'path';

const STAGE_EXTENSION_FILENAME = 'dashplayer-stage.ts';

const STAGE_EXTENSION_SOURCE = `import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
    pi.registerTool({
        name: "report_stage",
        label: "Report Stage",
        description: "向 DashPlayer 界面汇报当前下载任务所处阶段（仅汇报阶段切换，不要估算或填写百分比）。",
        parameters: Type.Object({
            phase: Type.Union(
                [
                    Type.Literal("checking_env"),
                    Type.Literal("analyzing"),
                    Type.Literal("downloading"),
                    Type.Literal("postprocessing"),
                    Type.Literal("completed"),
                    Type.Literal("error"),
                ],
                {
                    description:
                        "当前所处阶段：checking_env（检测环境）、analyzing（分析资源）、downloading（下载中）、postprocessing（后处理）、completed（已完成）、error（失败）。",
                },
            ),
            detail: Type.Optional(
                Type.String({
                    description: "简短中文说明，例如：正在检测 yt-dlp 环境 / 正在合并音视频。",
                }),
            ),
            title: Type.Optional(
                Type.String({
                    description: "可选：进入 downloading 阶段时传入已解析到的视频标题，用于下载卡片展示。",
                }),
            ),
        }),
        async execute(_toolCallId, params) {
            return {
                content: [
                    {
                        type: "text",
                        text: \`已更新界面阶段为 \${params.phase}\${params.detail ? \`（\${params.detail}）\` : ""}\`,
                    },
                ],
                details: {
                    phase: params.phase,
                    detail: params.detail ?? "",
                    title: params.title ?? "",
                },
            };
        },
    });

    pi.registerTool({
        name: "present_video",
        label: "Present Video",
        description: "单个视频下载并整理到保存目录后立即调用，在对话流中生成可点击观看的视频卡片（时长等信息由应用自动读取，无需单独跑 ffprobe）。",
        parameters: Type.Object({
            videoPath: Type.String({
                description: "最终保存到目标目录的视频文件绝对路径。",
            }),
            title: Type.String({
                description: "视频标题或可读名称。",
            }),
            subtitlePath: Type.Optional(
                Type.String({
                    description: "关联的字幕文件绝对路径（如有）。",
                }),
            ),
            resolution: Type.Optional(
                Type.String({
                    description: "可选的视频分辨率标签，例如 1080p。",
                }),
            ),
        }),
        async execute(_toolCallId, params) {
            return {
                content: [
                    {
                        type: "text",
                        text: \`已在界面展示视频卡片：\${params.title}\`,
                    },
                ],
                details: {
                    videoPath: params.videoPath,
                    title: params.title,
                },
            };
        },
    });
}
`;

/**
 * 在受管 `PI_CODING_AGENT_DIR/extensions/` 下写入 DashPlayer 阶段与卡片扩展。
 *
 * @param agentDir 受管 Pi Agent 配置目录。
 * @returns 写入的扩展文件绝对路径。
 */
export async function ensurePiStageExtension(agentDir: string): Promise<string> {
    const extensionsDir = path.join(agentDir, 'extensions');
    await fsp.mkdir(extensionsDir, { recursive: true });
    const extensionPath = path.join(extensionsDir, STAGE_EXTENSION_FILENAME);
    await fsp.writeFile(extensionPath, STAGE_EXTENSION_SOURCE, 'utf8');
    return extensionPath;
}
