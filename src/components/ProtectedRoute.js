// src/components/ProtectedRoute.js
import { Navigate } from 'react-router-dom';
import authService from '../services/authService';

const ProtectedRoute = ({ children }) => {
    if (!authService.isAuthenticated()) {
        // Redirect to login if not authenticated
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default ProtectedRoute;