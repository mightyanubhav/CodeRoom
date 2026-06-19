import { create } from 'zustand';
import { authAPI } from '../services/api.js';
import { initSocket, disconnectSocket } from '../services/socket.js';

const useAuthStore = create((set, get) => ({

    // ─── State ────────────────────────────────────────────────────────────────
    user: null,
    accessToken: localStorage.getItem('accessToken') || null,
    refreshToken: localStorage.getItem('refreshToken') || null,
    isAuthenticated: !!localStorage.getItem('accessToken'),
    isLoading: false,
    error: null,

    // ─── Register ─────────────────────────────────────────────────────────────
    register: async (name, email, password, role) => {
        set({ isLoading: true, error: null });
        try {
            const response = await authAPI.register({ name, email, password, role });
            const { accessToken, refreshToken, userId, email: userEmail, role: userRole } = response.data;

            // Save to localStorage
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);

            // Initialize socket connection
            initSocket(accessToken);

            set({
                user: { id: userId, email: userEmail, role: userRole },
                accessToken,
                refreshToken,
                isAuthenticated: true,
                isLoading: false,
                error: null,
            });

            return { success: true };

        } catch (err) {
            const message = err.response?.data?.message || 'Registration failed';
            set({ isLoading: false, error: message });
            return { success: false, error: message };
        }
    },

    // ─── Login ────────────────────────────────────────────────────────────────
    login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
            const response = await authAPI.login({ email, password });
            const { accessToken, refreshToken, userId, email: userEmail, role: userRole } = response.data;

            // Save to localStorage
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);

            // Initialize socket connection
            initSocket(accessToken);

            set({
                user: { id: userId, email: userEmail, role: userRole },
                accessToken,
                refreshToken,
                isAuthenticated: true,
                isLoading: false,
                error: null,
            });

            return { success: true, role: userRole };

        } catch (err) {
            const message = err.response?.data?.message || 'Login failed';
            set({ isLoading: false, error: message });
            return { success: false, error: message };
        }
    },

    // ─── Logout ───────────────────────────────────────────────────────────────
    logout: () => {
        localStorage.clear();
        disconnectSocket();
        set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            error: null,
        });
    },

    // ─── Clear error ──────────────────────────────────────────────────────────
    clearError: () => set({ error: null }),

    // ─── Get user role ────────────────────────────────────────────────────────
    isInterviewer: () => get().user?.role === 'INTERVIEWER',
    isCandidate: () => get().user?.role === 'CANDIDATE',

}));

export default useAuthStore;