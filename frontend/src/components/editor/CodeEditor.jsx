import { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { LANGUAGES } from '../../utils/constants.js';

const CodeEditor = ({ code, language, onChange, roomId }) => {
    const editorRef = useRef(null);

    // Get Monaco language string from our language enum
    const getMonacoLanguage = () => {
        const lang = LANGUAGES.find(l => l.value === language);
        return lang?.monacoLang || 'javascript';
    };

    const handleEditorDidMount = (editor, monaco) => {
        editorRef.current = editor;

        // Editor keybindings
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            // Ctrl+S — manual save trigger
            console.log('Manual save triggered');
        });
    };

    const handleChange = (value) => {
        onChange(value || '');
    };

    return (
        <div className="flex-1 overflow-hidden">
            <Editor
                height="100%"
                language={getMonacoLanguage()}
                value={code}
                onChange={handleChange}
                onMount={handleEditorDidMount}
                theme="vs-dark"
                options={{
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                    fontLigatures: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 4,
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    renderLineHighlight: 'all',
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                    smoothScrolling: true,
                    padding: { top: 16 },
                    suggest: {
                        showKeywords: true,
                        showSnippets: true,
                    },
                }}
            />
        </div>
    );
};

export default CodeEditor;