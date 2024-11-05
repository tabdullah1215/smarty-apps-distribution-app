
// components/InstallButton.js
import React, { useEffect, useState } from 'react';

const InstallButton = () => {
    const [installState, setInstallState] = useState('checking'); // 'checking', 'installable', 'installed', 'unsupported'
    const [deferredPrompt, setDeferredPrompt] = useState(null);

    useEffect(() => {
        // Check if app is installed
        const checkInstallState = () => {
            if (window.matchMedia('(display-mode: standalone)').matches
                || window.navigator.standalone
                || document.referrer.includes('android-app://')) {
                setInstallState('installed');
                return;
            }

            if ('serviceWorker' in navigator && 'BeforeInstallPromptEvent' in window) {
                setInstallState('installable');
            } else {
                setInstallState('unsupported');
            }
        };

        checkInstallState();

        // Listen for install prompt
        const handleInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setInstallState('installable');
        };

        // Listen for successful installation
        const handleAppInstalled = () => {
            setInstallState('installed');
            setDeferredPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', handleInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        // Cleanup
        return () => {
            window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleClick = async () => {
        if (!deferredPrompt) return;

        try {
            // Show install prompt
            await deferredPrompt.prompt();

            // Wait for user response
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to install prompt: ${outcome}`);

            if (outcome === 'accepted') {
                setInstallState('installed');
            }

            setDeferredPrompt(null);
        } catch (error) {
            console.error('Error showing install prompt:', error);
        }
    };

    // Render different button states
    const renderButton = () => {
        switch (installState) {
            case 'checking':
                return (
                    <button
                        className="px-4 py-2 bg-gray-200 text-gray-500 rounded cursor-not-allowed"
                        disabled
                    >
                        Checking install status...
                    </button>
                );

            case 'installable':
                return (
                    <button
                        onClick={handleClick}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
                    >
                        <svg
                            className="w-5 h-5 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Install App
                    </button>
                );

            case 'installed':
                return (
                    <button
                        className="px-4 py-2 bg-green-500 text-white rounded cursor-default flex items-center"
                        disabled
                    >
                        <svg
                            className="w-5 h-5 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        App Installed
                    </button>
                );

            case 'unsupported':
                return (
                    <button
                        onClick={() => window.open('https://support.google.com/chrome/answer/9658361', '_blank')}
                        className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 flex items-center"
                    >
                        <svg
                            className="w-5 h-5 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Installation Info
                    </button>
                );

            default:
                return null;
        }
    };

    return (
        <div className="install-button">
            {renderButton()}
        </div>
    );
};

export default InstallButton;