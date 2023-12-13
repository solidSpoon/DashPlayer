import natural from 'natural';
import {
    SentenceBlockBySpace,
    SentenceStruct,
} from '../../types/SentenceStruct';

const tokenizer = new natural.TreebankWordTokenizer();

function tokenizeAndProcess(text: string) {
    let tokens = tokenizer.tokenize(text);
    tokens = tokens
        .map((token) =>
            token.endsWith('.') ? [token.slice(0, -1), '.'] : [token]
        )
        .flat();
    return tokens;
}

function isWord(token: string) {
    const noWordRegex = /[^A-Za-z0-9-]/;
    return !noWordRegex.test(token);
}

const processSentence = (sentence: string): SentenceStruct => {
    const tokens = tokenizeAndProcess(sentence);
    const structure: SentenceBlockBySpace[] = [];
    let currentBlock: SentenceBlockBySpace = {
        blockParts: [],
    };
    let str = sentence;
    tokens.forEach((token) => {
        currentBlock.blockParts.push({
            content: token,
            isWord: isWord(token),
        });
        str = str.trim().replace(token, '');
        if (str.startsWith(' ')) {
            structure.push(currentBlock);
            currentBlock = {
                blockParts: [],
            };
        }
    });
    structure.push(currentBlock);
    return {
        original: sentence,
        blocks: structure,
    };
};

const processSentences = (sentences: string[]): SentenceStruct[] => {
    return sentences.map(processSentence);
};
export default processSentences;
