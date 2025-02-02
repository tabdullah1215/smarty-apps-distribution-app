// components/Login.js
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardHeader from './DashboardHeader';
import authService from '../services/authService';
import { useLogin } from '../hooks/useLogin';

// Owner-specific login component
export const OwnerLogin = () => <Login role="Owner" />;

// Distributor-specific login component
export const DistributorLogin = () => <Login role="Distributor" />;

// Main Login component
function Login({ role = 'Distributor' }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [permanentMessage, setPermanentMessage] = useState({ type: '', content: '' });
    const location = useLocation();
    const { isLoading, handleLogin } = useLogin(setPermanentMessage, role);

    useEffect(() => {
        authService.removeToken();

        if (location.state?.registration === 'success') {
            setPermanentMessage({ type: 'success', content: location.state.message });
            setEmail(location.state.email || '');
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        await handleLogin(email, password);
    };

    return (
        <div className="min-h-screen bg-gray-200">
            <DashboardHeader
                title={`${role} Login`}
                permanentMessage={permanentMessage}
            />
            <div className="pt-72 md:pt-60">
                <div className="max-w-md mx-auto px-8 md:px-0">
                    <div className="bg-white rounded-lg shadow-md p-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label
                                    htmlFor="email"
                                    className="block text-sm font-medium text-gray-700 mb-1"
                                >
                                    Email
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                    disabled={isLoading}
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-gray-700 mb-1"
                                >
                                    Password
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                    disabled={isLoading}
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-300 font-medium disabled:bg-blue-300"
                                disabled={isLoading}
                            >
                                {isLoading ? 'Logging in...' : 'Log In'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;