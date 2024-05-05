import { z } from 'zod';
import { codeBlock } from 'common-tags';
export class AiFuncFormatSplitPrompt {
    public static promptFunc(text: string):string {
        return codeBlock`
        用户输入的视频章节分割文本可能有格式错误，导致程序无法正确解析。
        格式要求：
        - 时间格式为：hh:mm:ss，如果用户输入小时为空，请你补全为00
        - 标题和时间之间用空格分隔

        正确格式示例：
        00:00:00 Title
        00:00:10 Title
        00:10:00 Title
        00:20:00 Title


        用户输入的文本如下：
        ${text}


        修改用户输入的文本，使其符合格式要求。你的回复会被其他程序调用，所以请直接返回修改后的文本内容。
        `
    }

    public static schema = z.object({
        formatedText: z.string().describe('修正后的文本'),
    })
}

export type AiFuncFormatSplitRes = z.infer<typeof AiFuncFormatSplitPrompt['schema']>;
