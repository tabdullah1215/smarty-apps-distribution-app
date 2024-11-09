import React from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardHeader from './DashboardHeader';
import authService from '../services/authService';

function DistributorDashboard() {
    const navigate = useNavigate();
    const userInfo = authService.getUserInfo();

    const handleLogout = () => {
        authService.removeToken();
        localStorage.removeItem('distributor_username');
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gray-200">
            <DashboardHeader
                title="Distributor Dashboard"
                centerContent={
                    <p className="text-gray-600">
                        Welcome, {userInfo?.email || 'User'}!
                    </p>
                }
                permanentMessage={{ type: '', content: '' }}
            />
            <div className="p-8 max-w-6xl mx-auto pt-60">
                <div className="bg-white rounded-lg shadow-md p-8">
                    <p className="mb-4">More features coming soon.</p>
                    <button
                        onClick={handleLogout}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DistributorDashboard;