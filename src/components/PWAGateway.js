// components/PWAGateway.js
import React, { useEffect, useState } from 'react';

const PWAGateway = () => {
    const [appState, setAppState] = useState('checking');
    const [deferredPrompt, setDeferredPrompt] = useState(null);

    const checkAppState = () => {
        // Check if currently running in standalone mode
        const isCurrentlyInstalled =
            window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone || // iOS
            document.referrer.includes('android-app://');

        if (isCurrentlyInstalled) {
            setAppState('installed');
            localStorage.setItem('appInstalled', 'true');
            return;
        }

        // If not in standalone mode but we have the install prompt, it's installable
        if (deferredPrompt) {
            setAppState('installable');
            localStorage.removeItem('appInstalled');
            return;
        }

        // If not in standalone mode and no install prompt, check if it was previously installed
        if (localStorage.getItem('appInstalled') === 'true') {
            // If it was installed but we're not in standalone mode now, it might have been uninstalled
            setAppState('installable');
            localStorage.removeItem('appInstalled');
            return;
        }

        setAppState('installable');
    };

    useEffect(() => {
        // Initial check
        checkAppState();

        // Check when the page becomes visible
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkAppState();
            }
        };

        // Handle install prompt
        const handleInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setAppState('installable');
            localStorage.removeItem('appInstalled');
        };

        // Handle successful installation
        const handleAppInstalled = () => {
            setAppState('installed');
            localStorage.setItem('appInstalled', 'true');
            setDeferredPrompt(null);
        };

        // Listen for display mode changes
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        const handleDisplayModeChange = (e) => {
            if (e.matches) {
                setAppState('installed');
                localStorage.setItem('appInstalled', 'true');
            } else {
                // If we exit standalone mode, might mean the app was uninstalled
                checkAppState();
            }
        };

        // Set up event listeners
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeinstallprompt', handleInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);
        mediaQuery.addListener(handleDisplayModeChange);

        // Check periodically for changes in installation status
        const intervalCheck = setInterval(checkAppState, 5000);

        // Cleanup
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
            mediaQuery.removeListener(handleDisplayModeChange);
            clearInterval(intervalCheck);
        };
    }, [deferredPrompt]); // Added deferredPrompt to dependency array

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        try {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === 'accepted') {
                setAppState('installed');
                localStorage.setItem('appInstalled', 'true');
            }

            setDeferredPrompt(null);
        } catch (error) {
            console.error('Error showing install prompt:', error);
            // If there's an error, reset to installable state
            setAppState('installable');
            localStorage.removeItem('appInstalled');
        }
    };

    // Rest of your render logic remains the same
    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
                <img
                    src="/images/smartyapps-logo.png"
                    alt="SmartyApps.AI Logo"
                    className="h-24 mx-auto mb-6"
                />

                {appState === 'checking' && (
                    <div className="animate-pulse">
                        <p className="text-gray-600">Checking app status...</p>
                    </div>
                )}

                {appState === 'installable' && (
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
                )}

                {appState === 'installed' && (
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