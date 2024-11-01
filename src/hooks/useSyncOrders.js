
// hooks/useSyncOrders.js
import { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';

export const useSyncOrders = (setPermanentMessage, onSuccess) => {
    const [isSyncing, setIsSyncing] = useState(false);

    const syncOrdersAndDistributors = async () => {
        setIsSyncing(true);
        try {
            setPermanentMessage({ type: '', content: '' });

            const response = await axios.post(
                `${API_ENDPOINT}/create-distributor`,
                {},
                {
                    params: { action: 'syncOrdersAndDistributors' },
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            setPermanentMessage({ type: 'success', content: response.data.message });
            onSuccess?.();
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