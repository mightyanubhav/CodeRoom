import { create } from 'zustand';

const useRoomStore = create((set) => ({

    // ─── State ────────────────────────────────────────────────────────────────
    roomId: null,
    interviewId: null,
    currentCode: '',
    language: 'JAVASCRIPT',
    status: null,
    participants: {},
    question: null,
    executionResult: null,
    isExecuting: false,
    isSaved: false,

    // ─── Set room state from socket event ─────────────────────────────────────
    setRoomState: (state) => set({
        roomId: state.roomId,
        currentCode: state.currentCode || '',
        language: state.language || 'JAVASCRIPT',
        status: state.status,
        participants: state.participants || {},
    }),

    // ─── Code changes ─────────────────────────────────────────────────────────
    setCode: (code) => set({ currentCode: code, isSaved: false }),

    // ─── Language change ──────────────────────────────────────────────────────
    setLanguage: (language) => set({ language }),

    // ─── Question loaded ──────────────────────────────────────────────────────
    setQuestion: (question) => set({
        question,
        currentCode: question.starterCode || '',
    }),

    // ─── Participants ─────────────────────────────────────────────────────────
    addParticipant: (userId, data) => set((state) => ({
        participants: { ...state.participants, [userId]: data }
    })),

    removeParticipant: (userId) => set((state) => {
        const updated = { ...state.participants };
        delete updated[userId];
        return { participants: updated };
    }),

    // ─── Execution ────────────────────────────────────────────────────────────
    setExecuting: (isExecuting) => set({ isExecuting }),
    setExecutionResult: (result) => set({ executionResult: result, isExecuting: false }),

    // ─── Save status ──────────────────────────────────────────────────────────
    setSaved: (isSaved) => set({ isSaved }),

    // ─── Reset room on leave ──────────────────────────────────────────────────
    resetRoom: () => set({
        roomId: null,
        interviewId: null,
        currentCode: '',
        language: 'JAVASCRIPT',
        status: null,
        participants: {},
        question: null,
        executionResult: null,
        isExecuting: false,
        isSaved: false,
    }),

}));

export default useRoomStore;