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
            }
        } catch (error) {
            console.error('Login error:', error);
            const errorCode = error.response?.data?.code;
            const errorMsg = error.response?.data?.message || 'Failed to login. Please try again.';

            switch (errorCode) {
                case 'INVALID_CREDENTIALS':
                    setPermanentMessage({
                        type: 'error',
                        content: 'Invalid email or password'
                    });
                    break;

                case 'ACCOUNT_INACTIVE':
                    setPermanentMessage({
                        type: 'error',
                        content: 'Your account is not active. Please contact support.'
                    });
                    break;

                case 'MISSING_CREDENTIALS':
                    setPermanentMessage({
                        type: 'error',
                        content: 'Please enter both email and password.'
                    });
                    break;

                case 'INVALID_TOKEN':
                case 'TOKEN_EXPIRED':
                    // Clear any existing auth and redirect to login
                    authService.removeToken();
                    setPermanentMessage({
                        type: 'error',
                        content: 'Your session has expired. Please log in again.'
                    });
                    break;

                case 'RATE_LIMIT_EXCEEDED':
                    setPermanentMessage({
                        type: 'error',
                        content: 'Too many login attempts. Please try again later.'
                    });
                    break;

                case 'VALIDATION_ERROR':
                    setPermanentMessage({
                        type: 'error',
                        content: 'Please check your email format and password length.'
                    });
                    break;

                case 'RESOURCE_NOT_FOUND':
                    setPermanentMessage({
                        type: 'error',
                        content: 'Account not found. Please check your email or register.'
                    });
                    break;

                case 'CONDITION_FAILED':
                case 'TRANSACTION_CANCELED':
                    setPermanentMessage({
                        type: 'error',
                        content: 'Login failed due to a database error. Please try again.'
                    });
                    break;

                case 'DATABASE_ERROR':
                    setPermanentMessage({
                        type: 'error',
                        content: 'Unable to access user information. Please try again later.'
                    });
                    break;

                case 'DATA_INTEGRITY_ERROR':
                    setPermanentMessage({
                        type: 'error',
                        content: 'Account data issue detected. Please contact support.'
                    });
                    break;

                case 'AWS_SERVICE_ERROR':
                    setPermanentMessage({
                        type: 'error',
                        content: 'Service temporarily unavailable. Please try again later.'
                    });
                    break;


                default:
                    setPermanentMessage({
                        type: 'error',
                        content: `${errorMsg} (Code: ${errorCode || 'INTERNAL_SERVER_ERROR'})`
                    });
            }
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