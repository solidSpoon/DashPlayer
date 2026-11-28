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
        description: "单个视频下载并整理到保存目录后立即调用，在对话流中生成可点击观看的视频卡片（时长等信息由应用自动读取，无需单独跑 ffprobe）。若后续回合补充下载了字幕，也可再次传入原 videoPath 与新的 subtitlePath 以更新既有视频卡片。",
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

    pi.registerTool({
        name: "ask_user",
        label: "Ask User",
        description: "向用户展示单选或多选交互卡片（用于列表选集、浏览器 Cookie 选择、重试策略确认等）。调用后应立即停止本轮并等待用户回复。",
        parameters: Type.Object({
            question: Type.String({
                description: "简洁明确的提问标题。",
            }),
            description: Type.Optional(
                Type.String({
                    description: "可选的补充说明，例如合集总数或注意事项。",
                }),
            ),
            selectionMode: Type.Union(
                [Type.Literal("single"), Type.Literal("multiple")],
                {
                    description: "选择模式：single（单选）或 multiple（多选）。",
                },
            ),
            options: Type.Array(
                Type.Object({
                    value: Type.String({
                        description: "选项唯一值（如序号、范围或操作标识）。",
                    }),
                    label: Type.String({
                        description: "面向用户展示的选项标题。",
                    }),
                    description: Type.Optional(
                        Type.String({
                            description: "可选的选项副标题（如时长或补充说明）。",
                        }),
                    ),
                }),
                {
                    description: "供用户选择的选项列表（至少 1 项）。",
                },
            ),
            confirmLabel: Type.Optional(
                Type.String({
                    description: "可选的确认按钮文案，默认「确认选择」。",
                }),
            ),
        }),
        async execute(_toolCallId, params) {
            return {
                content: [
                    {
                        type: "text",
                        text: \`已在界面展示交互选择卡片：\${params.question}。请立即结束本轮并等待用户做出选择。\`,
                    },
                ],
                details: {
                    question: params.question,
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
