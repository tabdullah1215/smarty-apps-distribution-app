import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DashboardHeader from './DashboardHeader';
import LinkGenerator from './LinkGenerator';
import { useAppPurchaseLink } from '../hooks/useAppPurchaseLink';
import authService from '../services/authService';
import { API_ENDPOINT } from '../config';

function DistributorDashboard() {
    const userInfo = authService.getUserInfo();
    const [selectedApp, setSelectedApp] = useState('');
    const [permanentMessage, setPermanentMessage] = useState({ type: '', content: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [apps, setApps] = useState([]);

    const {
        uniquePurchaseLink,
        genericPurchaseLink,
        copiedUnique,
        copiedGeneric,
        setCopiedUnique,
        setCopiedGeneric,
        generatePurchaseLink,
        copyToClipboard,
        generatingStates
    } = useAppPurchaseLink(setPermanentMessage);

    useEffect(() => {
        fetchAvailableApps();
    }, []);

    const fetchAvailableApps = async () => {
        try {
            setIsLoading(true);
            const token = authService.getToken();

            const response = await axios.post(
                `${API_ENDPOINT}/create-distributor`,
                {},  // empty body since it's using query params
                {
                    params: { action: 'fetchAvailableApps' },
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.apps) {
                setApps(response.data.apps);
            }
        } catch (error) {
            console.error('Failed to fetch apps:', error);
            setPermanentMessage({
                type: 'error',
                content: 'Failed to load available apps'
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-200">
            <DashboardHeader
                title="Distributor Dashboard"
                centerContent={
                    <p className="text-gray-600">
                        Welcome, {userInfo?.email || 'User'}!
                    </p>
                }
                permanentMessage={permanentMessage}
            />
            <div className="p-8 max-w-6xl mx-auto pt-80 md:pt-60">
                <div className="bg-white rounded-lg shadow-md p-8 mb-8">
                    <h2 className="text-xl font-semibold mb-4">Generate App Purchase Links</h2>
                    <div className="mb-6">
                        <label htmlFor="appSelect" className="block text-sm font-medium text-gray-700 mb-2">
                            Select App
                        </label>
                        <select
                            id="appSelect"
                            value={selectedApp}
                            onChange={(e) => setSelectedApp(e.target.value)}
                            className="w-full p-2 border rounded-md"
                            disabled={isLoading}
                        >
                            <option value="">Select an app...</option>
                            {apps.map(app => (
                                <option key={app.AppId} value={app.AppId}>
                                    {app.Name} - ${app.Price}
                                </option>
                            ))}
                        </select>
                        {isLoading && (
                            <p className="mt-2 text-sm text-gray-500">Loading available apps...</p>
                        )}
                    </div>
                </div>

                {selectedApp && (
                    <>
                        <LinkGenerator
                            title="Unique Purchase Link"
                            link={uniquePurchaseLink}
                            copied={copiedUnique}
                            generateFn={() => generatePurchaseLink('unique', selectedApp)}
                            copyFn={() => copyToClipboard(uniquePurchaseLink, setCopiedUnique)}
                            isGenerating={generatingStates.unique}
                            description="For confirmed payments"
                        />
                        <LinkGenerator
                            title="Generic Purchase Link"
                            link={genericPurchaseLink}
                            copied={copiedGeneric}
                            generateFn={() => generatePurchaseLink('generic', selectedApp)}
                            copyFn={() => copyToClipboard(genericPurchaseLink, setCopiedGeneric)}
                            isGenerating={generatingStates.generic}
                            description="Requires order number verification"
                        />
                    </>
                )}
            </div>
        </div>
    );
}

export default DistributorDashboard;