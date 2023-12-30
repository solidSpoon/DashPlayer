import natural from 'natural';
import {
    SentenceBlockBySpace,
    SentenceStruct,
} from '../../common/types/SentenceStruct';

const tokenizer = new natural.TreebankWordTokenizer();

function tokenizeAndProcess(text: string) {
    let tokens = tokenizer.tokenize(text);

    function process(token: string, separator: string) {
        return token.endsWith(separator)
            ? [token.slice(0, -1), separator]
            : [token];
    }

    const separators = ['.', ',', '!', '?', ';'];
    separators.forEach((separator) => {
        tokens = tokens.map((token) => process(token, separator)).flat();
    });

    return tokens;
}

function isWord(token: string) {
    const noWordRegex = /[^A-Za-z0-9-]/;
    return !noWordRegex.test(token);
}

const processSentence = (sentence: string): SentenceStruct => {
    const tokens = tokenizeAndProcess(sentence);
    console.log('aaaaa', tokens);
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
