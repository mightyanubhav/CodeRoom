import { Navigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore.js';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
    const { isAuthenticated, user } = useAuthStore();

    // Not logged in — redirect to login
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Role check — if allowedRoles specified, verify user has that role
    if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};

export default ProtectedRoute;