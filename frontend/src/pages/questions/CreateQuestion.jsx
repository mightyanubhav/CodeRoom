import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { questionAPI } from '../../services/api.js';
import useAuthStore from '../../store/authStore.js';

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];
const LANGUAGES = ['JAVASCRIPT', 'PYTHON', 'JAVA', 'GO', 'CPP'];

const CreateQuestion = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();

    const [form, setForm] = useState({
        title: '',
        description: '',
        difficulty: 'MEDIUM',
        tags: '',
        starterCode: '',
        language: 'PYTHON',
    });

    const [testCases, setTestCases] = useState([
        { input: '', expectedOutput: '', hidden: false }
    ]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    // ─── Form change ──────────────────────────────────────────────────────────
    const handleFormChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    // ─── Test case change ─────────────────────────────────────────────────────
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

        if (!form.title.trim()) {
            toast.error('Title is required');
            return;
        }
        if (!form.description.trim()) {
            toast.error('Description is required');
            return;
        }
        const validTestCases = testCases.filter(
            tc => tc.input.trim() || tc.expectedOutput.trim()
        );

        try {
            setIsSubmitting(true);

            // Create question
            const response = await questionAPI.create({
                title: form.title.trim(),
                description: form.description.trim(),
                difficulty: form.difficulty,
                tags: form.tags.trim(),
                starterCode: form.starterCode.trim(),
                language: form.language,
            });

            const questionId = response.data.id;

            // Add test cases
            for (const tc of validTestCases) {
                await questionAPI.addTestCase(questionId, {
                    input: tc.input,
                    expectedOutput: tc.expectedOutput,
                    hidden: tc.hidden,
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
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="text-sm text-[#8b949e] hover:text-white transition-colors"
                            >
                                Dashboard
                            </button>
                            <button
                                onClick={() => navigate('/questions')}
                                className="text-sm text-[#8b949e] hover:text-white transition-colors"
                            >
                                Question Bank
                            </button>
                            <span className="text-sm text-white font-medium border-b border-[#238636]">
                                Create Question
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <p className="text-sm text-[#8b949e]">{user?.email}</p>
                        <button
                            onClick={logout}
                            className="text-sm text-[#8b949e] hover:text-white border border-[#30363d] px-3 py-1.5 rounded-lg transition-colors"
                        >
                            Sign out
                        </button>
                    </div>
                </div>
            </nav>

            <div className="max-w-4xl mx-auto px-6 py-8">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold">Create Question</h2>
                    <p className="text-[#8b949e] text-sm mt-1">
                        Add a new question to the interview bank
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
                                {DIFFICULTIES.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm text-[#8b949e] mb-1.5">
                            Description <span className="text-[#f85149]">*</span>
                        </label>
                        <textarea
                            value={form.description}
                            onChange={(e) => handleFormChange('description', e.target.value)}
                            placeholder="Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target..."
                            rows={5}
                            className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#484f58] focus:outline-none focus:border-[#238636] transition-colors resize-none"
                        />
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="block text-sm text-[#8b949e] mb-1.5">
                            Tags
                            <span className="text-[#484f58] ml-1">(comma separated)</span>
                        </label>
                        <input
                            type="text"
                            value={form.tags}
                            onChange={(e) => handleFormChange('tags', e.target.value)}
                            placeholder="array, hashmap, two-pointers"
                            className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#484f58] focus:outline-none focus:border-[#238636] transition-colors"
                        />
                    </div>

                    {/* Language + Starter Code */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-sm text-[#8b949e]">Starter Code</label>
                            <select
                                value={form.language}
                                onChange={(e) => handleFormChange('language', e.target.value)}
                                className="bg-[#161b22] border border-[#30363d] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-[#238636] transition-colors"
                            >
                                {LANGUAGES.map(l => (
                                    <option key={l} value={l}>{l}</option>
                                ))}
                            </select>
                        </div>
                        <textarea
                            value={form.starterCode}
                            onChange={(e) => handleFormChange('starterCode', e.target.value)}
                            placeholder={`def twoSum(nums, target):\n    pass`}
                            rows={6}
                            spellCheck={false}
                            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#484f58] focus:outline-none focus:border-[#238636] transition-colors resize-none font-mono"
                        />
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
                                <div
                                    key={i}
                                    className="bg-[#161b22] border border-[#30363d] rounded-xl p-4"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs text-[#8b949e] font-medium">
                                            Test Case {i + 1}
                                        </span>
                                        <div className="flex items-center gap-3">
                                            {/* Hidden toggle */}
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
                                                placeholder="[2,7,11,15]\n9"
                                                rows={3}
                                                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white placeholder-[#484f58] focus:outline-none focus:border-[#238636] transition-colors resize-none font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-[#484f58] mb-1">Expected Output</label>
                                            <textarea
                                                value={tc.expectedOutput}
                                                onChange={(e) => handleTestCaseChange(i, 'expectedOutput', e.target.value)}
                                                placeholder="[0,1]"
                                                rows={3}
                                                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white placeholder-[#484f58] focus:outline-none focus:border-[#238636] transition-colors resize-none font-mono"
                                            />
                                        </div>
                                    </div>

                                    {tc.hidden && (
                                        <p className="text-xs text-[#238636] mt-2">
                                            🔒 Hidden — candidate won't see input/output, only pass/fail
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-2">
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