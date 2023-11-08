import { CancellationToken, editor, languages, Position } from 'monaco-editor';
import CompletionList = languages.CompletionList;
import CompletionContext = languages.CompletionContext;
import CompletionItemKind = languages.CompletionItemKind;
import { language as sqliteLanguage} from '../renderer/components/ControllerPage/filterEidter/sqlite';
// const parser = new Parser();
// const ast = parser.astify('SELECT * FROM t'); // mysql sql grammer parsed by default
//
// console.log(ast);
function extracted(position: Position, model: editor.ITextModel) {
    const suggestions: CompletionList = {
        suggestions: [],
    };
    const { lineNumber, column } = position;
    const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
    });
    const word = model.getWordUntilPosition(position);
    console.log('word', word);
    console.log('textUntilPosition', textUntilPosition);
    const textBeforePointer = model.getValueInRange({
        startLineNumber: lineNumber,
        startColumn: 0,
        endLineNumber: lineNumber,
        endColumn: column,
    });
    const contents = textBeforePointer.trim().split(/\s+/);
    const lastContents = contents[contents?.length - 1]; // 获取最后一段非空字符串
    if (lastContents) {
        const sqlConfigKey = ['builtinFunctions', 'keywords', 'operators'];
        const mapKind = (kind: string) => {
            switch (kind) {
                case 'builtinFunctions':
                    return CompletionItemKind.Function;
                case 'keywords':
                    return CompletionItemKind.Keyword;
                case 'operators':
                    return CompletionItemKind.Operator;
                default:
                    return languages.CompletionItemKind.Text;
            }
        };
        sqlConfigKey.forEach((key) => {
            sqliteLanguage[key].forEach((sql) => {
                suggestions.suggestions.push({
                    label: sql, // 显示的提示内容;默认情况下，这也是选择完成时插入的文本。
                    insertText: sql, // 选择此完成时应插入到文档中的字符串或片段
                    kind: mapKind(key), // 此完成项的种类。编辑器根据图标的种类选择图标。
                    range: {
                        startLineNumber: lineNumber,
                        endLineNumber: lineNumber,
                        startColumn: column - lastContents.length,
                        endColumn: column,
                    },
                });
            });
        });
    }
    return suggestions;
}
export const suggestWhere = (
    model: editor.ITextModel,
    position: Position,
    context: CompletionContext,
    token: CancellationToken
) => {
    return extracted(position, model);
};

export const suggestOrderBy = (
    model: editor.ITextModel,
    position: Position,
    context: CompletionContext,
    token: CancellationToken
) => {
    return extracted(position, model);
};
