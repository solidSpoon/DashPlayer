/**
 * 句子结构的最细粒度单位，代表一个词、一个标点符号或它们之间的连接部分。
 */
export interface SentenceBlockPart {
    /**
     * 这部分内容的具体文本，例如一个单词 "Hello" 或一个标点 ","。
     */
    content: string;
    /**
     * 内容的“隐含”或“根本”形式，通常来自NLP（自然语言处理）库。
     * 例如，对于缩写 "'m"，其 implicit 可能是 "am"。对于普通单词，它和 `content` 相同。
     */
    implicit: string;
    /**
     * 标记此部分是否被识别为一个单词（而不是标点、数字或空格）。
     */
    isWord: boolean;
}
/**
 * 代表按空格分割后的一个“逻辑块”（例如一个单词加上它后面的标点）。
 */
export interface SentenceBlockBySpace {
    /**
     * 一个“块”内部的组成部分数组。
     * 例如，"Hello," 这个块可能被进一步分解为 "Hello" 和 "," 两个部分（SentenceBlockPart）。
     */
    blockParts: SentenceBlockPart[];
}
/**
 * 描述一个句子内部的结构，用于进行精细化的文本操作。
 */
export interface SentenceStruct {
    /**
     * 原始的、未处理的完整句子字符串。
     */
    original: string;
    /**
     * 句子按空格（或逻辑边界）分割后的“块”数组。
     * 例如，句子 "It's good." 会被分割成 "It's" 和 "good." 两个块。
     */
    blocks: SentenceBlockBySpace[];
}
