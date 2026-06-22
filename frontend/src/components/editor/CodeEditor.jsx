import { useRef, useEffect, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { java } from '@codemirror/lang-java';
import { python } from '@codemirror/lang-python';
import { go } from '@codemirror/lang-go';
import { cpp } from '@codemirror/lang-cpp';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { LANGUAGES } from '../../utils/constants.js';

// Language extension map
const getLanguageExtension = (language) => {
    switch (language) {
        case 'JAVASCRIPT': return javascript({ jsx: false });
        case 'JAVA':       return java();
        case 'PYTHON':     return python();
        case 'GO':         return go();
        case 'CPP':        return cpp();
        default:           return javascript();
    }
};

// Custom theme overrides
const customTheme = EditorView.theme({
    '&': {
        height: '100%',
        fontSize: '14px',
        backgroundColor: '#1e1e1e',
    },
    '.cm-scroller': {
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        lineHeight: '1.6',
        overflow: 'auto',
    },
    '.cm-content': {
        padding: '16px 0',
        caretColor: '#aeafad',
    },
    '.cm-line': {
        padding: '0 16px',
    },
    '.cm-gutters': {
        backgroundColor: '#1e1e1e',
        borderRight: '1px solid #3e3e42',
        color: '#858585',
        minWidth: '48px',
    },
    '.cm-activeLineGutter': {
        backgroundColor: '#2a2d2e',
    },
    '.cm-activeLine': {
        backgroundColor: '#2a2d2e',
    },
    '.cm-cursor': {
        borderLeftColor: '#aeafad',
        borderLeftWidth: '2px',
    },
    '.cm-selectionBackground': {
        backgroundColor: '#264f78 !important',
    },
    '&.cm-focused .cm-selectionBackground': {
        backgroundColor: '#264f78 !important',
    },
    '.cm-matchingBracket': {
        backgroundColor: '#3b3b3b',
        outline: '1px solid #888',
    },
});

const CodeEditor = ({ code, language, onChange, isRemoteChange }) => {
    const editorViewRef = useRef(null);
    const isRemoteChangeRef = useRef(false);
    const lastRemoteCodeRef = useRef(code);

    // Handle remote code changes without disrupting cursor
    useEffect(() => {
        if (!isRemoteChange) return;
        if (!editorViewRef.current) return;
        if (lastRemoteCodeRef.current === code) return;

        lastRemoteCodeRef.current = code;
        isRemoteChangeRef.current = true;

        const view = editorViewRef.current;
        const currentDoc = view.state.doc.toString();

        if (currentDoc === code) {
            isRemoteChangeRef.current = false;
            return;
        }

        // Get current cursor position
        const selection = view.state.selection;

        // Apply change
        view.dispatch({
            changes: {
                from: 0,
                to: currentDoc.length,
                insert: code,
            },
            // Preserve cursor position
            selection: selection,
        });

        isRemoteChangeRef.current = false;

    }, [code, isRemoteChange]);

    const handleChange = useCallback((value) => {
        // Don't propagate remote changes back
        if (isRemoteChangeRef.current) return;
        onChange(value);
    }, [onChange]);

    const handleEditorMount = useCallback((view) => {
        editorViewRef.current = view;
    }, []);

    return (
        <div className="flex-1 overflow-hidden flex flex-col bg-[#1e1e1e]">
            {/* Tab bar */}
            <div className="bg-[#252526] border-b border-[#3e3e42] px-4 py-1.5 flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2 bg-[#1e1e1e] px-3 py-1 rounded-t border-t-2 border-t-[#238636]">
                    <div className="w-2 h-2 rounded-full bg-[#238636]"/>
                    <span className="text-xs text-white font-mono">
                        {LANGUAGES.find(l => l.value === language)?.label || language}
                    </span>
                </div>
            </div>

            {/* CodeMirror editor */}
            <div className="flex-1 overflow-hidden">
                <CodeMirror
                    value={code}
                    height="100%"
                    theme={oneDark}
                    extensions={[
                        getLanguageExtension(language),
                        customTheme,
                        EditorView.lineWrapping,
                    ]}
                    onChange={handleChange}
                    onCreateEditor={handleEditorMount}
                    basicSetup={{
                        lineNumbers: true,
                        highlightActiveLineGutter: true,
                        highlightSpecialChars: true,
                        history: true,
                        foldGutter: false,
                        drawSelection: true,
                        dropCursor: true,
                        allowMultipleSelections: false,
                        indentOnInput: true,
                        syntaxHighlighting: true,
                        bracketMatching: true,
                        closeBrackets: true,        // ← no autoclosing
                        autocompletion: true,        // ← no autocomplete
                        rectangularSelection: false,
                        crosshairCursor: false,
                        highlightActiveLine: true,
                        highlightSelectionMatches: true,
                        closeBracketsKeymap: false,
                        completionKeymap: false,
                    }}
                    style={{ height: '100%' }}
                />
            </div>
        </div>
    );
};

export default CodeEditor;