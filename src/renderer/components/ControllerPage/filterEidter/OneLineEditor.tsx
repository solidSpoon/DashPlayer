import { Editor, Monaco, useMonaco } from '@monaco-editor/react';
import {
    CancellationToken,
    editor,
    IDisposable,
    KeyCode,
    KeyMod,
    languages,
    Position,
} from 'monaco-editor';
import { useEffect, useRef, useState } from 'react';
import { language as sqliteLanguage, conf as sqliteConf } from './sqlite';
import CompletionList = languages.CompletionList;
import CompletionContext = languages.CompletionContext;
import ProviderResult = languages.ProviderResult;
import { monacoOptions } from './types';
import IStandaloneCodeEditor = editor.IStandaloneCodeEditor;

export interface OneLineEditorProps {
    onValueUpdate: (value: string) => void;
    onSubmit: () => void;
    type: 'sqliteWhere' | 'sqliteOrderBy';
    completionItemProvider: (
        model: editor.ITextModel,
        position: Position,
        context: CompletionContext,
        token: CancellationToken
    ) => ProviderResult<CompletionList>;
}
const OneLineEditor = ({
    onValueUpdate,
    onSubmit,
    type,
    completionItemProvider,
}: OneLineEditorProps) => {
    const monaco = useMonaco();
    const [editorRef, setEditorRef] = useState<IStandaloneCodeEditor>();
    const suggestShow = useRef(false);
    useEffect(() => {
        const disposables: IDisposable[] = [];
        if (monaco) {
            monaco.languages.register({ id: type });
            monaco.languages.setLanguageConfiguration(type, sqliteConf);
            monaco.languages.setMonarchTokensProvider(type, sqliteLanguage);
            disposables.push(
                monaco.languages.registerCompletionItemProvider(type, {
                    provideCompletionItems: (
                        model: editor.ITextModel,
                        position: Position,
                        context: CompletionContext,
                        token: CancellationToken
                    ): ProviderResult<CompletionList> => {
                        console.log('suggest sssss');
                        return completionItemProvider(
                            model,
                            position,
                            context,
                            token
                        );
                    },
                    triggerCharacters: [' ', '.', '(', '$'],
                })
            );
        }
        return () => {
            disposables.forEach((d) => d.dispose());
        };
    }, [completionItemProvider, monaco, type]);
    useEffect(() => {
        const disposables: IDisposable[] = [];
        if (editorRef) {
            disposables.push(
                editorRef.addAction({
                    id: 'my-submit',
                    label: 'my-submit',
                    keybindings: [KeyCode.Enter],
                    precondition:
                        '!suggestWidgetVisible && !markersNavigationVisible && !findWidgetVisible',
                    run(ce: editor.ICodeEditor, ...args): void | Promise<void> {
                        console.log('my-submit');
                        onSubmit();
                        return undefined;
                    },
                })
            );
        }
        return () => {
            disposables.forEach((d) => d.dispose());
        };
    }, [editorRef, onSubmit]);
    const handleEditorDidMount = (ed: editor.IStandaloneCodeEditor) => {
        onValueUpdate(ed.getValue());
        setEditorRef(ed);
        const isSuggestionOpen = false;

        const suggestionWidget = (
            ed.getContribution('editor.contrib.suggestController') as {
                widget: {
                    value: {
                        onDidShow: (cb: () => void) => void;
                        onDidHide: (cb: () => void) => void;
                    };
                };
            } | null
        )?.widget;

        if (suggestionWidget) {
            suggestionWidget.value.onDidShow(() => {
                console.log('show');
                suggestShow.current = true;
            });
            suggestionWidget.value.onDidHide(() => {
                console.log('hide');
                suggestShow.current = false;
            });
        }

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
        // disable `Find` widget
        // see: https://github.com/microsoft/monaco-editor/issues/287#issuecomment-328371787
        // eslint-disable-next-line no-bitwise
        ed.addCommand(KeyMod.CtrlCmd | KeyCode.KeyF, () => {});
        ed.onDidChangeModelContent((e) => {
            onValueUpdate(ed.getValue());
        });
        ed.onDidPaste((e) => {
            console.log('paste');
            // multiple rows will be merged to single row
            const content = ed
                .getValue()
                .trim()
                .split('\n')
                .map((s) => s.trim())
                .join(' ');
            ed.setValue(content);
            // Bring back the cursor to the end of the first line
            ed.setPosition({
                ...e.range.getStartPosition(),
                // Setting column to Infinity would mean the end of the line
                column: Infinity,
            });
            // scroll to cursor
            ed.revealPositionInCenter({
                ...e.range.getStartPosition(),
                // Setting column to Infinity would mean the end of the line
                column: Infinity,
            });
        });
    };

    return (
        <Editor
            path={type}
            height="25px"
            onMount={handleEditorDidMount}
            defaultLanguage={type}
            // defaultValue="1 = 1"
            options={monacoOptions}
            theme="light"
        />
    );
};

export default OneLineEditor;
