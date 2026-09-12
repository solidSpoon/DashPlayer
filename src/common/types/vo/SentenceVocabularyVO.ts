/**
 * 句子生词的本地选词结果。
 *
 * 说明：整份数据由本地词典产出，不调用模型、不访问网络，因此可以在打开学习页时立即使用。
 */
export type SentenceWordEntry = {
    /** 词典词条原形（小写）。 */
    word: string;
    /** 音标。 */
    phonetic: string;
    /** 中文释义（词典释义的前若干条）。 */
    meaning: string;
    /** 命中的考试档位标签（zk/gk/cet4/cet6/ky/toefl/ielts/gre）；空数组表示不在任何考纲内。 */
    tags: string[];
    /**
     * 该词在句中实际出现的词形（小写）；同一个词的多种变形会合并进同一条词条。
     * 界面用它把卡片对应的词在主舞台字幕上高亮出来。
     */
    surfaces: string[];
};

export type SentenceVocabularyVO = {
    /**
     * 值得重点认识的词，**按其在句中出现的顺序排列**。
     *
     * 选词规则：用户词表命中的词 + 本地词典里「不算谁都会」的词；
     * 这两类加起来不足 MIN_CARDS 张时，再用被挡掉的词里相对最罕见的几个补到下限。
     */
    picks: SentenceWordEntry[];
    /** 句内每个词形的释义映射，键为句中实际出现的词形（小写），供悬停取词同步命中。 */
    details: Record<string, SentenceWordEntry>;
};
