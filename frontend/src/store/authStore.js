import { create } from 'zustand';
import { authAPI } from '../services/api.js';
import { initSocket, disconnectSocket } from '../services/socket.js';

const getUserFromStorage = () => {
    try {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    } catch {
        return null;
    }
};

const useAuthStore = create((set, get) => ({

    // ─── State ────────────────────────────────────────────────────────────────
    user: getUserFromStorage(),
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

            const user = { id: userId, email: userEmail, role: userRole };

            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);
            localStorage.setItem('user', JSON.stringify(user));

            initSocket(accessToken);

            set({
                user,
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

            const user = { id: userId, email: userEmail, role: userRole };

            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);
            localStorage.setItem('user', JSON.stringify(user));

            initSocket(accessToken);

            set({
                user,
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

    // ─── Update token after refresh ───────────────────────────────────────────
    updateToken: (newAccessToken) => {
        localStorage.setItem('accessToken', newAccessToken);
        set({ accessToken: newAccessToken });
        initSocket(newAccessToken);
    },

    // ─── Clear error ──────────────────────────────────────────────────────────
    clearError: () => set({ error: null }),

    // ─── Helpers ──────────────────────────────────────────────────────────────
    isInterviewer: () => get().user?.role === 'INTERVIEWER',
    isCandidate: () => get().user?.role === 'CANDIDATE',

}));

export default useAuthStore;