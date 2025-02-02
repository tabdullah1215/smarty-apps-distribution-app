// hooks/useSyncOrders.js
import { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import { withMinimumDelay } from '../utils/withDelay';
import authService from '../services/authService';

export const useSyncOrders = (setPermanentMessage, onSuccess) => {
    const [isSyncing, setIsSyncing] = useState(false);
    const API_KEY = process.env.REACT_APP_API_KEY;

    const syncOrdersAndDistributors = async () => {
        setIsSyncing(true);
        try {
            setPermanentMessage({ type: '', content: '' });
            const token = authService.getToken();

            const response = await withMinimumDelay(async () => {
                return await axios.post(
                    `${API_ENDPOINT}/app-manager`,
                    {},
                    {
                        params: { action: 'syncOrdersAndDistributors' },
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'X-Api-Key': API_KEY
                        },
                        withCredentials: false
                    }
                );
            });

            setPermanentMessage({ type: 'success', content: response.data.message });

            // Call onSuccess with isFromSync flag
            if (onSuccess) {
                await onSuccess(true);
            }
        } catch (error) {
            console.error('Error syncing orders and distributors:', error);
            setPermanentMessage({
                type: 'error',
                content: 'Failed to sync orders and distributors. Please try again.'
            });
        } finally {
            setIsSyncing(false);
        }
    };

    return {
        syncOrdersAndDistributors,
        isSyncing
    };
};