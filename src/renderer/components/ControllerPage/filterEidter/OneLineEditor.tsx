import { Editor, Monaco, useMonaco } from '@monaco-editor/react';
import { CancellationToken, editor, languages, Position } from 'monaco-editor';
import { useEffect, useRef } from 'react';
import { language as sqliteLanguage, conf as sqliteConf } from './sqlite';
import CompletionList = languages.CompletionList;
import CompletionContext = languages.CompletionContext;
import ProviderResult = languages.ProviderResult;
import { monacoOptions } from './types';

export interface OneLineEditorProps {
    onChange: (value: string) => void;
    type: 'sqliteWhere' | 'sqliteOrderBy';
    completionItemProvider: (
        model: editor.ITextModel,
        position: Position,
        context: CompletionContext,
        token: CancellationToken
    ) => ProviderResult<CompletionList>;
}
const OneLineEditor = ({
    onChange,
    type,
    completionItemProvider,
}: OneLineEditorProps) => {
    const monaco = useMonaco();
    const editorRef = useRef<editor.IStandaloneCodeEditor>();
    useEffect(() => {
        if (!monaco) return;
        monaco.languages.register({ id: type });
        monaco.languages.setLanguageConfiguration(type, sqliteConf);
        monaco.languages.setMonarchTokensProvider(type, sqliteLanguage);
        monaco.languages.registerCompletionItemProvider(type, {
            provideCompletionItems: (
                model: editor.ITextModel,
                position: Position,
                context: CompletionContext,
                token: CancellationToken
            ): ProviderResult<CompletionList> => {
                return completionItemProvider(model, position, context, token);
            },
        });
    }, [completionItemProvider, monaco, type]);
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

    return (
        <Editor
            path={type}
            height="22px"
            onMount={handleEditorDidMount}
            defaultLanguage={type}
            defaultValue="1 = 1"
            options={monacoOptions}
            theme="light"
        />
    );
};

export default OneLineEditor;
