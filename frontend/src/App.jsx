import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import Dashboard from './pages/dashboard/Dashboard.jsx';
import InterviewRoom from './pages/interview/InterviewRoom.jsx';
import QuestionBank from './pages/questions/QuestionBank.jsx';
import CreateQuestion from './pages/questions/CreateQuestion.jsx';
import ProtectedRoute from './components/shared/ProtectedRoute.jsx';
import useAuthStore from './store/authStore.js';

function App() {
    const { isAuthenticated } = useAuthStore();

    return (
        <BrowserRouter>
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 3000,
                    style: {
                        background: '#1e1e1e',
                        color: '#fff',
                        border: '1px solid #333',
                    },
                }}
            />
            <Routes>
                {/* Public routes */}
                <Route
                    path="/login"
                    element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
                />
                <Route
                    path="/register"
                    element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />}
                />

                {/* Protected routes */}
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/room/:roomId"
                    element={
                        <ProtectedRoute>
                            <InterviewRoom />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/questions"
                    element={
                        <ProtectedRoute>
                            <QuestionBank />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/questions/create"
                    element={
                        <ProtectedRoute>
                            <CreateQuestion />
                        </ProtectedRoute>
                    }
                />

                {/* Default redirect */}
                <Route
                    path="/"
                    element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />}
                />
                <Route
                    path="*"
                    element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />}
                />
            </Routes>
        </BrowserRouter>
    );
}

export default App;