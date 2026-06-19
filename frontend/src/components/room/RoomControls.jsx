import { useState } from 'react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore.js';
import useRoomStore from '../../store/roomStore.js';
import { questionAPI } from '../../services/api.js';
import { runCode, loadQuestion } from '../../services/socket.js';
import { SOCKET_EVENTS } from '../../utils/constants.js';

const RoomControls = ({ roomId, code, language }) => {
    const { isInterviewer } = useAuthStore();
    const { isExecuting, isSaved } = useRoomStore();

    const [showQuestionPicker, setShowQuestionPicker] = useState(false);
    const [questions, setQuestions] = useState([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);

    // ─── Run code ─────────────────────────────────────────────────────────────
    const handleRunCode = () => {
        if (!code.trim()) {
            toast.error('Nothing to run');
            return;
        }
        runCode(roomId, code, language, null);
        toast('Running code...', { icon: '⚡' });
    };

    // ─── Load question picker ─────────────────────────────────────────────────
    const handleOpenQuestionPicker = async () => {
        setShowQuestionPicker(true);
        if (questions.length > 0) return;

        try {
            setLoadingQuestions(true);
            const response = await questionAPI.getAll();
            setQuestions(response.data);
        } catch (err) {
            toast.error('Failed to load questions');
        } finally {
            setLoadingQuestions(false);
        }
    };

    // ─── Select question ──────────────────────────────────────────────────────
    const handleSelectQuestion = (questionId) => {
        loadQuestion(roomId, questionId);
        setShowQuestionPicker(false);
        toast.success('Loading question...');
    };

    return (
        <>
            {/* Question picker modal */}
            {showQuestionPicker && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-[#161b22] border border-[#30363d] rounded-xl w-full max-w-lg mx-4">
                        <div className="flex items-center justify-between p-4 border-b border-[#30363d]">
                            <h3 className="text-white font-semibold">Select Question</h3>
                            <button
                                onClick={() => setShowQuestionPicker(false)}
                                className="text-[#8b949e] hover:text-white transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-4 max-h-96 overflow-y-auto">
                            {loadingQuestions ? (
                                <div className="flex justify-center py-8">
                                    <svg className="animate-spin h-6 w-6 text-[#238636]" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                    </svg>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {questions.map((q) => (
                                        <button
                                            key={q.id}
                                            onClick={() => handleSelectQuestion(q.id)}
                                            className="w-full text-left bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] hover:border-[#484f58] rounded-lg p-3 transition-colors"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-white text-sm font-medium">
                                                    {q.title}
                                                </span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                    q.difficulty === 'EASY' ? 'text-[#3fb950] bg-[#1a2f1a]' :
                                                    q.difficulty === 'MEDIUM' ? 'text-[#d29922] bg-[#2d1f00]' :
                                                    'text-[#f85149] bg-[#2d1318]'
                                                }`}>
                                                    {q.difficulty}
                                                </span>
                                            </div>
                                            {q.tags && (
                                                <p className="text-xs text-[#484f58] mt-1">{q.tags}</p>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom controls bar */}
            <div className="bg-[#161b22] border-t border-[#30363d] px-4 py-2 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                    {/* Save indicator */}
                    <span className="text-xs text-[#484f58]">
                        {isSaved ? '✓ Saved' : 'Auto-saves every 10s'}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {/* Load question — interviewer only */}
                    {isInterviewer() && (
                        <button
                            onClick={handleOpenQuestionPicker}
                            className="text-xs text-[#8b949e] hover:text-white border border-[#30363d] hover:border-[#484f58] px-3 py-1.5 rounded-lg transition-colors"
                        >
                            Load Question
                        </button>
                    )}

                    {/* Run code */}
                    <button
                        onClick={handleRunCode}
                        disabled={isExecuting}
                        className="text-xs bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5"
                    >
                        {isExecuting ? (
                            <>
                                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                </svg>
                                Running...
                            </>
                        ) : (
                            <>▶ Run</>
                        )}
                    </button>
                </div>
            </div>
        </>
    );
};

export default RoomControls;