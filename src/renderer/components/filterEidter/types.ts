import { editor } from 'monaco-editor';
import IStandaloneEditorConstructionOptions = editor.IStandaloneEditorConstructionOptions;

export const monacoOptions: IStandaloneEditorConstructionOptions = {
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
    fontSize: 18,
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
