import { z } from 'zod';
import { codeBlock } from 'common-tags';

/**
 * 视频章节分割文本格式修正提示词。
 */
export const buildFormatSplitPrompt = (text: string): string => codeBlock`
    用户输入的视频章节分割文本可能有格式或时间戳错误，导致程序无法正常解析。
    
    格式规范要求：
    1. 时间格式必须为 hh:mm:ss（如果用户输入的小时部分缺失，自动补全为 00，如 01:23 -> 00:01:23）。
    2. 时间戳与章节标题之间使用单个空格分隔。
    3. 按时间先后顺序逐行排列，每行一个章节。

    标准格式示例：
    00:00:00 序言
    00:00:10 第一章 背景介绍
    00:10:00 第二章 核心原理
    00:20:00 第三章 总结

    待修正的用户文本：
    ${text}

    请以 JSON 格式输出修正后的文本，结果放入 formatedText 字段，不要包含 markdown 代码块包裹、额外解释或无关问候。
`;

export class AiFuncFormatSplitPrompt {
    public static promptFunc(text: string): string {
        return buildFormatSplitPrompt(text);
    }

    public static schema = z.object({
        formatedText: z.string().describe('修正后的文本'),
    });
}

export type AiFuncFormatSplitRes = z.infer<typeof AiFuncFormatSplitPrompt['schema']>;
