import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import authService from '../services/authService';

const SubAppSelector = ({ appId, selectedSubAppId, onSubAppIdChange }) => {
    const [subApps, setSubApps] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const API_KEY = process.env.REACT_APP_API_KEY;

    useEffect(() => {
        const fetchSubApps = async () => {
            if (!appId) {
                setSubApps([]);
                return;
            }

            setIsLoading(true);
            try {
                const token = authService.getToken();

                const response = await axios.post(
                    `${API_ENDPOINT}/app-manager`,
                    {},
                    {
                        params: {
                            action: 'getSubAppsForApp',
                            appId: appId
                        },
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'X-Api-Key': API_KEY
                        }
                    }
                );

                console.log("SubApps API response:", response.data);

                if (Array.isArray(response.data)) {
                    setSubApps(response.data);
                } else {
                    setSubApps([]);
                }
            } catch (error) {
                console.error('Error fetching SubApps:', error);
                setSubApps([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSubApps();
    }, [appId]);

    return (
        <div className="mb-4">
            <label htmlFor="subAppSelect" className="block text-sm font-medium text-gray-700 mb-2">
                Select Sub App
            </label>
            <select
                id="subAppSelect"
                value={selectedSubAppId || ''}
                onChange={(e) => onSubAppIdChange(e.target.value)}
                className="w-full p-2 border rounded-md"
                disabled={isLoading || !appId || subApps.length === 0}
            >
                <option value="">Select a sub app...</option>
                {subApps.map(subApp => (
                    <option key={subApp.SubAppId} value={subApp.SubAppId}>
                        {subApp.SubAppName || subApp.SubAppId}
                    </option>
                ))}
            </select>
            {isLoading && <p className="mt-2 text-sm text-gray-500">Loading sub apps...</p>}
            {!isLoading && !appId && <p className="mt-2 text-sm text-gray-500">Please select an app first</p>}
            {!isLoading && appId && subApps.length === 0 && <p className="mt-2 text-sm text-gray-500">No sub apps available</p>}
        </div>
    );
};

export default SubAppSelector;