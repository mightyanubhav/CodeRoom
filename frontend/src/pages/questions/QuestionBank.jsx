import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore.js';
import { questionAPI } from '../../services/api.js';

const DIFFICULTIES = ['ALL', 'EASY', 'MEDIUM', 'HARD'];

const QuestionBank = () => {
    const navigate = useNavigate();
    const { isInterviewer, logout, user } = useAuthStore();

    const [questions, setQuestions] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [difficulty, setDifficulty] = useState('ALL');

    // ─── Fetch all questions ──────────────────────────────────────────────────
    const fetchQuestions = async () => {
        try {
            setIsLoading(true);
            const response = await questionAPI.getAll();
            setQuestions(response.data);
            setFiltered(response.data);
        } catch (err) {
            toast.error('Failed to load questions');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchQuestions();
    }, []);

    // ─── Filter questions ─────────────────────────────────────────────────────
    useEffect(() => {
        let result = [...questions];

        if (difficulty !== 'ALL') {
            result = result.filter(q => q.difficulty === difficulty);
        }

        if (search.trim()) {
            const s = search.toLowerCase();
            result = result.filter(q =>
                q.title?.toLowerCase().includes(s) ||
                q.tags?.toLowerCase().includes(s)
            );
        }

        setFiltered(result);
    }, [search, difficulty, questions]);

    // ─── Delete question ──────────────────────────────────────────────────────
    const handleDelete = async (id) => {
        if (!window.confirm('Delete this question?')) return;
        try {
            await questionAPI.delete(id);
            toast.success('Question deleted');
            fetchQuestions();
        } catch (err) {
            toast.error('Failed to delete question');
        }
    };

    // ─── Difficulty badge ─────────────────────────────────────────────────────
    const DifficultyBadge = ({ difficulty }) => {
        const styles = {
            EASY:   'text-[#3fb950] bg-[#1a2f1a]',
            MEDIUM: 'text-[#d29922] bg-[#2d1f00]',
            HARD:   'text-[#f85149] bg-[#2d1318]',
        };
        return (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[difficulty]}`}>
                {difficulty}
            </span>
        );
    };

    return (
        <div className="min-h-screen bg-[#0d1117] text-white">

            {/* Navbar */}
            <nav className="bg-[#161b22] border-b border-[#30363d] px-6 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
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
                                className="text-sm text-white font-medium border-b border-[#238636]"
                            >
                                Question Bank
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm text-white font-medium">{user?.email}</p>
                            <p className="text-xs text-[#8b949e]">{user?.role}</p>
                        </div>
                        <button
                            onClick={logout}
                            className="text-sm text-[#8b949e] hover:text-white border border-[#30363d] hover:border-[#484f58] px-3 py-1.5 rounded-lg transition-colors"
                        >
                            Sign out
                        </button>
                    </div>
                </div>
            </nav>

            <div className="max-w-6xl mx-auto px-6 py-8">

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold">Question Bank</h2>
                        <p className="text-[#8b949e] text-sm mt-1">
                            {filtered.length} question{filtered.length !== 1 ? 's' : ''} available
                        </p>
                    </div>
                    {isInterviewer() && (
                        <button
                            onClick={() => navigate('/questions/create')}
                            className="bg-[#238636] hover:bg-[#2ea043] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                        >
                            + Create Question
                        </button>
                    )}
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3 mb-6">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#484f58]">
                            🔍
                        </span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by title or tag..."
                            className="w-full bg-[#161b22] border border-[#30363d] rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-[#484f58] focus:outline-none focus:border-[#238636] transition-colors"
                        />
                    </div>

                    {/* Difficulty filter */}
                    <div className="flex items-center gap-2">
                        {DIFFICULTIES.map(d => (
                            <button
                                key={d}
                                onClick={() => setDifficulty(d)}
                                className={`text-xs px-3 py-2 rounded-lg transition-colors font-medium ${
                                    difficulty === d
                                        ? d === 'EASY'   ? 'bg-[#1a2f1a] text-[#3fb950] border border-[#238636]'
                                        : d === 'MEDIUM' ? 'bg-[#2d1f00] text-[#d29922] border border-[#d29922]'
                                        : d === 'HARD'   ? 'bg-[#2d1318] text-[#f85149] border border-[#da3633]'
                                        : 'bg-[#21262d] text-white border border-[#484f58]'
                                        : 'bg-[#161b22] text-[#8b949e] border border-[#30363d] hover:border-[#484f58]'
                                }`}
                            >
                                {d}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Question list */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <svg className="animate-spin h-8 w-8 text-[#238636]" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20">
                        <p className="text-[#8b949e] text-lg">No questions found</p>
                        <p className="text-[#484f58] text-sm mt-1">
                            {isInterviewer() ? 'Create your first question above' : 'Check back later'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((q) => (
                            <div
                                key={q.id}
                                className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 hover:border-[#484f58] transition-colors"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="text-white font-semibold text-sm">
                                                {q.title}
                                            </h3>
                                            <DifficultyBadge difficulty={q.difficulty} />
                                        </div>

                                        <p className="text-[#8b949e] text-xs leading-relaxed line-clamp-2 mb-2">
                                            {q.description}
                                        </p>

                                        <div className="flex items-center gap-3">
                                            {q.tags && (
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    {q.tags.split(',').map(tag => (
                                                        <span
                                                            key={tag}
                                                            className="text-xs bg-[#21262d] text-[#58a6ff] px-2 py-0.5 rounded-full"
                                                        >
                                                            {tag.trim()}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {q.testCases?.length > 0 && (
                                                <span className="text-xs text-[#484f58]">
                                                    {q.testCases.length} test case{q.testCases.length !== 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions — interviewer only */}
                                    {isInterviewer() && (
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => handleDelete(q.id)}
                                                className="text-xs text-[#8b949e] hover:text-[#f85149] border border-[#30363d] hover:border-[#da3633] px-3 py-1.5 rounded-lg transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuestionBank;