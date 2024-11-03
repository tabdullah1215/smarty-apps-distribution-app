// DistributorDashboard.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardHeader from './DashboardHeader';

function DistributorDashboard() {
    const navigate = useNavigate();
    const username = localStorage.getItem('distributor_username');
    const [permanentMessage] = useState({ type: '', content: '' });

    useEffect(() => {
        if (!username) {
            navigate('/login');
        }
    }, [navigate, username]);

    if (!username) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-200">
            <DashboardHeader
                title="Distributor Dashboard"
                centerContent={<p className="text-gray-600">Welcome, {username}!</p>}
                permanentMessage={permanentMessage}  // Added permanentMessage prop
            />
            <div className="p-8 max-w-6xl mx-auto pt-48">
                <div className="bg-white rounded-lg shadow-md p-8">
                    <p className="mb-4">More features coming soon.</p>
                    <button
                        onClick={() => {
                            localStorage.removeItem('distributor_username');
                            navigate('/login');
                        }}
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