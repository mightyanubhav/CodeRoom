import { useState } from 'react';
import toast from 'react-hot-toast';
import { interviewAPI } from '../../services/api.js';

const ScoreModal = ({ roomId, candidateName, onClose, onSubmitted }) => {
    const [score, setScore] = useState(7);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!score) {
            toast.error('Please select a score');
            return;
        }

        try {
            setIsSubmitting(true);
            await interviewAPI.score(roomId, { score, notes });
            toast.success('Scorecard submitted!');
            onSubmitted();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to submit score');
        } finally {
            setIsSubmitting(false);
        }
    };

    const scoreLabels = {
        1: 'Very Poor',
        2: 'Poor',
        3: 'Below Average',
        4: 'Average',
        5: 'Slightly Above Average',
        6: 'Good',
        7: 'Very Good',
        8: 'Excellent',
        9: 'Outstanding',
        10: 'Exceptional'
    };

    const getScoreColor = (s) => {
        if (s <= 3) return 'text-[#f85149]';
        if (s <= 5) return 'text-[#d29922]';
        if (s <= 7) return 'text-[#58a6ff]';
        return 'text-[#3fb950]';
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl w-full max-w-md">

                {/* Header */}
                <div className="p-6 border-b border-[#30363d]">
                    <h2 className="text-white font-semibold text-lg">
                        Submit Scorecard
                    </h2>
                    {candidateName && (
                        <p className="text-[#8b949e] text-sm mt-1">
                            Candidate: {candidateName}
                        </p>
                    )}
                </div>

                <div className="p-6 space-y-6">

                    {/* Score slider */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm text-[#8b949e]">
                                Overall Score
                            </label>
                            <div className="flex items-center gap-2">
                                <span className={`text-3xl font-bold ${getScoreColor(score)}`}>
                                    {score}
                                </span>
                                <span className="text-[#8b949e] text-sm">/10</span>
                            </div>
                        </div>

                        <input
                            type="range"
                            min="1"
                            max="10"
                            value={score}
                            onChange={(e) => setScore(Number(e.target.value))}
                            className="w-full h-2 bg-[#30363d] rounded-lg appearance-none cursor-pointer accent-[#238636]"
                        />

                        <div className="flex justify-between mt-1">
                            <span className="text-xs text-[#484f58]">1</span>
                            <span className="text-xs text-[#484f58]">10</span>
                        </div>

                        <p className={`text-center text-sm mt-2 font-medium ${getScoreColor(score)}`}>
                            {scoreLabels[score]}
                        </p>
                    </div>

                    {/* Score breakdown visual */}
                    <div className="grid grid-cols-10 gap-1">
                        {[1,2,3,4,5,6,7,8,9,10].map((s) => (
                            <button
                                key={s}
                                onClick={() => setScore(s)}
                                className={`h-8 rounded text-xs font-bold transition-all ${
                                    s === score
                                        ? 'bg-[#238636] text-white scale-110'
                                        : s < score
                                            ? 'bg-[#238636]/30 text-[#3fb950]'
                                            : 'bg-[#21262d] text-[#484f58]'
                                }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    {/* Hire recommendation */}
                    <div>
                        <label className="block text-sm text-[#8b949e] mb-3">
                            Recommendation
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setScore(Math.max(score, 7))}
                                className={`py-3 rounded-lg text-sm font-medium border transition-colors ${
                                    score >= 7
                                        ? 'bg-[#1a2f1a] border-[#238636] text-[#3fb950]'
                                        : 'bg-[#0d1117] border-[#30363d] text-[#8b949e]'
                                }`}
                            >
                                ✅ Proceed
                            </button>
                            <button
                                onClick={() => setScore(Math.min(score, 5))}
                                className={`py-3 rounded-lg text-sm font-medium border transition-colors ${
                                    score <= 5
                                        ? 'bg-[#2d1318] border-[#da3633] text-[#f85149]'
                                        : 'bg-[#0d1117] border-[#30363d] text-[#8b949e]'
                                }`}
                            >
                                ❌ Reject
                            </button>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm text-[#8b949e] mb-1.5">
                            Notes
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Strong problem solver, good communication, missed edge cases..."
                            rows={4}
                            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#484f58] focus:outline-none focus:border-[#238636] focus:ring-1 focus:ring-[#238636] transition-colors resize-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-[#30363d] flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 text-sm text-[#8b949e] border border-[#30363d] rounded-lg hover:border-[#484f58] transition-colors"
                    >
                        Skip for now
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex-1 py-2.5 text-sm bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Scorecard'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ScoreModal;