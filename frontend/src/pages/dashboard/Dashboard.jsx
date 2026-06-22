import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import useAuthStore from "../../store/authStore.js";
import { interviewAPI, roomAPI } from "../../services/api.js";
import { INTERVIEW_STATUS } from "../../utils/constants.js";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout, isInterviewer } = useAuthStore();

  const [interviews, setInterviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  // ─── Fetch interviews on mount ─────────────────────────────────────────────

  const fetchInterviews = async () => {
    try {
      setIsLoading(true);
      if (isInterviewer()) {
        const response = await interviewAPI.getMyInterviews();
        setInterviews(response.data);
      }
      // Candidate sees nothing on dashboard
      // They join via direct room link only
    } catch (err) {
      toast.error("Failed to load interviews");
      console.log(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInterviews();
  }, []);

  // ─── Create interview + room ───────────────────────────────────────────────
  //   const handleCreateInterview = async (e) => {
  //     e.preventDefault();
  //     if (!scheduledAt) {
  //       toast.error("Please select a date and time");
  //       return;
  //     }

  //     try {
  //       setIsCreating(true);

  //       // 1. Create interview
  //       const interviewRes = await interviewAPI.create({ scheduledAt });
  //       const interview = interviewRes.data;

  //       // 2. Create room
  //       const roomRes = await roomAPI.create(interview.id);
  //       const room = roomRes.data;

  //       // 3. Update interview roomId to match room.id
  //       await interviewAPI.updateRoomId(interview.id, room.id);

  //       toast.success("Interview created!");
  //       setShowCreateForm(false);
  //       setScheduledAt("");
  //       await fetchInterviews();

  //       // 4. Copy link using room.id
  //       const roomLink = `${window.location.origin}/room/${room.id}`;
  //       navigator.clipboard.writeText(roomLink);
  //       toast.success("Room link copied to clipboard!");
  //     } catch (err) {
  //       toast.error(err.response?.data?.message || "Failed to create interview");
  //     } finally {
  //       setIsCreating(false);
  //     }
  //   };

  const handleCreateInterview = async (e) => {
    e.preventDefault();
    if (!scheduledAt) {
      toast.error("Please select a date and time");
      return;
    }

    try {
      setIsCreating(true);

      // 1. Create interview
      const interviewRes = await interviewAPI.create({ scheduledAt });
      const interview = interviewRes.data;

      // 2. Create room
      const roomRes = await roomAPI.create(interview.id);
      const room = roomRes.data;

      // 3. Update interview roomId = room.id
      await interviewAPI.updateRoomId(interview.id, room.id);

      // 4. Build complete interview object manually
      const completeInterview = {
        ...interview,
        roomId: room.id, // ← use room.id directly, don't wait for DB
      };

      // 5. Add to list manually — don't re-fetch
      setInterviews((prev) => [completeInterview, ...prev]);

      // 6. Copy link using room.id directly
      const roomLink = `${window.location.origin}/room/${room.id}`;
      navigator.clipboard.writeText(roomLink);
      toast.success("Interview created! Room link copied!");

      setShowCreateForm(false);
      setScheduledAt("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create interview");
    } finally {
      setIsCreating(false);
    }
  };

  // ─── Join room ─────────────────────────────────────────────────────────────
  const handleJoinRoom = (roomId) => {
    navigate(`/room/${roomId}`);
  };

  // ─── Status badge ──────────────────────────────────────────────────────────
  const StatusBadge = ({ status }) => {
    const styles = {
      SCHEDULED: "bg-[#1f3244] text-[#58a6ff] border-[#1f3244]",
      IN_PROGRESS: "bg-[#1a2f1a] text-[#3fb950] border-[#238636]",
      COMPLETED: "bg-[#1f1f2e] text-[#8b949e] border-[#30363d]",
      REVIEWED: "bg-[#2d1f47] text-[#bc8cff] border-[#8957e5]",
      CANCELLED: "bg-[#2d1318] text-[#f85149] border-[#da3633]",
    };

    return (
      <span
        className={`text-xs px-2 py-0.5 rounded-full border font-medium ${styles[status] || styles.SCHEDULED}`}
      >
        {status.replace("_", " ")}
      </span>
    );
  };

  // ─── Format date ───────────────────────────────────────────────────────────
  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
            <h2 className="text-2xl font-bold text-white">
              {isInterviewer() ? "My Interviews" : "My Sessions"}
            </h2>
            <p className="text-[#8b949e] text-sm mt-1">
              {isInterviewer()
                ? "Manage and conduct technical interviews"
                : "Your interview sessions"}
            </p>
          </div>

          {/* Create button — interviewer only */}
          {isInterviewer() && (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-[#238636] hover:bg-[#2ea043] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              + New Interview
            </button>
          )}
        </div>

        {/* Create Interview Form */}
        {showCreateForm && (
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 mb-6">
            <h3 className="text-white font-semibold mb-4">
              Schedule Interview
            </h3>
            <form
              onSubmit={handleCreateInterview}
              className="flex items-end gap-4"
            >
              <div className="flex-1">
                <label className="block text-sm text-[#8b949e] mb-1.5">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#238636] focus:ring-1 focus:ring-[#238636] transition-colors"
                />
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
                  {isCreating ? "Creating..." : "Create & Copy Link"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Interview list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <svg
              className="animate-spin h-8 w-8 text-[#238636]"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              />
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
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={interview.status} />
                      {interview.candidateName && (
                        <span className="text-xs text-[#8b949e]">
                          with {interview.candidateName}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#8b949e]">
                      {formatDate(interview.scheduledAt)}
                    </p>
                    {interview.score && (
                      <p className="text-xs text-[#8b949e] mt-0.5">
                        Score:{" "}
                        <span className="text-[#3fb950]">
                          {interview.score}/10
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Copy room link — share with candidate */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/room/${interview.roomId}`,
                      );
                      toast.success("Room link copied!");
                    }}
                    className="text-xs text-[#8b949e] hover:text-white border border-[#30363d] hover:border-[#484f58] px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Copy Link
                  </button>

                  {/* Join room — interviewer enters the room */}
                  {interview.status !== INTERVIEW_STATUS.COMPLETED &&
                    interview.status !== INTERVIEW_STATUS.REVIEWED &&
                    interview.status !== INTERVIEW_STATUS.CANCELLED && (
                      <button
                        onClick={() => handleJoinRoom(interview.roomId)}
                        className="text-xs bg-[#238636] hover:bg-[#2ea043] text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
                      >
                        Join Room
                      </button>
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

export default Dashboard;
