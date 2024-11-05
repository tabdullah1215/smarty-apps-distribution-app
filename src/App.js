import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import InstallButton from './components/InstallButton';
import OwnerDashboard from './components/OwnerDashboard';
import DistributorDashboard from './components/DistributorDashboard';
import DistributorRegistration from './components/DistributorRegistration';
import Login from './components/Login';

function App() {
    return (
        <Router>
            {/* You can place the InstallButton wherever you want */}
            <div className="fixed bottom-4 right-4 z-50">
                <InstallButton />
            </div>

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