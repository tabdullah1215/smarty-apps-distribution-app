// App.js
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PWAGateway from './components/PWAGateway';
import OwnerDashboard from './components/OwnerDashboard';
import DistributorDashboard from './components/DistributorDashboard';
import DistributorRegistration from './components/DistributorRegistration';
import Login, { OwnerLogin, DistributorLogin } from './components/Login';
import authService from './services/authService';


// Protected Route Component with role check
const ProtectedRoute = ({ children, allowedRole }) => {
    const userInfo = authService.getUserInfo();

    if (!authService.isAuthenticated()) {
        return <Navigate to="/login" replace />;
    }

    // Redirect if user doesn't have the required role
    if (allowedRole && userInfo?.role !== allowedRole) {
        return <Navigate to={userInfo?.role === 'Owner' ? '/owner' : '/distributor'} replace />;
    }

    return children;
};

function App() {
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Initialize authentication state
        authService.initializeAuth();

        // Check for standalone mode
        const checkStandalone = () => {
            const isAppMode = window.matchMedia('(display-mode: standalone)').matches
                || window.navigator.standalone
                || document.referrer.includes('android-app://');
            setIsStandalone(isAppMode);
        };

        checkStandalone();

        // Listen for display mode changes
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        mediaQuery.addListener(checkStandalone);

        return () => mediaQuery.removeListener(checkStandalone);
    }, []);

    // Show gateway page if not in standalone mode and on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && !isStandalone) {
        return <PWAGateway />;
    }

    // Show regular app with protected routes if in standalone mode or on desktop
    return (
        <Router>
            <Routes>
                <Route path="/owner/login" element={<OwnerLogin />} />
                <Route path="/distributor/login" element={<DistributorLogin />} />
                <Route path="/register/:linkType/:token" element={<DistributorRegistration />} />
                <Route
                    path="/distributor"
                    element={
                        <ProtectedRoute allowedRole="Distributor">
                            <DistributorDashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/owner"
                    element={
                        <ProtectedRoute allowedRole="Owner">
                            <OwnerDashboard />
                        </ProtectedRoute>
                    }
                />
                {/* Redirect root to appropriate dashboard based on role */}
                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            {authService.getUserInfo()?.role === 'Owner' ?
                                <Navigate to="/owner" replace /> :
                                <Navigate to="/distributor" replace />
                            }
                        </ProtectedRoute>
                    }
                />
                {/* Catch-all redirect to login */}
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </Router>
    );
}

export default App;