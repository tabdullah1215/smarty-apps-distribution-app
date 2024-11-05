// App.js
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PWAGateway from './components/PWAGateway';
import OwnerDashboard from './components/OwnerDashboard';
import DistributorDashboard from './components/DistributorDashboard';
import DistributorRegistration from './components/DistributorRegistration';
import Login from './components/Login';

function App() {
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        const checkStandalone = () => {
            const isAppMode = window.matchMedia('(display-mode: standalone)').matches
                || window.navigator.standalone
                || document.referrer.includes('android-app://');
            setIsStandalone(isAppMode);
        };

        checkStandalone();

        // Optional: Listen for display mode changes
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        mediaQuery.addListener(checkStandalone);

        return () => mediaQuery.removeListener(checkStandalone);
    }, []);

    // Show gateway page if not in standalone mode and on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && !isStandalone) {
        return <PWAGateway />;
    }

    // Show regular app if in standalone mode or on desktop
    return (
        <Router>
            <Routes>
                <Route path="/" element={<OwnerDashboard />} />
                <Route path="/distributor" element={<DistributorDashboard />} />
                <Route path="/register/:linkType/:token" element={<DistributorRegistration />} />
                <Route path="/login" element={<Login />} />
            </Routes>
        </Router>
    );
}

export default App;