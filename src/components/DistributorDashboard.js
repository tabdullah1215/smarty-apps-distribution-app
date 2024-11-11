import React, { useState } from 'react';
import DashboardHeader from './DashboardHeader';
import LinkGenerator from './LinkGenerator';
import { useAppPurchaseLink } from '../hooks/useAppPurchaseLink';
import authService from '../services/authService';

function DistributorDashboard() {
    const userInfo = authService.getUserInfo();
    const [selectedApp, setSelectedApp] = useState('');
    const [permanentMessage, setPermanentMessage] = useState({ type: '', content: '' });

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
                        >
                            <option value="">Select an app...</option>
                            {/* We'll need to populate this with actual apps */}
                            <option value="app1">App 1</option>
                            <option value="app2">App 2</option>
                        </select>
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