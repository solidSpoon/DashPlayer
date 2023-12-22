export interface SentenceBlockPart {
    content: string;
    isWord: boolean;
}

export interface SentenceBlockBySpace {
    blockParts: SentenceBlockPart[];
}

export interface SentenceStruct {
    original: string;
    blocks: SentenceBlockBySpace[];
}
