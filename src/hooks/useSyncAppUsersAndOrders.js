// hooks/useSyncAppUsersAndOrders.js
import { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import { withMinimumDelay } from '../utils/withDelay';
import authService from '../services/authService';

export const useSyncAppUsersAndOrders = (setPermanentMessage, onSuccess) => {
    const [isSyncing, setIsSyncing] = useState(false);
    const API_KEY = process.env.REACT_APP_API_KEY;

    const syncAppUsersAndOrders = async () => {
        setIsSyncing(true);
        try {
            setPermanentMessage({ type: '', content: '' });
            const token = authService.getToken();

            const response = await withMinimumDelay(async () => {
                return await axios.post(
                    `${API_ENDPOINT}/app-manager`,
                    {},
                    {
                        params: { action: 'syncAppUsers' },
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'X-Api-Key': API_KEY
                        },
                        withCredentials: false
                    }
                );
            });

            if (response.data && response.data.message) {
                setPermanentMessage({ type: 'success', content: response.data.message });
                if (onSuccess) {
                    await onSuccess(true);
                }
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error('Error syncing app users and orders:', error);
            setPermanentMessage({
                type: 'error',
                content: 'Failed to sync app users and orders. Please try again.'
            });
        } finally {
            setIsSyncing(false);
        }
    };

    return {
        syncAppUsersAndOrders,
        isSyncing
    };
};