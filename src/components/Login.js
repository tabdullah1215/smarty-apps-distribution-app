import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import DashboardHeader from './DashboardHeader';
import authService from '../services/authService';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const [permanentMessage, setPermanentMessage] = useState({ type: '', content: '' });

    useEffect(() => {
        // Clear any existing auth on login page load
        authService.removeToken();

        // Handle registration success message
        if (location.state?.registration === 'success') {
            setPermanentMessage({ type: 'success', content: location.state.message });
            setEmail(location.state.email || '');
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setPermanentMessage({ type: '', content: '' });
        setIsLoading(true);

        try {
            const response = await axios.post(`${API_ENDPOINT}/create-distributor`,
                { email, password },
                {
                    params: { action: 'verifyCredentials' },
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (response.data.token) {
                // Store the JWT token
                authService.setToken(response.data.token);
                setPermanentMessage({ type: 'success', content: 'Login successful!' });

                // Get user info from token
                const userInfo = authService.getUserInfo();
                if (userInfo) {
                    localStorage.setItem('distributor_username', userInfo.email);
                }

                // Navigate based on user role
                if (userInfo.role === 'Distributor') {
                    navigate('/distributor');
                } else {
                    navigate('/');  // Default to owner dashboard
                }
            } else {
                setPermanentMessage({ type: 'error', content: 'Invalid credentials' });
            }
        } catch (error) {
            console.error('Login error:', error);
            const errorMsg = error.response?.data?.message || 'Failed to login. Please try again.';
            setPermanentMessage({ type: 'error', content: errorMsg });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-200">
            <DashboardHeader
                title="Login"
                permanentMessage={permanentMessage}
            />
            <div className="pt-60">
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