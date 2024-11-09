// DashboardHeader.js
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import authService from '../services/authService';

const DashboardHeader = ({
                             subtitle = "App Manager",  // Default subtitle
                             title,  // Required title
                             permanentMessage,  // Message object { type: 'success' | 'error', content: string }
                             logoUrl = "/images/smartyapps-logo.png",  // Default logo path
                             centerContent  // Optional additional content to display in center
                         }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Check if we're on login or registration pages
    const isAuthPage = location.pathname === '/login' || location.pathname.startsWith('/register');

    const handleLogout = () => {
        authService.removeToken();
        localStorage.removeItem('distributor_username');
        navigate('/login');
    };

    return (
        <div className="fixed top-0 left-0 right-0 bg-white z-10 shadow-md min-h-[250px] md:min-h-[200px]">
            <div className="max-w-6xl mx-auto px-4 py-3">
                <div className="flex flex-col items-start md:items-center">
                    <div className="w-full flex flex-col md:flex-row items-start md:items-center md:justify-between mb-2">
                        {/* Main content container */}
                        <div className="flex flex-col md:flex-row w-full md:items-center">
                            {/* Mobile Logo and Logout Container */}
                            <div className="w-full md:w-auto flex items-center justify-between md:justify-start mb-1 md:mb-0">
                                <div className="w-20 md:w-0"></div> {/* Spacer for centering logo (mobile only) */}
                                <div className="flex justify-center">
                                    <img
                                        src={logoUrl}
                                        alt="SmartyApps.AI Logo"
                                        className="h-20 md:h-32"
                                    />
                                </div>
                                <div className="w-20 md:w-0 flex justify-end md:hidden">
                                    {!isAuthPage && (
                                        <button
                                            onClick={handleLogout}
                                            className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                                        >
                                            Logout
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Center content area */}
                            <div className="flex-grow flex justify-center md:px-4">
                                <div className="flex flex-col text-center">
                                    <h2 className="text-lg md:text-xl text-gray-600 font-semibold">{subtitle}</h2>
                                    <h1 className="text-xl md:text-2xl font-bold text-gray-800">{title}</h1>
                                    {centerContent && (
                                        <div className="mt-2">{centerContent}</div>
                                    )}
                                </div>
                            </div>

                            {/* Desktop logout button */}
                            <div className="hidden md:flex items-center justify-end" style={{width: '128px'}}>
                                {!isAuthPage && (
                                    <button
                                        onClick={handleLogout}
                                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                                    >
                                        Logout
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Permanent message */}
                    <div className="w-full md:flex-grow">
                        {permanentMessage && (
                            <div className="max-w-2xl mx-auto mt-1 md:mt-2">
                                <div
                                    className={`p-2 rounded-lg w-full text-center text-sm min-h-[2rem] md:min-h-[2.5rem] flex items-center justify-center ${
                                        permanentMessage.content
                                            ? (permanentMessage.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')
                                            : 'bg-gray-50 text-gray-400'
                                    }`}
                                >
                                    {permanentMessage.content || 'No messages'}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardHeader;