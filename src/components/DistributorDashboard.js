import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function DistributorDashboard() {
    const navigate = useNavigate();
    const username = localStorage.getItem('distributor_username');

    useEffect(() => {
        if (!username) {
            navigate('/login');
        }
    }, [navigate, username]);

    if (!username) {
        return null; // or a loading state
    }

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-6">Distributor Dashboard</h1>
            <p className="mb-4">Welcome, {username}!</p>
            <p>More features coming soon.</p>
            <button
                onClick={() => {
                    localStorage.removeItem('distributor_username');
                    navigate('/login');
                }}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
                Logout
            </button>
        </div>
    );
}

export default DistributorDashboard;