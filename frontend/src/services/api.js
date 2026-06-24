import axios from 'axios';
import { API_URL } from '../utils/constants.js';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// ─── Request interceptor ──────────────────────────────────────────────────────

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ─── Response interceptor ─────────────────────────────────────────────────────

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = localStorage.getItem('refreshToken');

                if (!refreshToken) {
                    localStorage.clear();
                    window.location.href = '/login';
                    return Promise.reject(error);
                }

                const response = await axios.post(
                    `${API_URL}/api/auth/refresh`,
                    {},
                    { headers: { 'Refresh-Token': refreshToken } }
                );

                const newAccessToken = response.data.accessToken;

                // Update localStorage
                localStorage.setItem('accessToken', newAccessToken);

                // Update authStore + reinitialize socket with new token
                const { default: useAuthStore } = await import('../store/authStore.js');
                useAuthStore.getState().updateToken(newAccessToken);

                // Retry original request
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                return api(originalRequest);

            } catch (refreshError) {
                localStorage.clear();
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

// ─── Auth endpoints ───────────────────────────────────────────────────────────

export const authAPI = {
    register: (data) => api.post('/api/auth/register', data),
    login: (data) => api.post('/api/auth/login', data),
    refresh: (refreshToken) => api.post('/api/auth/refresh', {}, {
        headers: { 'Refresh-Token': refreshToken }
    }),
};

// ─── Interview endpoints ──────────────────────────────────────────────────────

export const interviewAPI = {
    create: (data) => api.post('/api/interviews/create', data),
    join: (roomId) => api.post(`/api/interviews/join/${roomId}`),
    end: (roomId) => api.post(`/api/interviews/end/${roomId}`),
    score: (roomId, data) => api.post(`/api/interviews/score/${roomId}`, data),
    getMyInterviews: () => api.get('/api/interviews/my'),
    getByRoom: (roomId) => api.get(`/api/interviews/room/${roomId}`),
    getByRoomEntityId: (roomEntityId) => api.get(`/api/interviews/by-room-entity/${roomEntityId}`),
    updateRoomId: (interviewId, roomId) => api.patch(`/api/interviews/${interviewId}/room-id`, { roomId }),
};

// ─── Question endpoints ───────────────────────────────────────────────────────

export const questionAPI = {
    create: (data) => api.post('/api/questions/create', data),
    getAll: () => api.get('/api/questions'),
    getById: (id) => api.get(`/api/questions/${id}`),
    getByDifficulty: (difficulty) => api.get(`/api/questions/difficulty/${difficulty}`),
    search: (keyword) => api.get(`/api/questions/search?keyword=${keyword}`),
    getByTag: (tag) => api.get(`/api/questions/tag/${tag}`),
    update: (id, data) => api.put(`/api/questions/${id}`, data),
    delete: (id) => api.delete(`/api/questions/${id}`),
    addTestCase: (id, data) => api.post(`/api/questions/${id}/testcase`, data),
};

// ─── Room endpoints ───────────────────────────────────────────────────────────

export const roomAPI = {
    create: (interviewId) => api.post(`/api/rooms/create/${interviewId}`),
    getById: (roomId) => api.get(`/api/rooms/${roomId}`),
    getByInterview: (interviewId) => api.get(`/api/rooms/interview/${interviewId}`),
    loadQuestion: (roomId, questionId) => api.post(`/api/rooms/${roomId}/question/${questionId}`),
    sync: (roomId, data) => api.post(`/api/rooms/${roomId}/sync`, data),
    close: (roomId) => api.post(`/api/rooms/${roomId}/close`),
};

export default api;