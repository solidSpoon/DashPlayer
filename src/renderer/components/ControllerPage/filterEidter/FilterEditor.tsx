import { Editor, loader, Monaco, useMonaco } from '@monaco-editor/react';
import { CancellationToken, editor, languages, Position } from 'monaco-editor';
import { language as sqliteLanguage, conf as sqliteConf } from './sqlite';
import IStandaloneEditorConstructionOptions = editor.IStandaloneEditorConstructionOptions;
import { useEffect, useRef } from 'react';
import CompletionList = languages.CompletionList;
import CompletionContext = languages.CompletionContext;
import ProviderResult = languages.ProviderResult;

const monacoOptions: IStandaloneEditorConstructionOptions = {
    acceptSuggestionOnCommitCharacter: true,
    renderLineHighlight: 'none',
    // quickSuggestions: false,
    glyphMargin: false,
    lineDecorationsWidth: 0,
    folding: false,
    // fixedOverflowWidgets: true,
    acceptSuggestionOnEnter: 'on',
    hover: {
        delay: 100,
    },
    roundedSelection: false,
    contextmenu: false,
    cursorStyle: 'line-thin',
    occurrencesHighlight: false,
    links: false,
    minimap: { enabled: false },
    // see: https://github.com/microsoft/monaco-editor/issues/1746
    wordBasedSuggestions: true,
    // disable `Find`
    find: {
        addExtraSpaceOnTop: false,
        autoFindInSelection: 'never',
        seedSearchStringFromSelection: 'never',
    },
    fontSize: 14,
    fontWeight: 'normal',
    wordWrap: 'off',
    lineNumbers: 'off',
    lineNumbersMinChars: 0,
    overviewRulerLanes: 0,
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    scrollBeyondLastColumn: 0,
    scrollbar: {
        horizontal: 'hidden',
        vertical: 'hidden',
        // avoid can not scroll page when hover monaco
        alwaysConsumeMouseWheel: false,
    },
};

const FilterEditor = () => {
    const monaco = useMonaco();
    const editorRef = useRef<editor.IStandaloneCodeEditor>();
    const handleEditorWillMount = (m: Monaco) => {
        m.languages.typescript.javascriptDefaults.setCompilerOptions({
            target: m.languages.typescript.ScriptTarget.Latest,
            module: m.languages.typescript.ModuleKind.ES2015,
            allowNonTsExtensions: true,
            lib: ['es2018'],
        });
    };
    useEffect(() => {
        if (!monaco) return;
        monaco.languages.register({ id: 'sqlite' });
        monaco.languages.setLanguageConfiguration('sqlite', sqliteConf);
        monaco.languages.setMonarchTokensProvider('sqlite', sqliteLanguage);
        monaco.languages.registerCompletionItemProvider('sqlite', {
            provideCompletionItems: (
                model: editor.ITextModel,
                position: Position,
                context: CompletionContext,
                token: CancellationToken
            ): ProviderResult<CompletionList> => {
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
                    const sqlConfigKey = [
                        'builtinFunctions',
                        'keywords',
                        'operators',
                    ];
                    const mapKind = (kind: string) => {
                        switch (kind) {
                            case 'builtinFunctions':
                                return monaco.languages.CompletionItemKind
                                    .Function;
                            case 'keywords':
                                return monaco.languages.CompletionItemKind
                                    .Keyword;
                            case 'operators':
                                return monaco.languages.CompletionItemKind
                                    .Operator;
                            default:
                                return monaco.languages.CompletionItemKind.Text;
                        }
                    };
                    sqlConfigKey.forEach((key) => {
                        // @ts-ignore
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
            },
        });
    }, [monaco]);
    const handleEditorDidMount = (ed: editor.IStandaloneCodeEditor) => {
        editorRef.current = ed;
        ed.onDidChangeCursorPosition((e) => {
            // Monaco tells us the line number after cursor position changed
            if (e.position.lineNumber > 1) {
                // Trim editor value
                ed.setValue(ed.getValue().trim());
                // Bring back the cursor to the end of the first line
                ed.setPosition({
                    ...e.position,
                    // Setting column to Infinity would mean the end of the line
                    column: Infinity,
                    lineNumber: 1,
                });
            }
        });
    };

    const defaultValue = `insert create table

    where`;
    return (
        <Editor
            path="filter"
            height="22px"
            onMount={handleEditorDidMount}
            beforeMount={handleEditorWillMount}
            defaultLanguage="sqlite"
            // defaultValue={defaultValue}
            options={monacoOptions}
            theme="light"
        />
    );
};

export default FilterEditor;
