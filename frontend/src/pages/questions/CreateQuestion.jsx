import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { questionAPI } from '../../services/api.js';
import useAuthStore from '../../store/authStore.js';
import ImageUpload from '../../components/shared/ImageUpload.jsx';

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];
const LANGUAGES    = ['JAVASCRIPT', 'PYTHON', 'JAVA', 'GO', 'CPP'];

const STARTER_CODE_TEMPLATES = {
    PYTHON: `import sys\n\ndef solution(data):\n    # Write your solution here\n    pass\n\ndata = sys.stdin.read().strip()\nprint(solution(data))\n`,
    JAVASCRIPT: `const readline = require('readline');\nconst rl = readline.createInterface({ input: process.stdin });\nlet lines = [];\nrl.on('line', line => lines.push(line));\nrl.on('close', () => {\n    // lines[0], lines[1], ... contain your input\n    // Write your solution here\n    console.log(lines[0]);\n});\n`,
    JAVA: `import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String input = sc.nextLine();\n        \n        // Write your solution here\n        System.out.println(input);\n    }\n}\n`,
    GO: `package main\n\nimport (\n    "bufio"\n    "fmt"\n    "os"\n)\n\nfunc main() {\n    reader := bufio.NewReader(os.Stdin)\n    input, _ := reader.ReadString('\\n')\n    \n    // Write your solution here\n    fmt.Println(input)\n}\n`,
    CPP: `#include <iostream>\n#include <string>\nusing namespace std;\n\nint main() {\n    string input;\n    getline(cin, input);\n    \n    // Write your solution here\n    cout << input << endl;\n    return 0;\n}\n`,
};

const CreateQuestion = () => {
    const navigate    = useNavigate();
    const { user, logout } = useAuthStore();

    const [form, setForm] = useState({
        title:       '',
        description: '',
        difficulty:  'MEDIUM',
        tags:        '',
        starterCode: STARTER_CODE_TEMPLATES['PYTHON'],
        language:    'PYTHON',
    });

    const [testCases, setTestCases] = useState([
        { input: '', expectedOutput: '', hidden: false }
    ]);

    // Per-language starter codes — saved explicitly by the user
    const [savedCodes, setSavedCodes] = useState({});

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [descPreview, setDescPreview]   = useState(false);
    const [showImageUpload, setShowImageUpload] = useState(false);
    const descRef = useRef(null);

    // ─── Markdown toolbar helper ──────────────────────────────────────────────
    const insertMd = (before, after = '') => {
        const el = descRef.current;
        if (!el) return;
        const start    = el.selectionStart;
        const end      = el.selectionEnd;
        const selected = form.description.slice(start, end);
        const newText  =
            form.description.slice(0, start) +
            before + selected + after +
            form.description.slice(end);
        handleFormChange('description', newText);
        setTimeout(() => {
            el.focus();
            el.selectionStart = start + before.length;
            el.selectionEnd   = start + before.length + selected.length;
        }, 0);
    };

    // Insert image markdown from Cloudinary upload
    const handleImageInsert = (markdown) => {
        const el = descRef.current;
        if (!el) {
            handleFormChange('description', form.description + '\n' + markdown + '\n');
            return;
        }
        const pos     = el.selectionStart;
        const newText =
            form.description.slice(0, pos) +
            '\n' + markdown + '\n' +
            form.description.slice(pos);
        handleFormChange('description', newText);
        setShowImageUpload(false);
    };

    const TOOLBAR = [
        { label: 'B',    title: 'Bold',         before: '**',   after: '**'  },
        { label: 'I',    title: 'Italic',        before: '_',    after: '_'   },
        { label: '`',    title: 'Inline code',   before: '`',    after: '`'   },
        { label: '```',  title: 'Code block',    before: '\n```\n', after: '\n```\n' },
        { label: 'H2',   title: 'Heading',       before: '\n## ', after: ''   },
        { label: 'ul',   title: 'Bullet list',   before: '\n- ', after: ''    },
        { label: '1.',   title: 'Numbered list', before: '\n1. ', after: ''   },
        { label: '---',  title: 'Divider',       before: '\n---\n', after: '' },
        { label: 'link', title: 'Link',          before: '[',    after: '](url)' },
    ];

    // ─── Form handlers ────────────────────────────────────────────────────────
    const handleFormChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const saveCurrentCode = () => {
        setSavedCodes(prev => ({ ...prev, [form.language]: form.starterCode }));
        toast.success(`Starter code saved for ${form.language}`);
    };

    const handleLanguageChange = (lang) => {
        handleFormChange('language', lang);
        // Load saved code for this language, or default template if not yet saved
        handleFormChange('starterCode', savedCodes[lang] ?? STARTER_CODE_TEMPLATES[lang]);
    };

    const handleTestCaseChange = (index, field, value) => {
        setTestCases(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const addTestCase = () => {
        setTestCases(prev => [...prev, { input: '', expectedOutput: '', hidden: false }]);
    };

    const removeTestCase = (index) => {
        if (testCases.length === 1) return;
        setTestCases(prev => prev.filter((_, i) => i !== index));
    };

    // ─── Submit ───────────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.title.trim())       { toast.error('Title is required'); return; }
        if (!form.description.trim()) { toast.error('Description is required'); return; }

        const validTestCases = testCases.filter(
            tc => tc.input.trim() || tc.expectedOutput.trim()
        );

        try {
            setIsSubmitting(true);
            // Merge all saved per-language codes + current language's code
            const allCodes = { ...savedCodes, [form.language]: form.starterCode.trim() };
            const response = await questionAPI.create({
                title:       form.title.trim(),
                description: form.description.trim(),
                difficulty:  form.difficulty,
                tags:        form.tags.trim(),
                starterCode: JSON.stringify(allCodes),
                language:    form.language,
            });

            const questionId = response.data.id;
            for (const tc of validTestCases) {
                await questionAPI.addTestCase(questionId, {
                    input:          tc.input,
                    expectedOutput: tc.expectedOutput,
                    hidden:         tc.hidden,
                });
            }

            toast.success('Question created!');
            navigate('/questions');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create question');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ─── Markdown preview components ──────────────────────────────────────────
    const mdComponents = {
        p:          ({children}) => <p className="text-[#8b949e] text-sm mb-2">{children}</p>,
        strong:     ({children}) => <strong className="text-white font-semibold">{children}</strong>,
        em:         ({children}) => <em className="text-[#8b949e] italic">{children}</em>,
        code:       ({inline, children}) => inline
            ? <code className="bg-[#21262d] text-[#58a6ff] px-1 rounded text-xs font-mono">{children}</code>
            : <pre className="bg-[#161b22] border border-[#30363d] rounded p-3 my-2 overflow-x-auto"><code className="text-xs text-[#c9d1d9] font-mono">{children}</code></pre>,
        ul:         ({children}) => <ul className="list-disc pl-4 text-sm space-y-1 mb-2">{children}</ul>,
        ol:         ({children}) => <ol className="list-decimal pl-4 text-sm space-y-1 mb-2">{children}</ol>,
        li:         ({children}) => <li className="text-[#8b949e] text-sm">{children}</li>,
        h1:         ({children}) => <h1 className="text-white font-bold text-base mb-2">{children}</h1>,
        h2:         ({children}) => <h2 className="text-white font-semibold text-sm mb-2">{children}</h2>,
        h3:         ({children}) => <h3 className="text-[#8b949e] font-semibold text-sm mb-1">{children}</h3>,
        img:        ({src, alt}) => <img src={src} alt={alt} className="rounded-lg max-w-full my-3 border border-[#30363d]" />,
        blockquote: ({children}) => <blockquote className="border-l-2 border-[#238636] pl-3 my-2 italic text-[#8b949e] text-sm">{children}</blockquote>,
        hr:         () => <hr className="border-[#30363d] my-3" />,
        a:          ({href, children}) => <a href={href} target="_blank" rel="noreferrer" className="text-[#58a6ff] hover:underline">{children}</a>,
    };

    return (
        <div className="min-h-screen bg-[#0d1117] text-white">

            {/* Navbar */}
            <nav className="bg-[#161b22] border-b border-[#30363d] px-6 py-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <h1 className="text-xl font-bold">
                            Code<span className="text-[#238636]">Room</span>
                        </h1>
                        <div className="flex items-center gap-4">
                            <button onClick={() => navigate('/dashboard')}
                                className="text-sm text-[#8b949e] hover:text-white transition-colors">
                                Dashboard
                            </button>
                            <button onClick={() => navigate('/questions')}
                                className="text-sm text-[#8b949e] hover:text-white transition-colors">
                                Question Bank
                            </button>
                            <span className="text-sm text-white font-medium border-b border-[#238636]">
                                Create Question
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <p className="text-sm text-[#8b949e]">{user?.email}</p>
                        <button onClick={logout}
                            className="text-sm text-[#8b949e] hover:text-white border border-[#30363d] px-3 py-1.5 rounded-lg transition-colors">
                            Sign out
                        </button>
                    </div>
                </div>
            </nav>

            <div className="max-w-4xl mx-auto px-6 py-8">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold">Create Question</h2>
                    <p className="text-[#8b949e] text-sm mt-1">
                        Supports markdown — add images, code blocks, tables
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* Title + Difficulty */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm text-[#8b949e] mb-1.5">
                                Title <span className="text-[#f85149]">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={(e) => handleFormChange('title', e.target.value)}
                                placeholder="Two Sum"
                                className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#484f58] focus:outline-none focus:border-[#238636] transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-[#8b949e] mb-1.5">
                                Difficulty <span className="text-[#f85149]">*</span>
                            </label>
                            <select
                                value={form.difficulty}
                                onChange={(e) => handleFormChange('difficulty', e.target.value)}
                                className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#238636] transition-colors"
                            >
                                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="block text-sm text-[#8b949e] mb-1.5">
                            Tags <span className="text-[#484f58] ml-1">(comma separated)</span>
                        </label>
                        <input
                            type="text"
                            value={form.tags}
                            onChange={(e) => handleFormChange('tags', e.target.value)}
                            placeholder="array, hashmap, tree, graph"
                            className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#484f58] focus:outline-none focus:border-[#238636] transition-colors"
                        />
                    </div>

                    {/* Description — markdown editor */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-sm text-[#8b949e]">
                                Description <span className="text-[#f85149]">*</span>
                                <span className="text-[#484f58] ml-1">(markdown supported)</span>
                            </label>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowImageUpload(p => !p)}
                                    className="text-xs text-[#8b949e] hover:text-white border border-[#30363d] hover:border-[#484f58] px-2 py-1 rounded transition-colors"
                                >
                                    📷 Image
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDescPreview(p => !p)}
                                    className="text-xs text-[#58a6ff] hover:text-white transition-colors"
                                >
                                    {descPreview ? '✏️ Edit' : '👁 Preview'}
                                </button>
                            </div>
                        </div>

                        {/* Image upload panel */}
                        {showImageUpload && (
                            <div className="mb-2">
                                <ImageUpload onInsert={handleImageInsert} />
                            </div>
                        )}

                        <div className="border border-[#30363d] rounded-lg overflow-hidden focus-within:border-[#238636] transition-colors">
                            {/* Markdown toolbar */}
                            {!descPreview && (
                                <div className="bg-[#21262d] border-b border-[#30363d] px-3 py-1.5 flex items-center gap-1 flex-wrap">
                                    {TOOLBAR.map(({ label, title, before, after }) => (
                                        <button
                                            key={label}
                                            type="button"
                                            onClick={() => insertMd(before, after)}
                                            title={title}
                                            className="text-xs text-[#8b949e] hover:text-white bg-[#161b22] hover:bg-[#30363d] px-2 py-0.5 rounded font-mono transition-colors"
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {descPreview ? (
                                <div className="bg-[#0d1117] p-4 min-h-40">
                                    {form.description ? (
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={mdComponents}
                                        >
                                            {form.description}
                                        </ReactMarkdown>
                                    ) : (
                                        <p className="text-xs text-[#484f58] italic">Nothing to preview</p>
                                    )}
                                </div>
                            ) : (
                                <textarea
                                    ref={descRef}
                                    value={form.description}
                                    onChange={(e) => handleFormChange('description', e.target.value)}
                                    placeholder={`Describe the problem...\n\n**Example 1:**\n\`\`\`\nInput: s = "()"\nOutput: true\n\`\`\`\n\n![diagram](https://your-image.png)`}
                                    rows={10}
                                    className="w-full bg-[#0d1117] px-3 py-2.5 text-sm text-white placeholder-[#484f58] focus:outline-none resize-none font-mono"
                                />
                            )}
                        </div>
                    </div>

                    {/* Language + Starter Code */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-sm text-[#8b949e]">
                                Starter Code
                                <span className="text-[#484f58] ml-1 text-xs">(shown in editor when question loads)</span>
                            </label>
                            <div className="flex items-center gap-2">
                                <select
                                    value={form.language}
                                    onChange={(e) => handleLanguageChange(e.target.value)}
                                    className="bg-[#161b22] border border-[#30363d] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-[#238636] transition-colors"
                                >
                                    {LANGUAGES.map(l => (
                                        <option key={l} value={l}>
                                            {savedCodes[l] ? `✓ ${l}` : l}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={saveCurrentCode}
                                    className="text-xs bg-[#238636] hover:bg-[#2ea043] text-white px-3 py-1 rounded-lg transition-colors font-medium"
                                >
                                    Save
                                </button>
                            </div>
                        </div>

                        {/* Saved languages indicator */}
                        {Object.keys(savedCodes).length > 0 && (
                            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                                <span className="text-xs text-[#484f58]">Saved:</span>
                                {Object.keys(savedCodes).map(lang => (
                                    <span key={lang} className="text-xs bg-[#1a2f1a] text-[#3fb950] px-1.5 py-0.5 rounded font-medium">
                                        {lang}
                                    </span>
                                ))}
                                {form.language && !savedCodes[form.language] && (
                                    <span className="text-xs text-[#484f58] italic">
                                        · {form.language} not saved yet
                                    </span>
                                )}
                            </div>
                        )}

                        <textarea
                            value={form.starterCode}
                            onChange={(e) => handleFormChange('starterCode', e.target.value)}
                            rows={8}
                            spellCheck={false}
                            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#484f58] focus:outline-none focus:border-[#238636] transition-colors resize-none font-mono"
                        />
                        <p className="text-xs text-[#484f58] mt-1.5">
                            Write the template for each language and click Save, then switch languages. All saved codes load in the editor when the question is selected.
                        </p>
                    </div>

                    {/* Test cases */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm text-[#8b949e]">
                                Test Cases
                                <span className="text-[#484f58] ml-1">(optional)</span>
                            </label>
                            <button
                                type="button"
                                onClick={addTestCase}
                                className="text-xs text-[#238636] hover:text-[#2ea043] border border-[#238636] hover:border-[#2ea043] px-3 py-1 rounded-lg transition-colors"
                            >
                                + Add Test Case
                            </button>
                        </div>

                        <div className="space-y-3">
                            {testCases.map((tc, i) => (
                                <div key={i} className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs text-[#8b949e] font-medium">
                                            Test Case {i + 1}
                                        </span>
                                        <div className="flex items-center gap-3">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <div
                                                    onClick={() => handleTestCaseChange(i, 'hidden', !tc.hidden)}
                                                    className={`relative w-8 h-4 rounded-full transition-colors ${
                                                        tc.hidden ? 'bg-[#238636]' : 'bg-[#30363d]'
                                                    }`}
                                                >
                                                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                                                        tc.hidden ? 'translate-x-4' : 'translate-x-0.5'
                                                    }`} />
                                                </div>
                                                <span className="text-xs text-[#8b949e]">Hidden</span>
                                            </label>
                                            {testCases.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeTestCase(i)}
                                                    className="text-xs text-[#8b949e] hover:text-[#f85149] transition-colors"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-[#484f58] mb-1">Input</label>
                                            <textarea
                                                value={tc.input}
                                                onChange={(e) => handleTestCaseChange(i, 'input', e.target.value)}
                                                placeholder="()"
                                                rows={3}
                                                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white placeholder-[#484f58] focus:outline-none focus:border-[#238636] transition-colors resize-none font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-[#484f58] mb-1">Expected Output</label>
                                            <textarea
                                                value={tc.expectedOutput}
                                                onChange={(e) => handleTestCaseChange(i, 'expectedOutput', e.target.value)}
                                                placeholder="true"
                                                rows={3}
                                                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white placeholder-[#484f58] focus:outline-none focus:border-[#238636] transition-colors resize-none font-mono"
                                            />
                                        </div>
                                    </div>

                                    {tc.hidden && (
                                        <p className="text-xs text-[#238636] mt-2">
                                            🔒 Hidden — candidate sees pass/fail only
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-2 pb-8">
                        <button
                            type="button"
                            onClick={() => navigate('/questions')}
                            className="px-4 py-2.5 text-sm text-[#8b949e] border border-[#30363d] rounded-lg hover:border-[#484f58] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2.5 text-sm bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
                        >
                            {isSubmitting ? 'Creating...' : 'Create Question'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateQuestion;