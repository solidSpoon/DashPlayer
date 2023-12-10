import {
    CancellationToken,
    editor,
    IRange,
    languages,
    Position,
} from 'monaco-editor';
import { language as sqliteLanguage } from '../renderer/components/filterEidter/sqlite';
import CompletionList = languages.CompletionList;
import CompletionContext = languages.CompletionContext;
import CompletionItemKind = languages.CompletionItemKind;
import CompletionItem = languages.CompletionItem;

function extracted(position: Position, model: editor.ITextModel) {
    const suggestions: CompletionItem[] = [];
    const word = model.getWordUntilPosition(position);
    const range: IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
    };

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
        sqliteLanguage[key].forEach((sql: any) => {
            suggestions.push({
                label: sql, // 显示的提示内容;默认情况下，这也是选择完成时插入的文本。
                insertText: sql, // 选择此完成时应插入到文档中的字符串或片段
                kind: mapKind(key), // 此完成项的种类。编辑器根据图标的种类选择图标。
                range,
            });
        });
    });

    const fields = ['Word', 'Translation', 'Note', 'Level'];
    fields.forEach((field) => {
        suggestions.push({
            label: field,
            insertText: field,
            kind: CompletionItemKind.Field,
            range,
        });
    });

    return suggestions;
}
export const suggestWhere = (
    model: editor.ITextModel,
    position: Position,
    context: CompletionContext,
    token: CancellationToken
): CompletionList => {
    return {
        suggestions: extracted(position, model),
    };
};

export const suggestOrderBy = (
    model: editor.ITextModel,
    position: Position,
    context: CompletionContext,
    token: CancellationToken
): CompletionList => {
    return {
        suggestions: extracted(position, model),
    };
};
