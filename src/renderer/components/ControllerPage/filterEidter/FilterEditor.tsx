import { Editor, loader, useMonaco } from '@monaco-editor/react';
import { editor, KeyCode, KeyMod } from 'monaco-editor';
import IStandaloneEditorConstructionOptions = editor.IStandaloneEditorConstructionOptions;
import { useRef } from 'react';

const monacoOptions: IStandaloneEditorConstructionOptions = {
    renderLineHighlight: 'none',
    quickSuggestions: false,
    glyphMargin: false,
    lineDecorationsWidth: 0,
    folding: false,
    fixedOverflowWidgets: true,
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
    wordBasedSuggestions: false,
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
        ed.addAction({
            id: 'submitInSingleMode',
            label: 'Submit in single mode',
            // Monaco ships with out of the box enums for keycodes and modifiers
            keybindings: [KeyCode.Enter],
            run: () => {
                // clear the editor
                ed.setValue('');
            },
        });
        // disable `Find` widget
        // see: https://github.com/microsoft/monaco-editor/issues/287#issuecomment-328371787
        // eslint-disable-next-line no-bitwise
        ed.addCommand(KeyMod.CtrlCmd | KeyCode.KeyF, () => {});

        // disable press `Enter` in case of producing line breaks
        ed.addCommand(KeyCode.Enter, () => {
            // State: https://github.com/microsoft/vscode/blob/1.56.0/src/vs/editor/contrib/suggest/suggestWidget.ts#L50
            const StateOpen = 3;
            if (
                // ed._contentWidgets['editor.widget.suggestWidget'].widget.state !==
                // StateOpen
                false
            ) {
                // this.onEnter(ed.getValue())
            } else {
                /**
                 * Origin purpose: disable line breaks
                 * Side Effect: If defining completions, will prevent `Enter` confirm selection
                 * Side Effect Solution: always accept selected suggestion when `Enter`
                 *
                 * But it is hard to find out the name `acceptSelectedSuggestion` to trigger.
                 *
                 * Where to find the `acceptSelectedSuggestion` at monaco official documents ?
                 * Below is some refs:
                 * - https://stackoverflow.com/questions/64430041/get-a-list-of-monaco-commands-actions-ids
                 * - command from: https://github.com/microsoft/vscode/blob/e216a598d3e02401f26459fb63a4f1b6365ec4ec/src/vs/editor/contrib/suggest/suggestController.ts#L632-L638
                 * - https://github.com/microsoft/vscode/search?q=registerEditorCommand
                 * - real list: https://github.com/microsoft/vscode/blob/e216a598d3e02401f26459fb63a4f1b6365ec4ec/src/vs/editor/browser/editorExtensions.ts#L611
                 *
                 *
                 * Finally, `acceptSelectedSuggestion` appears here:
                 * - `editorExtensions.js` Line 288
                 */
                ed.trigger('', 'acceptSelectedSuggestion', 'aaa');
            }
        });
    };

    return (
        <Editor
            path="filter"
            height="220px"
            onMount={handleEditorDidMount}
            defaultLanguage="mysql"
            // defaultValue="// some comment"
            options={monacoOptions}
            theme="light"
        />
    );
};

export default FilterEditor;
