// components/PWAGateway.js
import React, { useEffect, useState } from 'react';

const PWAGateway = () => {
    const [showInstalledView, setShowInstalledView] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState(null);

    useEffect(() => {
        // Handle install prompt
        const handleInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) {
            // If no install prompt, just show the installed view
            // (this covers the case where app is already installed)
            setShowInstalledView(true);
            return;
        }

        try {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            // Regardless of the outcome, show the installed view
            setShowInstalledView(true);
            setDeferredPrompt(null);
        } catch (error) {
            console.error('Error showing install prompt:', error);
            // Even on error, show installed view
            setShowInstalledView(true);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
                <img
                    src="/images/smartyapps-logo.png"
                    alt="SmartyApps.AI Logo"
                    className="h-24 mx-auto mb-6"
                />

                {!showInstalledView ? (
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 mb-4">
                            Welcome to SmartyApps.AI
                        </h1>
                        <p className="text-gray-600 mb-6">
                            For the best experience, please install our app on your device.
                        </p>
                        <button
                            onClick={handleInstall}
                            className="w-full py-3 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-300 flex items-center justify-center"
                        >
                            <svg
                                className="w-5 h-5 mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                />
                            </svg>
                            Install App
                        </button>
                    </div>
                ) : (
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 mb-4">
                            App Installed
                        </h1>
                        <p className="text-gray-600 mb-2">
                            Please use the installed app on your device.
                        </p>
                        <p className="text-gray-600 mb-6">
                            You can find the app icon on your home screen or app drawer.
                        </p>
                        <div className="text-sm text-gray-500">
                            <p>If you can't find the app:</p>
                            <ul className="list-disc list-inside mt-2">
                                <li>Check your home screen</li>
                                <li>Look in your app drawer</li>
                                <li>Search for "SmartyApps"</li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PWAGateway;