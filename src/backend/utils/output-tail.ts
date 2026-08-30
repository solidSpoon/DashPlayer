/** 进程存活期内在内存中保留的子进程输出尾部行数上限。 */
const OUTPUT_TAIL_BUFFER_LINES = 120;

/**
 * 失败时结构化进日志的输出尾部行数：子进程的致命错误集中在输出末尾。
 * 以"行数组"入日志可以绕开单字段字符串长度截断。
 */
export const LOG_TAIL_LINES = 20;

/**
 * 子进程输出尾部行环形缓冲，ffmpeg / sherpa-onnx 等执行体共用。
 */
export class OutputTail {
    private readonly buffer: string[] = [];

    /**
     * 追加一段输出文本，按行拆分并只保留尾部固定行数。
     * @param text 子进程输出块。
     */
    public push(text: string): void {
        for (const line of text.split(/\r?\n/).filter(Boolean)) {
            this.buffer.push(line);
            if (this.buffer.length > OUTPUT_TAIL_BUFFER_LINES) {
                this.buffer.shift();
            }
        }
    }

    /**
     * @returns 供日志使用的尾部行数组。
     */
    public logTail(): string[] {
        return this.buffer.slice(-LOG_TAIL_LINES);
    }

    /**
     * @returns 缓冲内全部行的快照，用于拼接 Error message。
     */
    public allLines(): string[] {
        return this.buffer.slice();
    }

    /**
     * @returns 整个缓冲的文本形式，用于拼接 Error message。
     */
    public bufferedText(): string {
        return this.buffer.join('\n');
    }
}

/**
 * 取整块文本的末尾若干非空行；用于无法按行增量缓冲的输出（如 sherpa 的 stdout）。
 * @param text 完整文本。
 * @param count 尾部行数。
 * @returns 最多 `count` 行。
 */
export function tailLines(text: string, count: number): string[] {
    return text.split(/\r?\n/).filter(Boolean).slice(-count);
}
