import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import OwnerDashboard from './components/OwnerDashboard';
import DistributorDashboard from './components/DistributorDashboard';
import DistributorRegistration from './components/DistributorRegistration';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<OwnerDashboard />} />
                <Route path="/distributor" element={<DistributorDashboard />} />
                <Route path="/register/:linkType/:token" element={<DistributorRegistration />} />
            </Routes>
        </Router>
    );
}

export default App;