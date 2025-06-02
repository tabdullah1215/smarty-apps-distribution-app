import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import LinkGenerator from './LinkGenerator';

/**
 * A component that provides a test button for creating a test user
 * using an existing purchase link
 */
const AppUserTestRegistration = ({
                                      distributorId,
                                      selectedApp,
                                      selectedSubAppId,
                                      availableApps,
                                      uniquePurchaseLink,
                                      genericPurchaseLink
                                  }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [testLink, setTestLink] = useState('');
    const [copied, setCopied] = useState(false);
    const [testCredentials, setTestCredentials] = useState(null);

    // Generate test credentials with a simple first name + 3 digit number + hotmail.com
    const generateTestCredentials = () => {
        const firstNames = ['john', 'mary', 'david', 'sarah', 'michael', 'lisa', 'robert', 'jessica', 'william', 'jennifer'];
        const randomName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const randomNumber = Math.floor(100 + Math.random() * 900); // 3-digit number between 100-999

        return {
            email: `${randomName}${randomNumber}@hotmail.com`,
            password: '3040886'
        };
    };

    const handleGenerateTestUser = async () => {
        // Verify we have a purchase link to use
        if (!uniquePurchaseLink && !genericPurchaseLink) {
            setTestLink('Error: Please generate a purchase link first (either unique or generic)');
            return;
        }

        // Prefer unique purchase link if available, otherwise use generic
        const purchaseLink = uniquePurchaseLink || genericPurchaseLink;

        // Extract token from the purchase link
        // Assuming the link format is something like: https://example.com/register/app-id/subapp-id/link-type/token
        const parts = purchaseLink.split('/');
        const token = parts[parts.length - 1];

        if (!token) {
            setTestLink('Error: Could not extract token from purchase link');
            return;
        }

        setIsGenerating(true);
        setCopied(false);

        try {
            const credentials = generateTestCredentials();
            const appInfo = availableApps.find(app => app.AppId === selectedApp);
            const appName = appInfo ? appInfo.Name : selectedApp;

            // Call the standard registration API endpoint
            // This simulates a normal user registration
            const response = await axios.post(
                `${API_ENDPOINT}/app-manager`,
                {
                    email: credentials.email,
                    password: credentials.password,
                    token: token,
                    appId: selectedApp,
                    subAppId: selectedSubAppId,
                    linkType: uniquePurchaseLink ? 'unique' : 'generic',
                    orderNumber: uniquePurchaseLink ? undefined : `TEST-${Date.now()}`
                },
                {
                    params: { action: 'verifyAppPurchase' },
                    headers: { 'Content-Type': 'application/json', 'X-Api-Key': process.env.REACT_APP_API_KEY }
                }
            );

            if (response.data && (response.data.status || response.data.message)) {
                // Create a formatted credentials string
                const testCredentialsText = `
Email: ${credentials.email}
Password: ${credentials.password}
App: ${appName}
SubApp: ${selectedSubAppId}
Status: ${response.data.status || 'registered'}`;

                setTestLink(testCredentialsText);
                setTestCredentials(credentials);
            }
        } catch (error) {
            console.error('Error creating test user:', error);
            setTestLink(`Error: Failed to create test user. ${error.response?.data?.message || error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopyToClipboard = () => {
        if (testLink) {
            navigator.clipboard.writeText(testLink)
                .then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 3000);
                })
                .catch(err => {
                    console.error('Failed to copy:', err);
                });
        }
    };

    return (
        <div className="mt-8">
            <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-md">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-yellow-100 text-yellow-600">
                            ⚠️
                        </span>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">Development Testing Only</h3>
                        <div className="mt-2 text-sm text-yellow-700">
                            <p>This feature creates a test user for the selected app and subapp using an existing purchase link.</p>
                            {!uniquePurchaseLink && !genericPurchaseLink && (
                                <p className="mt-2 font-semibold">Please generate a purchase link first (either unique or generic).</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <LinkGenerator
                title={`Test User for ${selectedSubAppId || "App"}`}
                link={testLink}
                copied={copied}
                generateFn={handleGenerateTestUser}
                copyFn={handleCopyToClipboard}
                isGenerating={isGenerating}
            />

            {testCredentials && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                    <h3 className="text-sm font-medium text-green-800 mb-2">Test User Created Successfully!</h3>
                    <p className="text-sm text-gray-600">Use these credentials to log in to the app.</p>
                    <div className="mt-4 grid grid-cols-1 gap-4">
                        <button
                            onClick={() => window.open('/login', '_blank')}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                            Open Login Page in New Tab
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AppUserTestRegistration;