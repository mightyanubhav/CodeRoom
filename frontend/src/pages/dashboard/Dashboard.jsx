import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import useAuthStore from "../../store/authStore.js";
import { interviewAPI, roomAPI } from "../../services/api.js";
import { INTERVIEW_STATUS } from "../../utils/constants.js";
import ScoreModal from "../../components/room/ScoreModal.jsx";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout, isInterviewer } = useAuthStore();

  const [interviews, setInterviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [maxInterviewers, setMaxInterviewers] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDashboardScoreModal, setShowDashboardScoreModal] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState(null);

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const isActive = (status) =>
    status !== INTERVIEW_STATUS.COMPLETED &&
    status !== INTERVIEW_STATUS.REVIEWED &&
    status !== INTERVIEW_STATUS.CANCELLED;

  // ─── Fetch interviews ──────────────────────────────────────────────────────
  const fetchInterviews = async () => {
    try {
      setIsLoading(true);
      if (isInterviewer()) {
        const response = await interviewAPI.getMyInterviews();
        setInterviews(response.data);
      }
    } catch (err) {
      toast.error("Failed to load interviews");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInterviews();
  }, []);

  // ─── Create interview ──────────────────────────────────────────────────────
  const handleCreateInterview = async (e) => {
    e.preventDefault();
    if (!scheduledAt) {
      toast.error("Please select a date and time");
      return;
    }

    try {
      setIsCreating(true);

      const interviewRes = await interviewAPI.create({
        scheduledAt,
        maxInterviewers,
      });
      const interview = interviewRes.data;

      const roomRes = await roomAPI.create(interview.id);
      const room = roomRes.data;

      await interviewAPI.updateRoomId(interview.id, room.id);

      const completeInterview = { ...interview, roomId: room.id };
      setInterviews((prev) => [completeInterview, ...prev]);

      // Candidate link
      const candidateLink = `${window.location.origin}/room/${room.id}`;
      navigator.clipboard.writeText(candidateLink);
      toast.success("Interview created! Candidate link copied!");

      setShowCreateForm(false);
      setScheduledAt("");
      setMaxInterviewers(1);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create interview");
    } finally {
      setIsCreating(false);
    }
  };

  // ─── Copy links ────────────────────────────────────────────────────────────
  const handleCopyCandidateLink = (roomId) => {
    const link = `${window.location.origin}/room/${roomId}?role=candidate`;
    navigator.clipboard.writeText(link);
    toast.success("Candidate link copied!");
  };

  const handleCopyInterviewerLink = (roomId) => {
    const link = `${window.location.origin}/room/${roomId}?role=interviewer`;
    navigator.clipboard.writeText(link);
    toast.success("Panelist link copied!");
  };

  // ─── Join room ─────────────────────────────────────────────────────────────
  const handleJoinRoom = (roomId) => {
    navigate(`/room/${roomId}`);
  };

  // ─── Format duration ───────────────────────────────────────────────────────
  const formatDuration = (startedAt, endedAt) => {
    if (!startedAt || !endedAt) return null;
    const minutes = Math.round(
      (new Date(endedAt) - new Date(startedAt)) / 60000
    );
    return `${minutes} min`;
  };

  // ─── Status badge ──────────────────────────────────────────────────────────
  const StatusBadge = ({ status }) => {
    const styles = {
      SCHEDULED:   "bg-[#1f3244] text-[#58a6ff] border-[#1f3244]",
      IN_PROGRESS: "bg-[#1a2f1a] text-[#3fb950] border-[#238636]",
      COMPLETED:   "bg-[#1f1f2e] text-[#8b949e] border-[#30363d]",
      REVIEWED:    "bg-[#2d1f47] text-[#bc8cff] border-[#8957e5]",
      CANCELLED:   "bg-[#2d1318] text-[#f85149] border-[#da3633]",
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${styles[status] || styles.SCHEDULED}`}>
        {status.replace("_", " ")}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      {/* Navbar */}
      <nav className="bg-[#161b22] border-b border-[#30363d] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">
            Code<span className="text-[#238636]">Room</span>
          </h1>
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">
              {isInterviewer() ? "My Interviews" : "My Sessions"}
            </h2>
            <p className="text-[#8b949e] text-sm mt-1">
              {isInterviewer()
                ? "Manage and conduct technical interviews"
                : "Your interview sessions"}
            </p>
          </div>
          {isInterviewer() && (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-[#238636] hover:bg-[#2ea043] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              + New Interview
            </button>
          )}
        </div>

        {/* Create form */}
        {showCreateForm && (
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 mb-6">
            <h3 className="text-white font-semibold mb-4">Schedule Interview</h3>
            <form onSubmit={handleCreateInterview} className="flex items-end gap-4 flex-wrap">
              <div className="flex-1 min-w-48">
                <label className="block text-sm text-[#8b949e] mb-1.5">Date & Time</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#238636] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-[#8b949e] mb-1.5">
                  Panel Size
                </label>
                <select
                  value={maxInterviewers}
                  onChange={(e) => setMaxInterviewers(Number(e.target.value))}
                  className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#238636] transition-colors"
                >
                  <option value={1}>1 Interviewer</option>
                  <option value={2}>2 Interviewers</option>
                  <option value={3}>3 Interviewers</option>
                  <option value={4}>4 Interviewers</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2.5 text-sm text-[#8b949e] border border-[#30363d] rounded-lg hover:border-[#484f58] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2.5 text-sm bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {isCreating ? "Creating..." : "Create Interview"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Interview list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin h-8 w-8 text-[#238636]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          </div>
        ) : interviews.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#8b949e] text-lg">No interviews yet</p>
            <p className="text-[#484f58] text-sm mt-1">
              {isInterviewer()
                ? "Create your first interview above"
                : "Ask your interviewer to share the room link with you"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {interviews.map((interview) => (
              <div
                key={interview.id}
                className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 flex items-center justify-between hover:border-[#484f58] transition-colors"
              >
                {/* Left — info */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={interview.status} />
                    {interview.candidateName && (
                      <span className="text-xs text-[#8b949e]">
                        with {interview.candidateName}
                      </span>
                    )}
                  </div>

                  {interview.startedAt && interview.endedAt && (
                    <span className="text-xs text-[#484f58]">
                      ⏱ {formatDuration(interview.startedAt, interview.endedAt)}
                    </span>
                  )}

                  {interview.score && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-sm font-bold ${
                        interview.score >= 7 ? "text-[#3fb950]" :
                        interview.score >= 5 ? "text-[#d29922]" :
                        "text-[#f85149]"
                      }`}>
                        {interview.score}/10
                      </span>
                      <span className="text-xs text-[#8b949e]">
                        {interview.score >= 7 ? "✅ Proceed" :
                         interview.score >= 5 ? "⚠️ Consider" :
                         "❌ Reject"}
                      </span>
                    </div>
                  )}

                  {interview.notes && (
                    <p className="text-xs text-[#484f58] mt-1 max-w-xs truncate">
                      "{interview.notes}"
                    </p>
                  )}
                </div>

                {/* Right — actions */}
                <div className="flex items-center gap-2">

                  {/* Active interview — show links + join */}
                  {isActive(interview.status) && (
                    <>
                      {/* Candidate link */}
                      <button
                        onClick={() => handleCopyCandidateLink(interview.roomId)}
                        className="text-xs text-[#8b949e] hover:text-white border border-[#30363d] hover:border-[#484f58] px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Copy Candidate Link
                      </button>

                      {/* Panelist link — only if panel > 1 */}
                      {interview.maxInterviewers > 1 && (
                        <button
                          onClick={() => handleCopyInterviewerLink(interview.roomId)}
                          className="text-xs text-[#58a6ff] hover:text-white border border-[#1f3244] hover:border-[#58a6ff] px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Copy Panelist Link
                        </button>
                      )}

                      {/* Join room */}
                      <button
                        onClick={() => handleJoinRoom(interview.roomId)}
                        className="text-xs bg-[#238636] hover:bg-[#2ea043] text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
                      >
                        Join Room
                      </button>
                    </>
                  )}

                  {/* Completed — submit score */}
                  {interview.status === INTERVIEW_STATUS.COMPLETED && (
                    <button
                      onClick={() => {
                        setSelectedInterview(interview);
                        setShowDashboardScoreModal(true);
                      }}
                      className="text-xs bg-[#238636] hover:bg-[#2ea043] text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
                    >
                      Submit Score
                    </button>
                  )}

                  {/* Reviewed — show completed badge */}
                  {interview.status === INTERVIEW_STATUS.REVIEWED && (
                    <span className="text-xs text-[#8b949e] border border-[#30363d] px-3 py-1.5 rounded-lg">
                      Reviewed ✓
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Score modal from dashboard */}
      {showDashboardScoreModal && selectedInterview && (
        <ScoreModal
          roomId={selectedInterview.roomId}
          candidateName={selectedInterview.candidateName || "Candidate"}
          onClose={() => {
            setShowDashboardScoreModal(false);
            setSelectedInterview(null);
          }}
          onSubmitted={() => {
            setShowDashboardScoreModal(false);
            setSelectedInterview(null);
            fetchInterviews();
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;